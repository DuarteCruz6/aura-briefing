/**
 * Backend API client. Base URL is set via VITE_API_URL:
 * - Development: http://localhost:8000 (frontend on 8080, backend on 8000)
 * - Production (served by backend): leave empty for same-origin
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
};
