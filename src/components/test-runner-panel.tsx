"use client";

import { useState } from "react";
import { DEFAULT_PERSONAS } from "@/lib/test-personas";
import type { TestPersona } from "@/lib/test-personas";
import type { TestRunnerPhase } from "@/hooks/use-test-runner";
import { Play, Pause, Square, MessageSquare, Zap } from "lucide-react";

interface TestRunnerPanelProps {
  phase: TestRunnerPhase;
  persona: TestPersona | null;
  stepCount: number;
  speed: number;
  error: string | null;
  stopReason: string | null;
  onboardingProgress: {
    isOnboarding: boolean;
    currentStep: number;
    totalSteps: number;
    stepId: string;
    stepLabel: string;
  } | null;
  onStart: (persona: TestPersona) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onInject: (text: string) => void;
  onUpdatePrompt: (prompt: string) => void;
  onSetSpeed: (ms: number) => void;
}

const PHASE_LABELS: Record<TestRunnerPhase, string> = {
  idle: "Neaktivní",
  creating_user: "Vytváří uživatele...",
  onboarding: "Onboarding",
  free_chat: "Volná konverzace",
  daily_routine: "Denní rutina",
  paused: "Pozastaveno",
  completed: "Dokončeno",
  stopped: "Zastaveno",
  error: "Chyba",
};

const PHASE_COLORS: Record<TestRunnerPhase, string> = {
  idle: "bg-gray-500",
  creating_user: "bg-yellow-500",
  onboarding: "bg-blue-500",
  free_chat: "bg-green-500",
  daily_routine: "bg-purple-500",
  paused: "bg-yellow-500",
  completed: "bg-green-600",
  stopped: "bg-red-500",
  error: "bg-red-600",
};

export function TestRunnerPanel({
  phase,
  persona,
  stepCount,
  speed,
  error,
  stopReason,
  onboardingProgress,
  onStart,
  onPause,
  onResume,
  onStop,
  onInject,
  onUpdatePrompt,
  onSetSpeed,
}: TestRunnerPanelProps) {
  const [injectText, setInjectText] = useState("");
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");

  const isRunning =
    phase === "onboarding" ||
    phase === "free_chat" ||
    phase === "daily_routine" ||
    phase === "creating_user";
  const canStart = phase === "idle" || phase === "completed" || phase === "stopped" || phase === "error";

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-900 rounded-lg border border-gray-700 h-full overflow-y-auto">
      <h2 className="text-lg font-bold text-white">Test Runner</h2>

      {/* Persona selection */}
      {canStart && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400">Vyber personu:</h3>
          <div className="grid gap-2">
            {DEFAULT_PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => onStart(p)}
                className="text-left p-3 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 transition-colors"
              >
                <div className="font-medium text-white">
                  {p.name}, {p.age} - {p.label}
                </div>
                <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                  {p.systemPrompt}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status bar */}
      {phase !== "idle" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${PHASE_COLORS[phase]} ${isRunning ? "animate-pulse" : ""}`}
            />
            <span className="text-sm text-white font-medium">
              {PHASE_LABELS[phase]}
            </span>
            {onboardingProgress?.isOnboarding && (
              <span className="text-xs text-gray-400">
                (krok {onboardingProgress.currentStep}/{onboardingProgress.totalSteps}: {onboardingProgress.stepLabel})
              </span>
            )}
          </div>

          {persona && (
            <div className="text-xs text-gray-500">
              {persona.name} ({persona.label}) | Kroky: {stepCount}
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-900/30 p-2 rounded">
              {error}
            </div>
          )}
          {stopReason && phase === "stopped" && (
            <div className="text-xs text-yellow-400 bg-yellow-900/30 p-2 rounded">
              Důvod zastavení: {stopReason}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      {phase !== "idle" && (
        <div className="flex gap-2">
          {isRunning && (
            <button
              onClick={onPause}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-yellow-600 hover:bg-yellow-500 text-white rounded transition-colors"
            >
              <Pause className="w-3.5 h-3.5" /> Pauza
            </button>
          )}
          {phase === "paused" && (
            <button
              onClick={onResume}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
            >
              <Play className="w-3.5 h-3.5" /> Pokračovat
            </button>
          )}
          {(isRunning || phase === "paused") && (
            <button
              onClick={onStop}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
            >
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          )}
        </div>
      )}

      {/* Speed control */}
      {phase !== "idle" && (
        <div className="space-y-1">
          <label className="text-xs text-gray-400">
            Prodleva: {speed}ms
          </label>
          <input
            type="range"
            min={500}
            max={5000}
            step={250}
            value={speed}
            onChange={(e) => onSetSpeed(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      )}

      {/* Manual inject */}
      {(isRunning || phase === "paused") && (
        <div className="space-y-1">
          <label className="text-xs text-gray-400">
            Manuální zpráva:
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              value={injectText}
              onChange={(e) => setInjectText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && injectText.trim()) {
                  onInject(injectText.trim());
                  setInjectText("");
                }
              }}
              placeholder="Napsat vlastní zprávu..."
              className="flex-1 px-2 py-1.5 text-sm bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500"
            />
            <button
              onClick={() => {
                if (injectText.trim()) {
                  onInject(injectText.trim());
                  setInjectText("");
                }
              }}
              className="px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Prompt editor */}
      {persona && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400">
              System prompt:
            </label>
            <button
              onClick={() => {
                if (editingPrompt) {
                  onUpdatePrompt(promptDraft);
                  setEditingPrompt(false);
                } else {
                  setPromptDraft(persona.systemPrompt);
                  setEditingPrompt(true);
                }
              }}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <Zap className="w-3 h-3" />
              {editingPrompt ? "Uložit" : "Upravit"}
            </button>
          </div>
          {editingPrompt ? (
            <textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              className="w-full h-32 px-2 py-1.5 text-xs bg-gray-800 border border-gray-600 rounded text-white resize-y"
            />
          ) : (
            <div className="text-xs text-gray-500 bg-gray-800/50 p-2 rounded line-clamp-3">
              {persona.systemPrompt}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
