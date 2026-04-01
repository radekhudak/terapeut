export const MAX_STEPS_PER_RUN = 120;
export const MAX_RUN_DURATION_MS = 20 * 60 * 1000; // 20 minutes
export const MAX_CONSECUTIVE_ERRORS = 5;
export const DEFAULT_STEP_DELAY_MS = 2000;
export const FREE_CHAT_MESSAGE_COUNT = 5;

export interface RunState {
  stepCount: number;
  startedAt: number;
  consecutiveErrors: number;
  status: string;
}

export function shouldStopRun(state: RunState): string | null {
  if (state.status === "stopped" || state.status === "completed") {
    return state.status;
  }
  if (state.stepCount >= MAX_STEPS_PER_RUN) {
    return `max_steps_reached (${MAX_STEPS_PER_RUN})`;
  }
  if (Date.now() - state.startedAt >= MAX_RUN_DURATION_MS) {
    return `max_duration_reached (${MAX_RUN_DURATION_MS / 60000}min)`;
  }
  if (state.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    return `max_consecutive_errors (${MAX_CONSECUTIVE_ERRORS})`;
  }
  return null;
}
