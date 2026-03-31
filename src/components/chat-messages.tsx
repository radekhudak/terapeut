"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/use-chat";
import { Bot, User } from "lucide-react";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

const HIDDEN_MESSAGES = new Set(["začínám.", "začínám", "start"]);

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const visibleMessages = messages.filter(
    (m) =>
      !(
        m.role === "user" &&
        HIDDEN_MESSAGES.has(m.content.toLowerCase().trim())
      )
  );

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scroll-smooth"
    >
      {visibleMessages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "flex gap-3 max-w-[85%]",
            message.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
          )}
        >
          <div
            className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
              message.role === "user"
                ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            )}
          >
            {message.role === "user" ? (
              <User className="w-4 h-4" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
          </div>
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line",
              message.role === "user"
                ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-br-md"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-bl-md"
            )}
          >
            {message.content}
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex gap-3 mr-auto">
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
            <Bot className="w-4 h-4" />
          </div>
          <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-neutral-100 dark:bg-neutral-800">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
