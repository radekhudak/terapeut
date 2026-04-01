"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { TalkButton } from "@/components/talk-button";
import { ChatMessages } from "@/components/chat-messages";
import { ModeIndicator } from "@/components/mode-indicator";
import { CoachingTabs, type CoachingTab } from "@/components/coaching-tabs";
import { CoachingTaskList } from "@/components/coaching-task-list";
import { TopicTree } from "@/components/topic-tree";
import { DailyRoutineBanner } from "@/components/daily-routine-banner";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useChat } from "@/hooks/use-chat";
import { useUser } from "@/hooks/use-user";
import { useCoachingTasks } from "@/hooks/use-coaching-tasks";
import { useTopicTree } from "@/hooks/use-topic-tree";
import { useDailyRoutine } from "@/hooks/use-daily-routine";
import {
  Volume2,
  VolumeX,
  MessageSquare,
  Loader2,
  Users,
  X,
  Mic,
} from "lucide-react";

export default function Home() {
  const {
    user,
    users,
    error: userError,
    isLoading: userLoading,
    resetUser,
    login,
    createUser,
    clearError: clearUserError,
  } = useUser();
  const [isMuted, setIsMuted] = useState(false);
  const [inputMode, setInputMode] = useState<"voice" | "text">("text");
  const [textInput, setTextInput] = useState("");
  const [showUsersPanel, setShowUsersPanel] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [activeTab, setActiveTab] = useState<CoachingTab>("chat");
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [dailyQuestionIndex, setDailyQuestionIndex] = useState(0);
  const sentBlobRef = useRef<Blob | null>(null);
  const onboardingStartedRef = useRef(false);

  const recorder = useAudioRecorder();
  const chat = useChat({ userId: user?.id ?? "" });
  const tasks = useCoachingTasks(user?.id ?? "");
  const topics = useTopicTree(user?.id ?? "");
  const routine = useDailyRoutine(user?.id ?? "");

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
      !chat.sessionId &&
      !chat.isLoading &&
      !onboardingStartedRef.current
    ) {
      onboardingStartedRef.current = true;
      chat.sendText("Začínám.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading]);

  useEffect(() => {
    if (!chat.coachingSummary) return;
    tasks.refresh().catch(() => {});
    topics.refresh().catch(() => {});
    if (chat.coachingSummary.activeTopicId) {
      setActiveTopicId(chat.coachingSummary.activeTopicId);
    }
  }, [chat.coachingSummary, tasks, topics]);

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
      const activeQuestion =
        routine.routine && !routine.routine.completed
          ? routine.routine.questions[dailyQuestionIndex]
          : undefined;
      chat
        .sendAudio(recorder.audioBlob, {
          activeTopicId: activeQuestion?.topicId ?? activeTopicId ?? undefined,
          mode: activeQuestion ? "daily_routine" : "normal",
          routineId: activeQuestion ? routine.routine?.id : undefined,
        })
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
      const activeQuestion =
        routine.routine && !routine.routine.completed
          ? routine.routine.questions[dailyQuestionIndex]
          : undefined;
      await chat.sendText(text, {
        activeTopicId: activeQuestion?.topicId ?? activeTopicId ?? undefined,
        mode: activeQuestion ? "daily_routine" : "normal",
        routineId: activeQuestion ? routine.routine?.id : undefined,
      });
      if (activeQuestion && routine.routine) {
        const nextIdx = dailyQuestionIndex + 1;
        if (nextIdx >= routine.routine.questions.length) {
          await routine.completeRoutine();
        } else {
          setDailyQuestionIndex(nextIdx);
        }
      }
    },
    [textInput, chat, routine, dailyQuestionIndex, activeTopicId]
  );

  const handleNewUser = useCallback(async () => {
    if (confirm("Vytvořit nový profil? Aktuální konverzace se ztratí.")) {
      onboardingStartedRef.current = false;
      chat.clearSession();
      await resetUser();
      window.location.reload();
    }
  }, [chat, resetUser]);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!loginUsername.trim() || !loginPassword.trim()) return;
      const result = await login(loginUsername.trim(), loginPassword);
      if (result) {
        chat.clearSession();
        window.location.reload();
      }
    },
    [chat, login, loginPassword, loginUsername]
  );

  const handleCreateUser = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUsername.trim() || !newPassword.trim()) return;
      const result = await createUser(
        newUsername.trim(),
        newPassword,
        newDisplayName.trim() || undefined
      );
      if (result) {
        chat.clearSession();
        window.location.reload();
      }
    },
    [chat, createUser, newDisplayName, newPassword, newUsername]
  );

  const handleSpeakTopic = useCallback(
    async (topicId: string) => {
      setActiveTopicId(topicId);
      setActiveTab("chat");
      await chat.sendText("Chci se vratit k tomuto tematu.", { activeTopicId: topicId });
    },
    [chat]
  );

  const handleCreateTask = useCallback(async () => {
    if (!newTaskTitle.trim() || !user) return;
    await tasks.createTask({ title: newTaskTitle.trim() });
    setNewTaskTitle("");
  }, [newTaskTitle, tasks, user]);

  const handleCreateTopic = useCallback(async () => {
    if (!newTopicTitle.trim() || !user) return;
    await topics.createTopic(newTopicTitle.trim(), null);
    setNewTopicTitle("");
  }, [newTopicTitle, topics, user]);

  const handleStartDailyRoutine = useCallback(async () => {
    const created = await routine.startRoutine();
    if (created && created.questions.length > 0) {
      setDailyQuestionIndex(0);
      setActiveTab("chat");
      const first = created.questions[0];
      await chat.sendText(first.question, {
        activeTopicId: first.topicId,
        mode: "daily_routine",
        routineId: created.id,
      });
    }
  }, [chat, routine]);

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
          {process.env.NODE_ENV !== "production" && (
            <a
              href="/test"
              className="px-2 py-1 text-[10px] font-mono text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors"
              title="Test Agents"
            >
              TEST
            </a>
          )}
          <button
            onClick={() => {
              setShowUsersPanel((v) => !v);
              clearUserError();
            }}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Správa uživatelů"
            title="Správa uživatelů"
          >
            <Users className="w-5 h-5 text-neutral-500" />
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

      {showUsersPanel && (
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 space-y-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Přihlášený:{" "}
            <span className="font-medium">
              {user.username || user.displayName || "Anonymní uživatel"}
            </span>
          </p>

          <div className="text-xs text-neutral-500">
            Existující uživatelé:{" "}
            {users
              .filter((u) => !u.isAnonymous && u.username)
              .map((u) => u.username)
              .join(", ") || "žádní"}
          </div>

          <form onSubmit={handleLogin} className="grid grid-cols-1 gap-2">
            <p className="text-sm font-medium">Přepnout uživatele</p>
            <input
              type="text"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="Uživatelské jméno"
              className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Heslo"
              className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium"
            >
              Přihlásit / Přepnout
            </button>
          </form>

          <form onSubmit={handleCreateUser} className="grid grid-cols-1 gap-2">
            <p className="text-sm font-medium">Přidat nového uživatele</p>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Nové uživatelské jméno"
              className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
              required
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nové heslo"
              className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
              required
            />
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Zobrazované jméno (volitelné)"
              className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium"
            >
              Vytvořit uživatele
            </button>
          </form>

          <button
            onClick={handleNewUser}
            className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            Vytvořit anonymní profil
          </button>

          {userError && (
            <p className="text-sm text-red-600 dark:text-red-400">{userError}</p>
          )}
        </div>
      )}

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

      {chat.onboardingProgress?.isOnboarding ? (
        <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-300">
          Krok onboardingu: {chat.onboardingProgress.currentStep}/
          {chat.onboardingProgress.totalSteps} -{" "}
          {chat.onboardingProgress.stepLabel}
        </div>
      ) : (
        <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-300">
          Režim: běžná konverzace (agenti aktivní)
          {routine.routine && !routine.routine.completed
            ? ` • Denní rutina otázka ${Math.min(dailyQuestionIndex + 1, routine.routine.questions.length)}/${routine.routine.questions.length}`
            : ""}
        </div>
      )}

      <DailyRoutineBanner
        visible={routine.needsRoutine}
        isLoading={routine.isLoading}
        onStart={handleStartDailyRoutine}
      />

      <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800">
        <CoachingTabs activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "chat" ? (
        <ChatMessages messages={chat.messages} isLoading={chat.isLoading} />
      ) : activeTab === "tasks" ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Nový úkol..."
              className="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            />
            <button
              onClick={handleCreateTask}
              className="px-3 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm"
            >
              Přidat
            </button>
          </div>
          <CoachingTaskList
            tasks={tasks.tasks}
            onUpdate={async (taskId, patch) => {
              await tasks.updateTask(taskId, patch);
            }}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={newTopicTitle}
              onChange={(e) => setNewTopicTitle(e.target.value)}
              placeholder="Nové téma..."
              className="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            />
            <button
              onClick={handleCreateTopic}
              className="px-3 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm"
            >
              Přidat
            </button>
          </div>
          <TopicTree
            topics={topics.topics}
            activeTopicId={activeTopicId}
            onSpeakTopic={handleSpeakTopic}
          />
        </div>
      )}

      {activeTab === "chat" ? (
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
      ) : null}
    </div>
  );
}
