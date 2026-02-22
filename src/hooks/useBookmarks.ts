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
        // Optimistic: remove from UI immediately
        const removed = existing;
        setBookmarks((prev) => prev.filter((b) => b.id !== removed.id));
        try {
          await api.deleteBookmark(removed.id);
        } catch {
          setBookmarks((prev) => [removed, ...prev]);
        }
        return;
      }
      // Optimistic: add placeholder so UI updates immediately
      const optimistic: BookmarkEntry = {
        id: -1,
        title: briefing.title,
        description: briefing.description ?? null,
        duration: briefing.duration ?? null,
        topics: briefing.topics ?? [],
        summary: null,
        audio_url: null,
        created_at: new Date().toISOString(),
      };
      setBookmarks((prev) => [optimistic, ...prev]);
      try {
        const created = await api.addBookmark({
          title: briefing.title,
          description: briefing.description,
          duration: briefing.duration,
          topics: briefing.topics,
          summary: undefined,
          audio_url: undefined,
        });
        setBookmarks((prev) => prev.map((b) => (b.id === -1 && b.title === briefing.title ? created : b)));
      } catch {
        setBookmarks((prev) => prev.filter((b) => !(b.id === -1 && b.title === briefing.title)));
      }
    },
    [user, bookmarks]
  );

  const removeBookmark = useCallback(async (bookmarkId: number) => {
    if (bookmarkId === -1) {
      setBookmarks((prev) => prev.filter((b) => b.id !== -1));
      return;
    }
    const removed = bookmarks.find((b) => b.id === bookmarkId);
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    try {
      await api.deleteBookmark(bookmarkId);
    } catch {
      if (removed) setBookmarks((prev) => [removed, ...prev]);
      else loadBookmarks();
    }
  }, [bookmarks, loadBookmarks]);

  return {
    bookmarks,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    loading,
    refetch: loadBookmarks,
  };
}
