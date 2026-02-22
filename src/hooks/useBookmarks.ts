import { useBookmarkContext } from "../contexts/BookmarkContext";

export type { BookmarkedBriefing } from "../contexts/BookmarkContext";

export function useBookmarks() {
  return useBookmarkContext();
}
