/**
 * Backend API client. Base URL is set via VITE_API_URL:
 * - Local dev: VITE_API_URL=http://localhost:8000 (frontend on 8080, backend on 8000)
 * - Lovable (frontend) + Railway (backend): set VITE_API_URL in Lovable to your Railway API URL,
 *   or leave unset to use the default below.
 */

const BASE = (import.meta.env.VITE_API_URL ?? "https://aura-briefing-production.up.railway.app").replace(/\/$/, "");

/** @deprecated Use api or VITE_API_URL; kept for compatibility with main branch code */
export const API_BASE_URL = BASE;

function url(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return BASE ? `${BASE}${p}` : p;
}

const AUTH_KEY = "briefcast_auth";

/** Headers for authenticated requests (X-User-Email from localStorage). */
function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as { email?: string };
    const email = data?.email?.trim();
    return email ? { "X-User-Email": email } : {};
  } catch {
    return {};
  }
}

/** Subscribe to real-time progress via SSE. Returns token (for X-Progress-Token header) and close(). */
function subscribeProgress(onProgress: (p: number) => void): { token: string; close: () => void } {
  const token = crypto.randomUUID();
  const progressUrl = `${url("/progress")}?token=${encodeURIComponent(token)}`;
  const es = new EventSource(progressUrl);
  es.onmessage = (e: MessageEvent) => {
    try {
      const d = JSON.parse(e.data) as { progress?: number; done?: boolean };
      if (typeof d.progress === "number") onProgress(d.progress);
      if (d.done) es.close();
    } catch {
      // ignore parse errors
    }
  };
  es.onerror = () => es.close();
  return { token, close: () => es.close() };
}

export const api = {
  async getHealth(): Promise<{ status: string }> {
    const res = await fetch(url("/health"));
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  },

  async transcribe(
    youtubeUrl: string
  ): Promise<{ channel: string; title: string; description: string; text: string }> {
    const res = await fetch(url("/transcribe"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: youtubeUrl }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `Transcribe failed: ${res.status}`);
    }
    return res.json();
  },

  /** GET summary by URL (404 if not stored). */
  async getSummaryByUrl(
    sourceUrl: string
  ): Promise<{ source_url: string; summary: unknown }> {
    const res = await fetch(
      url(`/summaries/by-url?${new URLSearchParams({ url: sourceUrl })}`)
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `Failed: ${res.status}`);
    }
    return res.json();
  },

  /** GET or extract summary for a URL (YouTube, article, etc.). */
  async getOrExtractSummary(
    sourceUrl: string
  ): Promise<{ source_url: string; summary: unknown }> {
    const res = await fetch(url("/summaries/get-or-extract"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: sourceUrl }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `Failed: ${res.status}`);
    }
    return res.json();
  },

  /** Log in: return user only if account exists. Fails with 401 if no account. */
  async login(payload: { email: string }): Promise<AuthUser> {
    const res = await fetch(url("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: payload.email.trim().toLowerCase() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = Array.isArray(err.detail) ? err.detail[0]?.msg : err.detail;
      throw new Error(typeof msg === "string" ? msg : "Invalid email or password");
    }
    return res.json();
  },

  /** Get or create user by email (call after signup only). */
  async getAuthMe(payload: { email: string; name?: string }): Promise<AuthUser> {
    const res = await fetch(url("/auth/me"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: payload.email, name: payload.name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `Auth failed: ${res.status}`);
    }
    return res.json();
  },

  /** Get current user settings (briefing_frequency, briefing_length, voice_style). */
  async getSettings(): Promise<{
    briefing_frequency?: string;
    briefing_length?: string;
    voice_style?: string;
  }> {
    const res = await fetch(url("/users/me/settings"), { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch settings: ${res.status}`);
    return res.json();
  },

  /** Update user settings. */
  async updateSettings(settings: {
    briefing_frequency?: string;
    briefing_length?: number;
    voice_style?: string;
  }): Promise<{
    briefing_frequency?: string;
    briefing_length?: string;
    voice_style?: string;
  }> {
    const res = await fetch(url("/users/me/settings"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(`Failed to update settings: ${res.status}`);
    return res.json();
  },

  /** List topic preferences (for Explore interests + topic favourites). */
  async getPreferencesTopics(): Promise<TopicPreference[]> {
    const res = await fetch(url("/preferences/topics"), { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch topics: ${res.status}`);
    return res.json();
  },

  /** Add a topic preference. */
  async addPreferencesTopic(topic: string): Promise<TopicPreference> {
    const res = await fetch(url("/preferences/topics"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ topic: topic.trim() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `Failed to add topic: ${res.status}`);
    }
    return res.json();
  },

  /** Remove a topic preference. */
  async deletePreferencesTopic(topicId: number): Promise<void> {
    const res = await fetch(url(`/preferences/topics/${topicId}`), {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to remove topic: ${res.status}`);
  },

  /**
   * Get suggested articles from Google News RSS based on the user's topic preferences.
   * Used for the Explore page "Suggestions" section. Returns empty topics when user has no topics.
   */
  async getFeedByTopics(params?: { max_per_topic?: number }): Promise<FeedByTopicsResponse> {
    const qs = params?.max_per_topic != null ? `?max_per_topic=${params.max_per_topic}` : "";
    const res = await fetch(url(`/feed/by-topics${qs}`), { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch feed: ${res.status}`);
    return res.json();
  },

  /**
   * Get the single suggested YouTube video (highest view count across user's topic preferences).
   * Requires GOOGLE_API_KEY on the backend. Returns video + topic or null when user has no topics.
   */
  async getFeedYoutubeByTopics(params?: { min_views?: number }): Promise<YoutubeFeedByTopicsResponse> {
    const qs = params?.min_views != null ? `?min_views=${params.min_views}` : "";
    const res = await fetch(url(`/feed/youtube-by-topics${qs}`), { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch YouTube feed: ${res.status}`);
    return res.json();
  },

  /** List bookmarks (saved briefings). */
  async getBookmarks(): Promise<BookmarkEntry[]> {
    const res = await fetch(url("/bookmarks"), { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch bookmarks: ${res.status}`);
    return res.json();
  },

  /** Add a bookmark. */
  async addBookmark(bookmark: {
    title: string;
    description?: string;
    duration?: string;
    topics?: string[];
    summary?: string;
    audio_url?: string;
  }): Promise<BookmarkEntry> {
    const res = await fetch(url("/bookmarks"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(bookmark),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `Failed to add bookmark: ${res.status}`);
    }
    return res.json();
  },

  /** Remove a bookmark. */
  async deleteBookmark(bookmarkId: number): Promise<void> {
    const res = await fetch(url(`/bookmarks/${bookmarkId}`), {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to remove bookmark: ${res.status}`);
  },

  /** Get briefings (latest from user's sources). */
  async getBriefings(): Promise<{ briefings: BriefingEntry[] }> {
    const res = await fetch(url("/briefings"), { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch briefings: ${res.status}`);
    return res.json();
  },

  /**
   * AI assistant chat (Gemini). Send full conversation history; returns assistant reply.
   */
  async chat(messages: { role: "user" | "assistant"; content: string }[]): Promise<{ content: string }> {
    const res = await fetch(url("/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `Chat failed: ${res.status}`);
    }
    return res.json();
  },

  /** List all followed sources. */
  async getSources(): Promise<SourceEntry[]> {
    const res = await fetch(url("/sources"), { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch sources: ${res.status}`);
    return res.json();
  },

  /** Add a new source to follow. */
  async addSource(source: { type: string; url: string; name?: string; frequency?: string }): Promise<SourceEntry> {
    const res = await fetch(url("/sources"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(source),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `Failed: ${res.status}`);
    }
    return res.json();
  },

  /** Remove a source. */
  async deleteSource(sourceId: number): Promise<void> {
    const res = await fetch(url(`/sources/${sourceId}`), {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to delete source: ${res.status}`);
  },

  /** Generate podcast audio from text. Returns a Blob (WAV). Pass onProgress for real-time progress (0-100). */
  async generatePodcast(
    text: string,
    options?: { onProgress?: (p: number) => void }
  ): Promise<Blob> {
    let progressClose: (() => void) | undefined;
    const headers: Record<string, string> = { "Content-Type": "application/json", ...authHeaders() };
    if (options?.onProgress) {
      const sub = subscribeProgress(options.onProgress);
      progressClose = sub.close;
      headers["X-Progress-Token"] = sub.token;
    }
    try {
      const res = await fetch(url("/podcast/generate"), {
        method: "POST",
        headers,
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Podcast generation failed: ${res.status}`);
      }
      return res.blob();
    } finally {
      progressClose?.();
    }
  },

  /** Generate podcast audio from multiple URLs. Returns a Blob (WAV). Pass onProgress for real-time progress (0-100). */
  async generatePodcastFromUrls(
    urls: string[],
    options?: { onProgress?: (p: number) => void }
  ): Promise<Blob> {
    let progressClose: (() => void) | undefined;
    const headers: Record<string, string> = { "Content-Type": "application/json", ...authHeaders() };
    if (options?.onProgress) {
      const sub = subscribeProgress(options.onProgress);
      progressClose = sub.close;
      headers["X-Progress-Token"] = sub.token;
    }
    try {
      const res = await fetch(url("/podcast/generate-from-urls"), {
        method: "POST",
        headers,
        body: JSON.stringify({ urls }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Podcast generation failed: ${res.status}`);
      }
      return res.blob();
    } finally {
      progressClose?.();
    }
  },

  /**
   * Generate personal briefing audio from the user's sources and topics.
   * Fetches content, summarizes with LLM, then TTS. Returns a Blob (WAV).
   * Pass onProgress for real-time progress (0-100).
   */
  async generatePersonalBriefingAudio(options?: {
    onProgress?: (p: number) => void;
  }): Promise<Blob> {
    let progressClose: (() => void) | undefined;
    const headers = { ...authHeaders() };
    if (options?.onProgress) {
      const sub = subscribeProgress(options.onProgress);
      progressClose = sub.close;
      (headers as Record<string, string>)["X-Progress-Token"] = sub.token;
    }
    try {
      const res = await fetch(url("/briefing/generate"), {
        method: "POST",
        headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Briefing generation failed: ${res.status}`);
      }
      return res.blob();
    } finally {
      progressClose?.();
    }
  },

  /** Get the saved transcript for the user's personal briefing. 404 if none. */
  async getPersonalBriefingTranscript(): Promise<{ transcript: string }> {
    const res = await fetch(url("/briefing/transcript"), { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 404) throw new Error("No transcript available");
      throw new Error(`Failed to fetch transcript: ${res.status}`);
    }
    return res.json();
  },

  /** Invalidate cached personal briefing so next generate returns fresh audio + transcript. */
  async invalidatePersonalBriefing(): Promise<void> {
    const res = await fetch(url("/briefing/invalidate"), {
      method: "POST",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to invalidate briefing: ${res.status}`);
  },
};

export interface SourceEntry {
  id: number;
  type: string;
  name: string | null;
  url: string;
  frequency: string;
  created_at: string | null;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  created_at: string | null;
}

export interface TopicPreference {
  id: number;
  topic: string;
  created_at: string | null;
}

/** Article from GET /feed/by-topics (Google News RSS). */
export interface FeedByTopicsArticle {
  url: string;
  title: string;
  published_at: string | null;
  source: string | null;
}

export interface FeedByTopicsTopic {
  topic: string;
  articles: FeedByTopicsArticle[];
}

export interface FeedByTopicsResponse {
  topics: FeedByTopicsTopic[];
  message?: string;
}

/** YouTube video from GET /feed/youtube-by-topics. */
export interface YoutubeFeedVideo {
  url: string;
  title: string;
  published_at: string | null;
  channel_title: string;
  view_count: number | null;
}

export interface YoutubeFeedByTopicsResponse {
  video: YoutubeFeedVideo | null;
  topic: string | null;
  message?: string;
  error?: string;
}

export interface BookmarkEntry {
  id: number;
  title: string;
  description: string | null;
  duration: string | null;
  topics: string[];
  summary: string | null;
  audio_url: string | null;
  created_at: string | null;
}

export interface BriefingEntry {
  id: number;
  title: string;
  url: string;
  source_type: string;
  source_url: string;
  published_at: string | null;
  error: string | null;
}
