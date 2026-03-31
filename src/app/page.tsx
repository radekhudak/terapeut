"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { TalkButton } from "@/components/talk-button";
import { ChatMessages } from "@/components/chat-messages";
import { ModeIndicator } from "@/components/mode-indicator";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useChat } from "@/hooks/use-chat";
import { useUser } from "@/hooks/use-user";
import {
  Volume2,
  VolumeX,
  MessageSquare,
  Loader2,
  UserPlus,
  X,
  Mic,
} from "lucide-react";

export default function Home() {
  const { user, isLoading: userLoading, resetUser } = useUser();
  const [isMuted, setIsMuted] = useState(false);
  const [inputMode, setInputMode] = useState<"voice" | "text">("text");
  const [textInput, setTextInput] = useState("");
  const sentBlobRef = useRef<Blob | null>(null);
  const onboardingStartedRef = useRef(false);

  const recorder = useAudioRecorder();
  const chat = useChat({ userId: user?.id ?? "" });

  // Sync mute state to chat hook
  useEffect(() => {
    chat.setMuted(isMuted);
  }, [isMuted, chat]);

  // Auto-start onboarding for new users
  useEffect(() => {
    if (
      user &&
      !userLoading &&
      chat.messages.length === 0 &&
      !chat.isLoading &&
      !onboardingStartedRef.current
    ) {
      onboardingStartedRef.current = true;
      chat.sendText("Začínám.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading]);

  const handleStartRecording = useCallback(async () => {
    if (!user) return;
    try {
      await recorder.startRecording();
    } catch {
      alert(
        "Nepodařilo se získat přístup k mikrofonu. Povolte ho v nastavení prohlížeče."
      );
    }
  }, [recorder, user]);

  const handleStopRecording = useCallback(() => {
    recorder.stopRecording();
  }, [recorder]);

  // Auto-send audio when recording stops
  useEffect(() => {
    if (recorder.audioBlob && recorder.audioBlob !== sentBlobRef.current) {
      sentBlobRef.current = recorder.audioBlob;
      chat
        .sendAudio(recorder.audioBlob)
        .catch(() => {})
        .finally(() => recorder.resetRecording());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.audioBlob]);

  const handleSendText = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!textInput.trim()) return;
      const text = textInput;
      setTextInput("");
      await chat.sendText(text);
    },
    [textInput, chat]
  );

  const handleNewUser = useCallback(async () => {
    if (confirm("Vytvořit nový profil? Aktuální konverzace se ztratí.")) {
      onboardingStartedRef.current = false;
      await resetUser();
      window.location.reload();
    }
  }, [resetUser]);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-dvh px-8 text-center">
        <p className="text-neutral-500">
          Nepodařilo se vytvořit uživatele. Zkuste obnovit stránku.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh max-w-lg mx-auto w-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Terapeut</h1>
          <ModeIndicator mode={chat.currentMode} />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewUser}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Nový uživatel"
            title="Nový profil"
          >
            <UserPlus className="w-5 h-5 text-neutral-500" />
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label={isMuted ? "Zapnout zvuk" : "Ztlumit"}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-neutral-500" />
            ) : (
              <Volume2 className="w-5 h-5 text-neutral-500" />
            )}
          </button>
          <button
            onClick={() =>
              setInputMode((m) => (m === "voice" ? "text" : "voice"))
            }
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label={inputMode === "voice" ? "Psát textem" : "Mluvit"}
          >
            {inputMode === "voice" ? (
              <MessageSquare className="w-5 h-5 text-neutral-500" />
            ) : (
              <Mic className="w-5 h-5 text-neutral-500" />
            )}
          </button>
        </div>
      </header>

      {/* Error banner */}
      {chat.error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 flex items-center justify-between gap-2">
          <p className="text-sm text-red-600 dark:text-red-400 flex-1">
            {chat.error}
          </p>
          <button onClick={chat.clearError} className="flex-shrink-0">
            <X className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )}

      <ChatMessages messages={chat.messages} isLoading={chat.isLoading} />

      <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-4 space-y-3">
        {inputMode === "text" ? (
          <form onSubmit={handleSendText} className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Napiš odpověď..."
              className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-transparent px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600"
              disabled={chat.isLoading}
              autoFocus
            />
            <button
              type="submit"
              disabled={!textInput.trim() || chat.isLoading}
              className="px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              Odeslat
            </button>
          </form>
        ) : (
          <TalkButton
            isRecording={recorder.isRecording}
            isLoading={chat.isLoading}
            duration={recorder.duration}
            onStart={handleStartRecording}
            onStop={handleStopRecording}
          />
        )}
      </div>
    </div>
  );
}
