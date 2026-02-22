import { useState, useCallback, useEffect } from "react";
import { api, type TopicPreference } from "../lib/api";
import { useAuth } from "./useAuth";

const LOCAL_KEY_PREFIX = "briefcast_topics_local_";

function localKey(email: string | undefined) {
  return `${LOCAL_KEY_PREFIX}${email ?? "guest"}`;
}

function loadLocal(key: string): TopicPreference[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveLocal(key: string, items: TopicPreference[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

let nextLocalId = -1;

export function usePreferencesTopics() {
  const { user } = useAuth();
  const key = localKey(user?.email);
  const [topics, setTopics] = useState<TopicPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [useLocal, setUseLocal] = useState(false);

  const loadTopics = useCallback(async () => {
    if (!user) {
      setTopics([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await api.getPreferencesTopics();
      setTopics(list);
      // Sync API topics to local storage as backup
      saveLocal(key, list);
      setUseLocal(false);
    } catch {
      // Fallback to localStorage
      const local = loadLocal(key);
      setTopics(local);
      setUseLocal(true);
    } finally {
      setLoading(false);
    }
  }, [user, key]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const addTopic = useCallback(
    async (topic: string) => {
      if (!user) return;
      try {
        const created = await api.addPreferencesTopic(topic);
        setTopics((prev) => {
          const next = [created, ...prev];
          saveLocal(key, next);
          return next;
        });
        return created;
      } catch {
        // Fallback: save locally
        const localEntry: TopicPreference = { id: nextLocalId--, topic, created_at: new Date().toISOString() };
        setTopics((prev) => {
          const next = [localEntry, ...prev];
          saveLocal(key, next);
          return next;
        });
        setUseLocal(true);
        return localEntry;
      }
    },
    [user, key]
  );

  const removeTopic = useCallback(
    async (topicId: number) => {
      // Try API first, but always update local state
      try {
        if (topicId > 0) {
          await api.deletePreferencesTopic(topicId);
        }
      } catch {
        // continue with local removal
      }
      setTopics((prev) => {
        const next = prev.filter((t) => t.id !== topicId);
        saveLocal(key, next);
        return next;
      });
    },
    [key]
  );

  const isTopicSelected = useCallback(
    (topic: string) => topics.some((t) => t.topic.toLowerCase() === topic.toLowerCase()),
    [topics]
  );

  return { topics, addTopic, removeTopic, isTopicSelected, loading, refetch: loadTopics };
}
