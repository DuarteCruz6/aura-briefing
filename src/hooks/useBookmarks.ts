import { useState, useCallback, useEffect } from "react";
import { api, type BookmarkEntry } from "../lib/api";

export interface BookmarkedBriefing {
  title: string;
  description: string;
  duration: string;
  topics: string[];
  confidence: number;
  bookmarkedAt: string;
}

function toBookmarkedBriefing(b: BookmarkEntry): BookmarkedBriefing {
  return {
    title: b.title,
    description: b.description ?? "",
    duration: b.duration ?? "",
    topics: b.topics ?? [],
    confidence: 85,
    bookmarkedAt: b.created_at ?? new Date().toISOString(),
  };
}

export function useBookmarks() {
  const [entries, setEntries] = useState<BookmarkEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBookmarks = useCallback(() => {
    api
      .getBookmarks()
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const bookmarks = entries.map(toBookmarkedBriefing);

  const isBookmarked = useCallback(
    (title: string) => entries.some((b) => b.title === title),
    [entries]
  );

  const toggleBookmark = useCallback(
    (briefing: Omit<BookmarkedBriefing, "bookmarkedAt">) => {
      const existing = entries.find((b) => b.title === briefing.title);
      if (existing) {
        api
          .deleteBookmark(existing.id)
          .then(() => setEntries((prev) => prev.filter((b) => b.title !== briefing.title)))
          .catch(() => {});
      } else {
        api
          .addBookmark({
            title: briefing.title,
            description: briefing.description || undefined,
            duration: briefing.duration || undefined,
            topics: briefing.topics,
            summary: undefined,
            audio_url: undefined,
          })
          .then((created) => setEntries((prev) => [...prev, created]))
          .catch(() => {});
      }
    },
    [entries]
  );

  const removeBookmark = useCallback((title: string) => {
    const existing = entries.find((b) => b.title === title);
    if (existing) {
      api.deleteBookmark(existing.id).then(() => setEntries((prev) => prev.filter((b) => b.title !== title))).catch(() => {});
    }
  }, [entries]);

  return { bookmarks, isBookmarked, toggleBookmark, removeBookmark, loading };
}
