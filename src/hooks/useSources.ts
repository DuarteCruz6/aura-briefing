import { useState, useCallback, useEffect } from "react";
import { api, type SourceEntry } from "../lib/api";
import { useAuth } from "./useAuth";

export function useSources() {
  const { user } = useAuth();
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSources = useCallback(async () => {
    if (!user) {
      setSources([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await api.getSources();
      setSources(list);
    } catch {
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const addSource = useCallback(
    async (source: { type: string; url: string; name?: string; frequency?: string }) => {
      if (!user) return;
      try {
        const created = await api.addSource(source);
        setSources((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        throw err;
      }
    },
    [user]
  );

  const deleteSource = useCallback(async (sourceId: number) => {
    try {
      await api.deleteSource(sourceId);
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
    } catch {
      // keep state unchanged on error
    }
  }, []);

  const isSourceAdded = useCallback(
    (url: string) => sources.some((s) => s.url === url || s.url?.replace(/\/$/, "") === url?.replace(/\/$/, "")),
    [sources]
  );

  return { sources, addSource, deleteSource, isSourceAdded, loading, refetch: loadSources };
}
