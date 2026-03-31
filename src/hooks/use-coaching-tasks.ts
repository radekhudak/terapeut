"use client";

import { useCallback, useEffect, useState } from "react";

export interface CoachingTask {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done" | "skipped";
  priority: "low" | "medium" | "high";
  progressPct: number;
  dueDate: string | null;
}

export function useCoachingTasks(userId: string) {
  const [tasks, setTasks] = useState<CoachingTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coaching/tasks?userId=${userId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load tasks");
      setTasks((data.tasks ?? []) as CoachingTask[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const createTask = useCallback(
    async (payload: { title: string; description?: string }) => {
      if (!userId) return null;
      const res = await fetch("/api/coaching/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create task");
      await refresh();
      return data.task as CoachingTask;
    },
    [refresh, userId]
  );

  const updateTask = useCallback(
    async (
      taskId: string,
      patch: Partial<
        Pick<
          CoachingTask,
          "title" | "description" | "status" | "priority" | "progressPct"
        >
      >
    ) => {
      if (!userId) return null;
      const res = await fetch("/api/coaching/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, taskId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update task");
      await refresh();
      return data.task as CoachingTask;
    },
    [refresh, userId]
  );

  useEffect(() => {
    if (!userId) return;
    refresh();
  }, [userId, refresh]);

  return {
    tasks,
    isLoading,
    error,
    refresh,
    createTask,
    updateTask,
  };
}
