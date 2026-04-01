"use client";

import { useState, useCallback, useRef } from "react";
import type { TestPersona, SimulationMessage } from "@/lib/test-personas";
import { buildSimulationPrompt } from "@/lib/test-personas";
import {
  shouldStopRun,
  DEFAULT_STEP_DELAY_MS,
  FREE_CHAT_MESSAGE_COUNT,
  type RunState,
} from "@/lib/test-run-guardrails";

export type TestRunnerPhase =
  | "idle"
  | "creating_user"
  | "onboarding"
  | "free_chat"
  | "daily_routine"
  | "paused"
  | "completed"
  | "stopped"
  | "error";

export interface TestMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  simulated?: boolean;
  timestamp: Date;
  latencyMs?: number;
}

interface OnboardingProgress {
  isOnboarding: boolean;
  currentStep: number;
  totalSteps: number;
  stepId: string;
  stepLabel: string;
}

interface ChatApiResult {
  transcript: string;
  responseText: string;
  sessionId: string;
  mode: string;
  onboardingProgress?: OnboardingProgress;
  coachingSummary?: {
    activeTasks: number;
    completedTasks: number;
    topicCount: number;
    activeTopicId?: string | null;
    activeTopicTitle?: string | null;
  };
}

export function useTestRunner() {
  const [phase, setPhase] = useState<TestRunnerPhase>("idle");
  const [persona, setPersona] = useState<TestPersona | null>(null);
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [stepCount, setStepCount] = useState(0);
  const [speed, setSpeed] = useState(DEFAULT_STEP_DELAY_MS);
  const [error, setError] = useState<string | null>(null);
  const [onboardingProgress, setOnboardingProgress] =
    useState<OnboardingProgress | null>(null);
  const [stopReason, setStopReason] = useState<string | null>(null);

  const onboardingProgressRef = useRef<OnboardingProgress | null>(null);
  const phaseRef = useRef<TestRunnerPhase>("idle");
  const pausedPhaseRef = useRef<TestRunnerPhase>("onboarding");
  const speedRef = useRef(DEFAULT_STEP_DELAY_MS);
  const sessionIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const stepCountRef = useRef(0);
  const startedAtRef = useRef(0);
  const consecutiveErrorsRef = useRef(0);
  const freeChatCountRef = useRef(0);
  const abortRef = useRef(false);
  const personaRef = useRef<TestPersona | null>(null);
  const historyRef = useRef<SimulationMessage[]>([]);

  const addMessage = useCallback(
    (
      role: "user" | "assistant" | "system",
      content: string,
      simulated?: boolean,
      latencyMs?: number
    ) => {
      const msg: TestMessage = {
        id: crypto.randomUUID(),
        role,
        content,
        simulated,
        timestamp: new Date(),
        latencyMs,
      };
      setMessages((prev) => [...prev, msg]);
      return msg;
    },
    []
  );

  const logEvent = useCallback(
    async (
      eventType: string,
      payload: Record<string, unknown>,
      latencyMs?: number
    ) => {
      if (!runIdRef.current) return;
      try {
        await fetch(`/api/test/runs/${runIdRef.current}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stepIndex: stepCountRef.current,
            eventType,
            payloadJson: payload,
            latencyMs,
          }),
        });
      } catch {
        // telemetry failure should not break the run
      }
    },
    []
  );

  const sendChat = useCallback(
    async (
      text: string,
      options?: { mode?: string; routineId?: string }
    ): Promise<ChatApiResult> => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userIdRef.current,
          sessionId: sessionIdRef.current,
          text,
          mode: options?.mode,
          routineId: options?.routineId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? data.error ?? "Chat API failed");
      }
      if (data.sessionId) {
        sessionIdRef.current = data.sessionId;
        setSessionId(data.sessionId);
      }
      return data;
    },
    []
  );

  const simulateResponse = useCallback(
    async (currentStepId?: string): Promise<string> => {
      const p = personaRef.current;
      if (!p) throw new Error("No persona");

      const prompt = buildSimulationPrompt(
        p,
        historyRef.current,
        currentStepId
      );

      const res = await fetch("/api/test/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaPrompt: prompt,
          conversationHistory: historyRef.current,
          currentPhase: currentStepId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? data.error ?? "Simulate API failed");
      }
      return data.response;
    },
    []
  );

  const sleep = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms)),
    []
  );

  const checkGuardrails = useCallback((): string | null => {
    const state: RunState = {
      stepCount: stepCountRef.current,
      startedAt: startedAtRef.current,
      consecutiveErrors: consecutiveErrorsRef.current,
      status: phaseRef.current,
    };
    return shouldStopRun(state);
  }, []);

  const runLoop = useCallback(async () => {
    while (!abortRef.current) {
      if (phaseRef.current === "paused") {
        await sleep(200);
        continue;
      }

      if (
        phaseRef.current === "completed" ||
        phaseRef.current === "stopped" ||
        phaseRef.current === "error"
      ) {
        break;
      }

      const stopReason = checkGuardrails();
      if (stopReason) {
        phaseRef.current = "stopped";
        setPhase("stopped");
        setStopReason(stopReason);
        await logEvent("run_stopped", { reason: stopReason });
        break;
      }

      try {
        const t0 = Date.now();
        let simulatedText: string;
        let currentStepId: string | undefined;

        if (phaseRef.current === "onboarding") {
          currentStepId =
            onboardingProgressRef.current?.stepId ?? undefined;
        }

        if (phaseRef.current === "daily_routine") {
          const p = personaRef.current;
          simulatedText = p
            ? `Cítím se ok. Snažím se pracovat na ${p.freeChatTopics[0] ?? "svých tématech"}.`
            : "Cítím se dobře.";
        } else {
          simulatedText = await simulateResponse(currentStepId);
        }

        const simLatency = Date.now() - t0;
        addMessage("user", simulatedText, true, simLatency);
        historyRef.current.push({
          role: "user",
          content: simulatedText,
        });

        await logEvent(
          "simulated_response",
          { text: simulatedText, phase: phaseRef.current, stepId: currentStepId },
          simLatency
        );

        await sleep(speedRef.current);

        const t1 = Date.now();
        const chatResult = await sendChat(
          simulatedText,
          phaseRef.current === "daily_routine"
            ? { mode: "daily_routine" }
            : undefined
        );
        const chatLatency = Date.now() - t1;

        addMessage("assistant", chatResult.responseText, false, chatLatency);
        historyRef.current.push({
          role: "assistant",
          content: chatResult.responseText,
        });

        if (chatResult.onboardingProgress) {
          onboardingProgressRef.current = chatResult.onboardingProgress;
          setOnboardingProgress(chatResult.onboardingProgress);
        }

        await logEvent(
          "chat_response",
          {
            responseText: chatResult.responseText.substring(0, 200),
            phase: phaseRef.current,
            onboardingProgress: chatResult.onboardingProgress,
          },
          chatLatency
        );

        stepCountRef.current += 1;
        setStepCount(stepCountRef.current);
        consecutiveErrorsRef.current = 0;

        // Phase transitions
        if (phaseRef.current === "onboarding") {
          const stillOnboarding =
            chatResult.onboardingProgress?.isOnboarding ?? false;
          if (!stillOnboarding) {
            phaseRef.current = "free_chat";
            setPhase("free_chat");
            freeChatCountRef.current = 0;
            addMessage(
              "system",
              "--- Onboarding dokončen, přechod na volnou konverzaci ---"
            );
            await logEvent("phase_transition", {
              from: "onboarding",
              to: "free_chat",
            });
          }
        } else if (phaseRef.current === "free_chat") {
          freeChatCountRef.current += 1;
          if (freeChatCountRef.current >= FREE_CHAT_MESSAGE_COUNT) {
            phaseRef.current = "daily_routine";
            setPhase("daily_routine");
            addMessage(
              "system",
              "--- Přechod na denní rutinu ---"
            );
            await logEvent("phase_transition", {
              from: "free_chat",
              to: "daily_routine",
            });

            try {
              await fetch(
                `/api/coaching/daily-routine?userId=${userIdRef.current}`
              );
            } catch {
              // routine generation can fail if no topics exist yet
            }
          }
        } else if (phaseRef.current === "daily_routine") {
          freeChatCountRef.current += 1;
          if (freeChatCountRef.current >= 3) {
            phaseRef.current = "completed";
            setPhase("completed");
            setStopReason("completed");
            addMessage("system", "--- Test run dokončen ---");
            await logEvent("run_completed", {
              totalSteps: stepCountRef.current,
            });
            break;
          }
        }

        await sleep(speedRef.current);
      } catch (err) {
        consecutiveErrorsRef.current += 1;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        addMessage("system", `Chyba: ${msg}`);
        await logEvent("error", {
          error: msg,
          consecutiveErrors: consecutiveErrorsRef.current,
        });

        if (consecutiveErrorsRef.current >= 5) {
          phaseRef.current = "error";
          setPhase("error");
          setStopReason("max_consecutive_errors");
          break;
        }

        await sleep(3000);
      }
    }

    // Update run status in DB
    if (runIdRef.current) {
      try {
        await fetch(`/api/test/runs/${runIdRef.current}/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: phaseRef.current,
            stepCount: stepCountRef.current,
          }),
        });
      } catch {
        // best effort
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMessage, checkGuardrails, logEvent, sendChat, simulateResponse, sleep]);

  const start = useCallback(
    async (selectedPersona: TestPersona) => {
      abortRef.current = false;
      personaRef.current = selectedPersona;
      setPersona(selectedPersona);
      setMessages([]);
      setError(null);
      setStopReason(null);
      setStepCount(0);
      stepCountRef.current = 0;
      startedAtRef.current = Date.now();
      consecutiveErrorsRef.current = 0;
      freeChatCountRef.current = 0;
      historyRef.current = [];
      phaseRef.current = "creating_user";
      setPhase("creating_user");

      try {
        // Create test user
        const userRes = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: `test_${selectedPersona.id}_${Date.now()}`,
            password: "test1234",
            displayName: `[TEST] ${selectedPersona.name} (${selectedPersona.label})`,
          }),
        });
        const userData = await userRes.json();
        if (!userRes.ok) {
          throw new Error(
            userData.error ?? "Failed to create test user"
          );
        }
        userIdRef.current = userData.id;
        setUserId(userData.id);

        // Create test run record
        const runRes = await fetch("/api/test/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personaId: selectedPersona.id,
            userId: userData.id,
          }),
        });
        const runData = await runRes.json();
        if (runRes.ok && runData.id) {
          runIdRef.current = runData.id;
          setRunId(runData.id);
        }

        addMessage(
          "system",
          `Test uživatel vytvořen: ${selectedPersona.name} (${selectedPersona.label})`
        );

        // Send initial message to trigger onboarding
        phaseRef.current = "onboarding";
        setPhase("onboarding");

        const t0 = Date.now();
        const chatResult = await sendChat("Začínám.");
        const latency = Date.now() - t0;

        addMessage("user", "Začínám.", true);
        addMessage("assistant", chatResult.responseText, false, latency);
        historyRef.current.push(
          { role: "user", content: "Začínám." },
          { role: "assistant", content: chatResult.responseText }
        );

        if (chatResult.onboardingProgress) {
          onboardingProgressRef.current = chatResult.onboardingProgress;
          setOnboardingProgress(chatResult.onboardingProgress);
        }

        stepCountRef.current = 1;
        setStepCount(1);

        await logEvent(
          "run_started",
          { persona: selectedPersona.id, userId: userData.id },
          latency
        );

        // Start the main loop
        runLoop();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        phaseRef.current = "error";
        setPhase("error");
        addMessage("system", `Chyba při startu: ${msg}`);
      }
    },
    [addMessage, logEvent, runLoop, sendChat]
  );

  const pause = useCallback(() => {
    if (
      phaseRef.current !== "onboarding" &&
      phaseRef.current !== "free_chat" &&
      phaseRef.current !== "daily_routine"
    ) {
      return;
    }
    pausedPhaseRef.current = phaseRef.current;
    phaseRef.current = "paused";
    setPhase("paused");
    addMessage("system", "--- Pozastaveno ---");
  }, [addMessage]);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    phaseRef.current = pausedPhaseRef.current;
    setPhase(pausedPhaseRef.current);
    addMessage("system", "--- Pokračuji ---");
  }, [addMessage]);

  const stop = useCallback(() => {
    abortRef.current = true;
    phaseRef.current = "stopped";
    setPhase("stopped");
    setStopReason("manual_stop");
    addMessage("system", "--- Zastaveno uživatelem ---");
  }, [addMessage]);

  const injectMessage = useCallback(
    async (text: string) => {
      if (!userIdRef.current) return;
      const wasPaused = phaseRef.current === "paused";

      addMessage("user", text, false);
      historyRef.current.push({ role: "user", content: text });

      try {
        const result = await sendChat(text);
        addMessage("assistant", result.responseText);
        historyRef.current.push({
          role: "assistant",
          content: result.responseText,
        });

        if (result.onboardingProgress) {
          onboardingProgressRef.current = result.onboardingProgress;
          setOnboardingProgress(result.onboardingProgress);
        }

        stepCountRef.current += 1;
        setStepCount(stepCountRef.current);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        addMessage("system", `Chyba: ${msg}`);
      }

      if (wasPaused) {
        phaseRef.current = "paused";
        setPhase("paused");
      }
    },
    [addMessage, sendChat]
  );

  const updatePersonaPrompt = useCallback(
    (newPrompt: string) => {
      if (!personaRef.current) return;
      personaRef.current = { ...personaRef.current, systemPrompt: newPrompt };
      setPersona({ ...personaRef.current });
      addMessage("system", "Persona prompt aktualizován");
    },
    [addMessage]
  );

  const changeSpeed = useCallback((ms: number) => {
    speedRef.current = ms;
    setSpeed(ms);
  }, []);

  return {
    phase,
    persona,
    messages,
    userId,
    sessionId,
    runId,
    stepCount,
    speed,
    error,
    onboardingProgress,
    stopReason,
    start,
    pause,
    resume,
    stop,
    injectMessage,
    updatePersonaPrompt,
    setSpeed: changeSpeed,
  };
}
