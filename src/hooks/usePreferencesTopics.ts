import { useState, useCallback, useEffect } from "react";
import { api, type TopicPreference } from "../lib/api";
import { useAuth } from "./useAuth";

export function usePreferencesTopics() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<TopicPreference[]>([]);
  const [loading, setLoading] = useState(true);

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
    } catch {
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const addTopic = useCallback(
    async (topic: string) => {
      if (!user) return;
      try {
        const created = await api.addPreferencesTopic(topic);
        setTopics((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        throw err;
      }
    },
    [user]
  );

  const removeTopic = useCallback(async (topicId: number) => {
    try {
      await api.deletePreferencesTopic(topicId);
      setTopics((prev) => prev.filter((t) => t.id !== topicId));
    } catch {
      // keep state unchanged on error
    }
  }, []);

  const isTopicSelected = useCallback(
    (topic: string) => topics.some((t) => t.topic.toLowerCase() === topic.toLowerCase()),
    [topics]
  );

  return { topics, addTopic, removeTopic, isTopicSelected, loading, refetch: loadTopics };
}
