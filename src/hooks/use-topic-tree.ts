"use client";

import { useCallback, useEffect, useState } from "react";

export interface TopicNote {
  id: string;
  noteType: "key_thought" | "milestone" | "user_note";
  content: string;
  createdAt: string;
}

export interface TopicNode {
  id: string;
  parentId: string | null;
  title: string;
  progressPct: number;
  notes: TopicNote[];
}

export function useTopicTree(userId: string) {
  const [topics, setTopics] = useState<TopicNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coaching/topics?userId=${userId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load topics");
      setTopics((data.topics ?? []) as TopicNode[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load topics");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const createTopic = useCallback(
    async (title: string, parentId?: string | null) => {
      const res = await fetch("/api/coaching/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, title, parentId: parentId ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create topic");
      await refresh();
      return data.topic as TopicNode;
    },
    [refresh, userId]
  );

  const updateTopic = useCallback(
    async (
      topicId: string,
      patch: { title?: string; progressPct?: number }
    ) => {
      const res = await fetch("/api/coaching/topics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, topicId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update topic");
      await refresh();
      return data.topic as TopicNode;
    },
    [refresh, userId]
  );

  const addNote = useCallback(
    async (
      topicId: string,
      content: string,
      noteType: "key_thought" | "milestone" | "user_note" = "user_note"
    ) => {
      const res = await fetch("/api/coaching/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addNote",
          userId,
          topicId,
          noteType,
          content,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add note");
      await refresh();
      return data.note as TopicNote;
    },
    [refresh, userId]
  );

  useEffect(() => {
    if (!userId) return;
    refresh();
  }, [refresh, userId]);

  return {
    topics,
    isLoading,
    error,
    refresh,
    createTopic,
    updateTopic,
    addNote,
  };
}
