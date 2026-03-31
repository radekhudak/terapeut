"use client";

import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

interface UseChatOptions {
  userId: string;
}

export function useChat({ userId }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<string>("mixed");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const sendAudio = useCallback(
    async (audioBlob: Blob) => {
      setIsLoading(true);

      try {
        const formData = new FormData();
        formData.append("userId", userId);
        formData.append("audio", audioBlob, "recording.webm");
        if (sessionId) formData.append("sessionId", sessionId);

        const response = await fetch("/api/chat", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Chat request failed");

        const data = await response.json();

        if (!sessionId) setSessionId(data.sessionId);
        setCurrentMode(data.mode);

        const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: data.transcript,
          timestamp: new Date(),
        };

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.responseText,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg, assistantMsg]);

        // Generate TTS and play
        await playTTS(data.responseText);

        return data;
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, sessionId]
  );

  const sendText = useCallback(
    async (text: string) => {
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, text, sessionId }),
        });

        if (!response.ok) throw new Error("Chat request failed");

        const data = await response.json();

        if (!sessionId) setSessionId(data.sessionId);
        setCurrentMode(data.mode);

        const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
          timestamp: new Date(),
        };

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.responseText,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg, assistantMsg]);

        await playTTS(data.responseText);

        return data;
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

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      await audio.play();
    } catch (error) {
      console.error("TTS playback failed:", error);
    }
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  return {
    messages,
    isLoading,
    sessionId,
    currentMode,
    sendAudio,
    sendText,
    stopPlayback,
  };
}
