import { v4 as uuidv4 } from "uuid";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  traceId: string;
  timestamp: string;
  level: LogLevel;
  agent: string;
  action: string;
  userId?: string;
  data?: Record<string, unknown>;
}

let currentTraceId: string | null = null;

export function startTrace(): string {
  currentTraceId = uuidv4();
  return currentTraceId;
}

export function getTraceId(): string {
  return currentTraceId ?? uuidv4();
}

export function log(
  level: LogLevel,
  agent: string,
  action: string,
  data?: Record<string, unknown>
) {
  const entry: LogEntry = {
    traceId: getTraceId(),
    timestamp: new Date().toISOString(),
    level,
    agent,
    action,
    ...data,
  };

  const logFn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;

  logFn(JSON.stringify(entry));
}
