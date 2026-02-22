import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./useAuth";

/** Local-only favourites: region and interest. Topic and source come from API (usePreferencesTopics, useSources). */
export interface FavouriteItem {
  id: string;
  type: "region" | "interest";
  label: string;
  emoji?: string;
  desc?: string;
  url?: string;
  platform?: string;
}

const STORAGE_PREFIX = "briefcast_favourites_local_";

function storageKey(email: string | undefined): string {
  return `${STORAGE_PREFIX}${email ?? "guest"}`;
}

function load(key: string): FavouriteItem[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function save(key: string, items: FavouriteItem[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

export function useFavourites() {
  const { user } = useAuth();
  const key = storageKey(user?.email);
  const [favourites, setFavourites] = useState<FavouriteItem[]>(() => load(key));

  useEffect(() => {
    setFavourites(load(key));
  }, [key]);

  const addFavourite = useCallback(
    (item: FavouriteItem) => {
      setFavourites((prev) => {
        if (prev.some((f) => f.id === item.id && f.type === item.type)) return prev;
        const next = [...prev, item];
        save(key, next);
        return next;
      });
    },
    [key]
  );

  const removeFavourite = useCallback(
    (id: string, type: string) => {
      setFavourites((prev) => {
        const next = prev.filter((f) => !(f.id === id && f.type === type));
        save(key, next);
        return next;
      });
    },
    [key]
  );

  const isFavourite = useCallback(
    (id: string, type: string) => favourites.some((f) => f.id === id && f.type === type),
    [favourites]
  );

  return { favourites, addFavourite, removeFavourite, isFavourite };
}
