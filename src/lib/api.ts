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

  /** List all followed sources. */
  async getSources(): Promise<SourceEntry[]> {
    const res = await fetch(url("/sources"));
    if (!res.ok) throw new Error(`Failed to fetch sources: ${res.status}`);
    return res.json();
  },

  /** Add a new source to follow. */
  async addSource(source: { type: string; url: string; name?: string; frequency?: string }): Promise<SourceEntry> {
    const res = await fetch(url("/sources"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const res = await fetch(url(`/sources/${sourceId}`), { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete source: ${res.status}`);
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
