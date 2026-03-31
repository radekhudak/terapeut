// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChat } from "@/hooks/use-chat";

describe("useChat session persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("restores persisted sessionId for current user", async () => {
    localStorage.setItem("terapeut_session_id_user-1", "session-123");

    const { result } = renderHook(() => useChat({ userId: "user-1" }));

    await waitFor(() => {
      expect(result.current.sessionId).toBe("session-123");
    });
  });

  it("persists sessionId after successful sendText", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            transcript: "Ahoj",
            responseText: "Čau",
            mode: "mixed",
            goalsUpdated: false,
            sessionId: "session-abc",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        })
      );

    const { result } = renderHook(() => useChat({ userId: "user-1" }));

    await act(async () => {
      await result.current.sendText("Ahoj");
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.current.sessionId).toBe("session-abc");
    expect(localStorage.getItem("terapeut_session_id_user-1")).toBe(
      "session-abc"
    );
  });

  it("clears persisted session on clearSession", async () => {
    localStorage.setItem("terapeut_session_id_user-1", "session-xyz");

    const { result } = renderHook(() => useChat({ userId: "user-1" }));

    await waitFor(() => {
      expect(result.current.sessionId).toBe("session-xyz");
    });

    act(() => {
      result.current.clearSession();
    });

    expect(result.current.sessionId).toBeNull();
    expect(localStorage.getItem("terapeut_session_id_user-1")).toBeNull();
  });
});
