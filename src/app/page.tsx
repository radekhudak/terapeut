"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { TalkButton } from "@/components/talk-button";
import { ChatMessages } from "@/components/chat-messages";
import { ModeIndicator } from "@/components/mode-indicator";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useChat } from "@/hooks/use-chat";
import { useUser } from "@/hooks/use-user";
import { Volume2, VolumeX, MessageSquare, Target, Loader2 } from "lucide-react";

export default function Home() {
  const { user, isLoading: userLoading } = useUser();
  const [isMuted, setIsMuted] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const sentBlobRef = useRef<Blob | null>(null);

  const recorder = useAudioRecorder();
  const chat = useChat({ userId: user?.id ?? "" });

  const handleStartRecording = useCallback(async () => {
    try {
      await recorder.startRecording();
    } catch {
      alert(
        "Nepodařilo se získat přístup k mikrofonu. Povolte ho v nastavení prohlížeče."
      );
    }
  }, [recorder]);

  const handleStopRecording = useCallback(() => {
    recorder.stopRecording();
  }, [recorder]);

  useEffect(() => {
    if (recorder.audioBlob && recorder.audioBlob !== sentBlobRef.current) {
      sentBlobRef.current = recorder.audioBlob;
      chat.sendAudio(recorder.audioBlob).then(() => recorder.resetRecording());
    }
  }, [recorder.audioBlob, chat, recorder]);

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
        <div className="flex items-center gap-2">
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
            onClick={() => setShowTextInput(!showTextInput)}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Psát textem"
          >
            <MessageSquare className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
      </header>

      {chat.messages.length > 0 ? (
        <ChatMessages messages={chat.messages} isLoading={chat.isLoading} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            <Target className="w-8 h-8 text-neutral-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Ahoj!</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
              Jsem tvůj osobní terapeut a kouč.
              <br />
              Zmáčkni tlačítko a začni mluvit.
            </p>
          </div>
        </div>
      )}

      <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-6 space-y-4">
        {showTextInput && (
          <form onSubmit={handleSendText} className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Napiš zprávu..."
              className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-transparent px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600"
              disabled={chat.isLoading}
            />
            <button
              type="submit"
              disabled={!textInput.trim() || chat.isLoading}
              className="px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              Odeslat
            </button>
          </form>
        )}

        <TalkButton
          isRecording={recorder.isRecording}
          isLoading={chat.isLoading}
          duration={recorder.duration}
          onStart={handleStartRecording}
          onStop={handleStopRecording}
        />
      </div>
    </div>
  );
}
