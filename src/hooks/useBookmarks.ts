import { useState, useCallback, useEffect } from "react";
import { api, type BookmarkEntry } from "../lib/api";
import { useAuth } from "./useAuth";

export interface BookmarkedBriefing {
  id?: number;
  title: string;
  description: string;
  duration: string;
  topics: string[];
  confidence: number;
  bookmarkedAt?: string;
}

export function useBookmarks() {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBookmarks = useCallback(async () => {
    if (!user) {
      setBookmarks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await api.getBookmarks();
      setBookmarks(list);
    } catch {
      setBookmarks([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const isBookmarked = useCallback(
    (title: string) => bookmarks.some((b) => b.title === title),
    [bookmarks]
  );

  const toggleBookmark = useCallback(
    async (briefing: Omit<BookmarkedBriefing, "bookmarkedAt" | "id">) => {
      if (!user) return;
      const existing = bookmarks.find((b) => b.title === briefing.title);
      if (existing) {
        try {
          await api.deleteBookmark(existing.id);
          setBookmarks((prev) => prev.filter((b) => b.id !== existing.id));
        } catch {
          // keep state unchanged on error
        }
        return;
      }
      try {
        const created = await api.addBookmark({
          title: briefing.title,
          description: briefing.description,
          duration: briefing.duration,
          topics: briefing.topics,
          summary: undefined,
          audio_url: undefined,
        });
        setBookmarks((prev) => [created, ...prev]);
      } catch {
        // keep state unchanged on error
      }
    },
    [user, bookmarks]
  );

  const removeBookmark = useCallback(async (bookmarkId: number) => {
    try {
      await api.deleteBookmark(bookmarkId);
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    } catch {
      // keep state unchanged on error
    }
  }, []);

  return {
    bookmarks,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    loading,
    refetch: loadBookmarks,
  };
}
