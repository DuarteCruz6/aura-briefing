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

  /** Get or create user by email (call after login/signup). */
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

  /**
   * Generate video briefing (TTS + simple visual). Premium only; send isPremium true to set header.
   * Returns blob for the MP4 file.
   */
  async generateVideo(
    payload: { title: string; summary: string },
    isPremium: boolean
  ): Promise<Blob> {
    const res = await fetch(url("/video/generate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(isPremium ? { "X-Premium": "true" } : {}),
      },
      body: JSON.stringify({
        title: payload.title,
        summary: payload.summary,
      }),
    });
    if (res.status === 403) {
      throw new Error("Premium subscription required to generate video briefings");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `Video generation failed: ${res.status}`);
    }
    return res.blob();
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
