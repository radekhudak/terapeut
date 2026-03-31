"use client";

import { useCallback, useEffect, useState } from "react";

interface DailyRoutine {
  id: string;
  routineDate: string;
  completed: boolean;
  topicsCovered: string[];
  questions: Array<{
    topicId: string;
    question: string;
    followUpHint?: string | null;
  }>;
}

export function useDailyRoutine(userId: string) {
  const [needsRoutine, setNeedsRoutine] = useState(false);
  const [routine, setRoutine] = useState<DailyRoutine | null>(null);
  const [motivationalNote, setMotivationalNote] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkNeed = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`/api/coaching/daily-routine?userId=${userId}&check=1`);
    const data = await res.json();
    if (res.ok) setNeedsRoutine(Boolean(data.needed));
  }, [userId]);

  const startRoutine = useCallback(async () => {
    if (!userId) return null;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/coaching/daily-routine?userId=${userId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load routine");
      setRoutine(data.routine as DailyRoutine);
      setMotivationalNote((data.motivationalNote as string | undefined) ?? null);
      setNeedsRoutine(Boolean(data.routine && !data.routine.completed));
      return data.routine as DailyRoutine;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const completeRoutine = useCallback(async () => {
    if (!userId || !routine) return null;
    const res = await fetch("/api/coaching/daily-routine/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, routineId: routine.id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to complete routine");
    setRoutine(data.routine as DailyRoutine);
    setNeedsRoutine(false);
    return data.routine as DailyRoutine;
  }, [routine, userId]);

  useEffect(() => {
    if (!userId) return;
    checkNeed().catch(() => {});
  }, [checkNeed, userId]);

  return {
    needsRoutine,
    routine,
    motivationalNote,
    isLoading,
    checkNeed,
    startRoutine,
    completeRoutine,
  };
}
