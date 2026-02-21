import { useState, useCallback } from "react";

export interface BookmarkedBriefing {
  title: string;
  description: string;
  duration: string;
  topics: string[];
  confidence: number;
  bookmarkedAt: string;
}

const STORAGE_KEY = "briefcast_bookmarks";

function load(): BookmarkedBriefing[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(items: BookmarkedBriefing[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkedBriefing[]>(load);

  const isBookmarked = useCallback(
    (title: string) => bookmarks.some((b) => b.title === title),
    [bookmarks]
  );

  const toggleBookmark = useCallback(
    (briefing: Omit<BookmarkedBriefing, "bookmarkedAt">) => {
      setBookmarks((prev) => {
        const exists = prev.some((b) => b.title === briefing.title);
        const next = exists
          ? prev.filter((b) => b.title !== briefing.title)
          : [...prev, { ...briefing, bookmarkedAt: new Date().toISOString() }];
        save(next);
        return next;
      });
    },
    []
  );

  const removeBookmark = useCallback((title: string) => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.title !== title);
      save(next);
      return next;
    });
  }, []);

  return { bookmarks, isBookmarked, toggleBookmark, removeBookmark, loading: false };
}
