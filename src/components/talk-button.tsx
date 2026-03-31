"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Mic, Square, Loader2 } from "lucide-react";

interface TalkButtonProps {
  isRecording: boolean;
  isLoading: boolean;
  duration: number;
  onStart: () => void;
  onStop: () => void;
}

export function TalkButton({
  isRecording,
  isLoading,
  duration,
  onStart,
  onStop,
}: TalkButtonProps) {
  const handleClick = useCallback(() => {
    if (isLoading) return;
    if (isRecording) {
      onStop();
    } else {
      onStart();
    }
  }, [isRecording, isLoading, onStart, onStop]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          "relative flex items-center justify-center rounded-full transition-all duration-300",
          "w-28 h-28 sm:w-32 sm:h-32",
          "focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2",
          isRecording && [
            "bg-red-500 hover:bg-red-600 text-white",
            "focus-visible:ring-red-400",
            "shadow-[0_0_40px_rgba(239,68,68,0.4)]",
          ],
          isLoading && [
            "bg-neutral-200 dark:bg-neutral-700 text-neutral-500",
            "cursor-not-allowed",
          ],
          !isRecording &&
            !isLoading && [
              "bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100",
              "text-white dark:text-neutral-900",
              "focus-visible:ring-neutral-400",
              "shadow-lg hover:shadow-xl",
              "hover:scale-105 active:scale-95",
            ]
        )}
        aria-label={isRecording ? "Zastavit nahrávání" : "Začít mluvit"}
      >
        {/* Pulsing ring animation when recording */}
        {isRecording && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20" />
            <span className="absolute inset-[-8px] rounded-full border-2 border-red-400 animate-pulse opacity-60" />
          </>
        )}

        {isLoading ? (
          <Loader2 className="w-10 h-10 animate-spin" />
        ) : isRecording ? (
          <Square className="w-10 h-10" fill="currentColor" />
        ) : (
          <Mic className="w-10 h-10" />
        )}
      </button>

      <div className="h-6 text-sm text-neutral-500 dark:text-neutral-400">
        {isRecording && (
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Nahrávání {formatDuration(duration)}
          </span>
        )}
        {isLoading && <span>Přemýšlím...</span>}
        {!isRecording && !isLoading && (
          <span>Klikni a začni mluvit</span>
        )}
      </div>
    </div>
  );
}
