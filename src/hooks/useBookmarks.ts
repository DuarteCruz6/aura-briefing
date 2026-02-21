import { useState, useCallback, useEffect } from "react";

export interface BookmarkedBriefing {
  title: string;
  description: string;
  duration: string;
  topics: string[];
  confidence: number;
  bookmarkedAt: string;
}

const STORAGE_KEY = "briefcast_bookmarks";

function loadBookmarks(): BookmarkedBriefing[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkedBriefing[]>(loadBookmarks);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  const isBookmarked = useCallback(
    (title: string) => bookmarks.some((b) => b.title === title),
    [bookmarks]
  );

  const toggleBookmark = useCallback(
    (briefing: Omit<BookmarkedBriefing, "bookmarkedAt">) => {
      setBookmarks((prev) => {
        if (prev.some((b) => b.title === briefing.title)) {
          return prev.filter((b) => b.title !== briefing.title);
        }
        return [...prev, { ...briefing, bookmarkedAt: new Date().toISOString() }];
      });
    },
    []
  );

  const removeBookmark = useCallback((title: string) => {
    setBookmarks((prev) => prev.filter((b) => b.title !== title));
  }, []);

  return { bookmarks, isBookmarked, toggleBookmark, removeBookmark };
}
