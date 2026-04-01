"use client";

import { useEffect, useRef } from "react";
import type { TestMessage } from "@/hooks/use-test-runner";

interface TestChatViewProps {
  messages: TestMessage[];
}

export function TestChatView({ messages }: TestChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Vyber personu a spusť test pro zobrazení konverzace.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 overflow-y-auto h-full">
      {messages.map((msg) => {
        if (msg.role === "system") {
          return (
            <div
              key={msg.id}
              className="text-center text-xs text-gray-500 py-1"
            >
              {msg.content}
            </div>
          );
        }

        const isUser = msg.role === "user";
        return (
          <div
            key={msg.id}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                isUser
                  ? msg.simulated
                    ? "bg-blue-700/70 text-blue-100 border border-blue-600"
                    : "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-100"
              }`}
            >
              {msg.simulated && (
                <span className="text-[10px] font-mono text-blue-300 block mb-0.5">
                  [simulated]
                </span>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.latencyMs !== undefined && (
                <span className="text-[10px] text-gray-400 mt-1 block text-right">
                  {msg.latencyMs}ms
                </span>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
