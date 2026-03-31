"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface OnboardingProgress {
  isOnboarding: boolean;
  currentStep: number;
  totalSteps: number;
  stepId: string;
  stepLabel: string;
}

interface UseChatOptions {
  userId: string;
}

interface SendOptions {
  activeTopicId?: string;
  mode?: "normal" | "daily_routine";
  routineId?: string;
}

function getSessionStorageKey(userId: string) {
  return `terapeut_session_id_${userId}`;
}

export function useChat({ userId }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<string>("mixed");
  const [onboardingProgress, setOnboardingProgress] =
    useState<OnboardingProgress | null>(null);
  const [coachingSummary, setCoachingSummary] = useState<{
    activeTasks: number;
    completedTasks: number;
    topicCount: number;
    activeTopicId?: string | null;
    activeTopicTitle?: string | null;
  } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMutedRef = useRef(false);

  // Restore session when user changes/reloads app.
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const persistedSessionId = localStorage.getItem(getSessionStorageKey(userId));
    if (persistedSessionId) {
      setSessionId(persistedSessionId);
    } else {
      setSessionId(null);
    }
    setMessages([]);
    setOnboardingProgress(null);
  }, [userId]);

  const persistSessionId = useCallback(
    (nextSessionId: string) => {
      setSessionId(nextSessionId);
      if (userId && typeof window !== "undefined") {
        localStorage.setItem(getSessionStorageKey(userId), nextSessionId);
      }
    },
    [userId]
  );

  const setMuted = useCallback((muted: boolean) => {
    isMutedRef.current = muted;
    if (muted && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const sendAudio = useCallback(
    async (audioBlob: Blob, options?: SendOptions) => {
      if (!userId) return;
      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("userId", userId);
        formData.append("audio", audioBlob, "recording.webm");
        if (sessionId) formData.append("sessionId", sessionId);
        if (options?.activeTopicId) {
          formData.append("activeTopicId", options.activeTopicId);
        }
        if (options?.mode) {
          formData.append("mode", options.mode);
        }
        if (options?.routineId) {
          formData.append("routineId", options.routineId);
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail ?? data.error ?? "Chat request failed");
        }

        if (data.sessionId && sessionId !== data.sessionId) {
          persistSessionId(data.sessionId);
        }
        setCurrentMode(data.mode);
        setOnboardingProgress(data.onboardingProgress ?? null);
        setCoachingSummary(data.coachingSummary ?? null);

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: data.transcript,
            timestamp: new Date(),
          },
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.responseText,
            timestamp: new Date(),
          },
        ]);

        if (!isMutedRef.current) {
          playTTS(data.responseText);
        }

        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Něco se pokazilo";
        setError(msg);
        console.error("sendAudio error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, sessionId, persistSessionId]
  );

  const sendText = useCallback(
    async (text: string, options?: SendOptions) => {
      if (!userId) return;
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            text,
            sessionId,
            activeTopicId: options?.activeTopicId,
            mode: options?.mode,
            routineId: options?.routineId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail ?? data.error ?? "Chat request failed");
        }

        if (data.sessionId && sessionId !== data.sessionId) {
          persistSessionId(data.sessionId);
        }
        setCurrentMode(data.mode);
        setOnboardingProgress(data.onboardingProgress ?? null);
        setCoachingSummary(data.coachingSummary ?? null);

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: text,
            timestamp: new Date(),
          },
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.responseText,
            timestamp: new Date(),
          },
        ]);

        if (!isMutedRef.current) {
          playTTS(data.responseText);
        }

        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Něco se pokazilo";
        setError(msg);
        console.error("sendText error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, sessionId, persistSessionId]
  );

  const playTTS = useCallback(async (text: string) => {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) return;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      await audio.play();
    } catch (err) {
      console.error("TTS playback failed:", err);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const clearSession = useCallback(() => {
    if (userId && typeof window !== "undefined") {
      localStorage.removeItem(getSessionStorageKey(userId));
    }
    setSessionId(null);
    setOnboardingProgress(null);
    setCoachingSummary(null);
    setMessages([]);
  }, [userId]);

  return {
    messages,
    isLoading,
    error,
    sessionId,
    currentMode,
    onboardingProgress,
    coachingSummary,
    sendAudio,
    sendText,
    setMuted,
    clearError,
    clearSession,
  };
}
