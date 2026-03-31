"use client";

import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface UseChatOptions {
  userId: string;
}

export function useChat({ userId }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<string>("mixed");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMutedRef = useRef(false);

  const setMuted = useCallback((muted: boolean) => {
    isMutedRef.current = muted;
    if (muted && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const sendAudio = useCallback(
    async (audioBlob: Blob) => {
      if (!userId) return;
      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("userId", userId);
        formData.append("audio", audioBlob, "recording.webm");
        if (sessionId) formData.append("sessionId", sessionId);

        const response = await fetch("/api/chat", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail ?? data.error ?? "Chat request failed");
        }

        if (!sessionId) setSessionId(data.sessionId);
        setCurrentMode(data.mode);

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
    [userId, sessionId]
  );

  const sendText = useCallback(
    async (text: string) => {
      if (!userId) return;
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, text, sessionId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail ?? data.error ?? "Chat request failed");
        }

        if (!sessionId) setSessionId(data.sessionId);
        setCurrentMode(data.mode);

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
    [userId, sessionId]
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

  return {
    messages,
    isLoading,
    error,
    sessionId,
    currentMode,
    sendAudio,
    sendText,
    setMuted,
    clearError,
  };
}
