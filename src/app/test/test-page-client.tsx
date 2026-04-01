"use client";

import { useTestRunner } from "@/hooks/use-test-runner";
import { TestRunnerPanel } from "@/components/test-runner-panel";
import { TestChatView } from "@/components/test-chat-view";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function TestPageClient() {
  const runner = useTestRunner();

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Zpět
        </Link>
        <h1 className="text-lg font-bold">AI Test Agents</h1>
        <span className="text-xs text-gray-500 ml-auto">
          {runner.phase !== "idle" && runner.runId
            ? `Run: ${runner.runId.substring(0, 8)}...`
            : ""}
        </span>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - controls */}
        <div className="w-80 min-w-[320px] border-r border-gray-800 overflow-y-auto">
          <TestRunnerPanel
            phase={runner.phase}
            persona={runner.persona}
            stepCount={runner.stepCount}
            speed={runner.speed}
            error={runner.error}
            stopReason={runner.stopReason}
            onboardingProgress={runner.onboardingProgress}
            onStart={runner.start}
            onPause={runner.pause}
            onResume={runner.resume}
            onStop={runner.stop}
            onInject={runner.injectMessage}
            onUpdatePrompt={runner.updatePersonaPrompt}
            onSetSpeed={runner.setSpeed}
          />
        </div>

        {/* Right panel - chat view */}
        <div className="flex-1 overflow-hidden">
          <TestChatView messages={runner.messages} />
        </div>
      </div>
    </div>
  );
}
