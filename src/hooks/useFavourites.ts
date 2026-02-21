import { useState, useCallback } from "react";

export interface FavouriteItem {
  id: string;
  type: "topic" | "region" | "interest" | "source";
  label: string;
  emoji?: string;
  desc?: string;
  url?: string;
  platform?: string;
}

const STORAGE_KEY = "briefcast_favourites";

function load(): FavouriteItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(items: FavouriteItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useFavourites() {
  const [favourites, setFavourites] = useState<FavouriteItem[]>(load);

  const addFavourite = useCallback((item: FavouriteItem) => {
    setFavourites((prev) => {
      if (prev.some((f) => f.id === item.id && f.type === item.type)) return prev;
      const next = [...prev, item];
      save(next);
      return next;
    });
  }, []);

  const removeFavourite = useCallback((id: string, type: string) => {
    setFavourites((prev) => {
      const next = prev.filter((f) => !(f.id === id && f.type === type));
      save(next);
      return next;
    });
  }, []);

  const isFavourite = useCallback(
    (id: string, type: string) => favourites.some((f) => f.id === id && f.type === type),
    [favourites]
  );

  return { favourites, addFavourite, removeFavourite, isFavourite };
}
