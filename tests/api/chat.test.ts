import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => {
  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        { id: "test-session-id" },
      ]),
    }),
  });
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  });
  const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
  return {
    db: {
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
      execute: vi.fn().mockResolvedValue({ rows: [] }),
    },
    schema: {
      conversationSessions: { id: "id", userId: "user_id" },
      messages: {
        id: "id",
        sessionId: "session_id",
        userId: "user_id",
        role: "role",
        content: "content",
        createdAt: "created_at",
        embedding: "embedding",
      },
      userProfile: {
        userId: "user_id",
        traits: "traits",
        disprovedPatterns: "disproved_patterns",
        interactionStyle: "interaction_style",
        onboardingCompleted: "onboarding_completed",
        confidenceScore: "confidence_score",
        coachingPreferences: "coaching_preferences",
        updatedAt: "updated_at",
      },
      onboardingState: {
        userId: "user_id",
        coveredAreas: "covered_areas",
        pendingAreas: "pending_areas",
        currentPhase: "current_phase",
        updatedAt: "updated_at",
      },
      feedbackLog: {},
      insights: {},
      goals: { userId: "user_id" },
      actionPlans: {},
      interactionMetadata: {},
      checkIns: {},
      assessments: {},
      healthData: {},
    },
  };
});

vi.mock("@/lib/openai", () => ({
  chatCompletion: vi.fn().mockResolvedValue("Ahoj! Rád tě poznávám."),
  transcribeAudio: vi.fn().mockResolvedValue({
    text: "ahoj, jak se máš",
    language: "cs",
  }),
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
  generateSpeech: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn((text: string) => `encrypted:${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted:", "")),
}));

vi.mock("@/lib/logger", () => ({
  log: vi.fn(),
  startTrace: vi.fn(),
}));

describe("Orchestrator handleChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles text input for new onboarding user", async () => {
    const { handleChat } = await import("@/agents/orchestrator");

    const result = await handleChat({
      userId: "test-user-id",
      text: "Ahoj, potřebuju pomoct",
    });

    expect(result).toBeDefined();
    expect(result.transcript).toBe("Ahoj, potřebuju pomoct");
    expect(result.responseText).toBeTruthy();
    expect(result.sessionId).toBe("test-session-id");
    expect(result.mode).toBe("mixed");
  });

  it("rejects empty input", async () => {
    const { handleChat } = await import("@/agents/orchestrator");

    await expect(
      handleChat({ userId: "test-user-id" })
    ).rejects.toThrow("No input text or audio provided");
  });

  it("processes audio input via STT", async () => {
    const { handleChat } = await import("@/agents/orchestrator");
    const { transcribeAudio } = await import("@/lib/openai");

    const result = await handleChat({
      userId: "test-user-id",
      audioBuffer: Buffer.from("fake audio data"),
      audioFilename: "recording.webm",
    });

    expect(transcribeAudio).toHaveBeenCalled();
    expect(result.transcript).toBe("ahoj, jak se máš");
  });

  it("returns sessionId for session tracking", async () => {
    const { handleChat } = await import("@/agents/orchestrator");

    const result = await handleChat({
      userId: "test-user-id",
      text: "test",
    });

    expect(result.sessionId).toBeDefined();
    expect(typeof result.sessionId).toBe("string");
  });
});
