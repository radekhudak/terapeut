import { describe, it, expect } from "vitest";
import {
  ConversationAgentOutput,
  FeedbackAgentOutput,
  InsightAgentOutput,
  ReflectionAgentOutput,
  GoalAgentOutput,
  DiagnosticAgentOutput,
  LearningAgentOutput,
  HealthCoachAgentOutput,
  InteractionStyle,
  SessionMode,
  CoachingTrackerAgentOutput,
  DailyRoutineAgentOutput,
  ChatRequestSchema,
  ChatResponseSchema,
} from "@/lib/types";

describe("Zod schemas handle LLM outputs gracefully", () => {
  describe("ConversationAgentOutput", () => {
    it("parses valid output", () => {
      const result = ConversationAgentOutput.parse({
        response: "Ahoj, jak se máš?",
        detectedMode: "therapy",
        shouldFollowUp: true,
        followUpTopic: "spánek",
      });
      expect(result.response).toBe("Ahoj, jak se máš?");
      expect(result.detectedMode).toBe("therapy");
    });

    it("handles null optional fields from LLM", () => {
      const result = ConversationAgentOutput.parse({
        response: "Ahoj",
        detectedMode: "mixed",
        shouldFollowUp: false,
        followUpTopic: null,
      });
      expect(result.followUpTopic).toBeNull();
    });

    it("falls back on invalid detectedMode", () => {
      const result = ConversationAgentOutput.parse({
        response: "Ahoj",
        detectedMode: "invalid_mode",
        shouldFollowUp: false,
      });
      expect(result.detectedMode).toBe("mixed");
    });

    it("falls back on missing shouldFollowUp", () => {
      const result = ConversationAgentOutput.parse({
        response: "Ahoj",
        detectedMode: "therapy",
      });
      expect(result.shouldFollowUp).toBe(false);
    });
  });

  describe("FeedbackAgentOutput", () => {
    it("parses valid output", () => {
      const result = FeedbackAgentOutput.parse({
        hasCorrection: true,
        correctionDetail: "AI špatně interpretovala postoj k práci",
        feedbackType: "correction",
        disprovedPattern: "workaholic",
      });
      expect(result.hasCorrection).toBe(true);
      expect(result.feedbackType).toBe("correction");
    });

    it("handles all null optional fields", () => {
      const result = FeedbackAgentOutput.parse({
        hasCorrection: false,
        correctionDetail: null,
        feedbackType: null,
        disprovedPattern: null,
      });
      expect(result.hasCorrection).toBe(false);
      expect(result.feedbackType).toBeNull();
    });

    it("handles missing optional fields", () => {
      const result = FeedbackAgentOutput.parse({
        hasCorrection: false,
      });
      expect(result.hasCorrection).toBe(false);
    });
  });

  describe("InsightAgentOutput", () => {
    it("parses valid output with insights", () => {
      const result = InsightAgentOutput.parse({
        insights: [
          { text: "Pattern found", type: "pattern", confidence: 0.8 },
        ],
      });
      expect(result.insights).toHaveLength(1);
      expect(result.insights[0].type).toBe("pattern");
    });

    it("handles empty insights array", () => {
      const result = InsightAgentOutput.parse({ insights: [] });
      expect(result.insights).toHaveLength(0);
    });

    it("falls back on invalid type", () => {
      const result = InsightAgentOutput.parse({
        insights: [{ text: "Test", type: "invalid", confidence: 0.5 }],
      });
      expect(result.insights[0].type).toBe("observation");
    });

    it("falls back on missing insights array", () => {
      const result = InsightAgentOutput.parse({});
      expect(result.insights).toEqual([]);
    });
  });

  describe("ReflectionAgentOutput", () => {
    it("parses valid output", () => {
      const result = ReflectionAgentOutput.parse({
        warnings: ["Citlivé téma: rodina"],
        suggestedTone: "jemný a empatický",
        relevantTraits: ["family_issues"],
        interactionStyleOverride: "comfort",
      });
      expect(result.warnings).toHaveLength(1);
      expect(result.interactionStyleOverride).toBe("comfort");
    });

    it("handles null interactionStyleOverride from LLM", () => {
      const result = ReflectionAgentOutput.parse({
        warnings: [],
        suggestedTone: "neutrální",
        relevantTraits: [],
        interactionStyleOverride: null,
      });
      expect(result.interactionStyleOverride).toBeNull();
    });

    it("provides defaults for all fields", () => {
      const result = ReflectionAgentOutput.parse({});
      expect(result.warnings).toEqual([]);
      expect(result.suggestedTone).toBe("přátelský a empatický");
      expect(result.relevantTraits).toEqual([]);
    });
  });

  describe("GoalAgentOutput", () => {
    it("parses valid output with goals", () => {
      const result = GoalAgentOutput.parse({
        detectedGoals: [
          {
            title: "Lepší spánek",
            area: "health",
            description: "Zlepšit kvalitu spánku",
            suggestedSteps: ["Chodit spát ve 22:00"],
          },
        ],
      });
      expect(result.detectedGoals).toHaveLength(1);
    });

    it("handles empty goals array", () => {
      const result = GoalAgentOutput.parse({ detectedGoals: [] });
      expect(result.detectedGoals).toEqual([]);
    });

    it("falls back on invalid area", () => {
      const result = GoalAgentOutput.parse({
        detectedGoals: [
          {
            title: "Test",
            area: "invalid_area",
            description: "test",
            suggestedSteps: [],
          },
        ],
      });
      expect(result.detectedGoals[0].area).toBe("other");
    });
  });

  describe("DiagnosticAgentOutput", () => {
    it("parses valid output", () => {
      const result = DiagnosticAgentOutput.parse({
        coveredAreas: ["reason", "life_situation"],
        pendingAreas: ["emotional_baseline"],
        suggestedNextQuestions: ["Jak se cítíš většinou?"],
        detectedInteractionStyle: "candid",
        suggestedDataSources: ["apple_health"],
        initialTraits: { stress_level: "high" },
        phase: "B",
      });
      expect(result.phase).toBe("B");
    });

    it("handles all null optional fields", () => {
      const result = DiagnosticAgentOutput.parse({
        coveredAreas: [],
        pendingAreas: [],
        suggestedNextQuestions: [],
        detectedInteractionStyle: null,
        suggestedDataSources: [],
        initialTraits: null,
        phase: "A",
      });
      expect(result.detectedInteractionStyle).toBeNull();
      expect(result.initialTraits).toBeNull();
    });

    it("provides defaults for all missing fields", () => {
      const result = DiagnosticAgentOutput.parse({});
      expect(result.coveredAreas).toEqual([]);
      expect(result.phase).toBe("A");
    });
  });

  describe("LearningAgentOutput", () => {
    it("parses valid output", () => {
      const result = LearningAgentOutput.parse({
        profileUpdates: {
          traitsToAdd: { optimism: "moderate" },
          traitsToRemove: null,
          confidenceAdjustment: 0.1,
        },
        disprovedPatternsToAdd: [],
        synthesisReport: null,
      });
      expect(result.profileUpdates.traitsToAdd).toEqual({
        optimism: "moderate",
      });
    });

    it("provides defaults for completely empty input", () => {
      const result = LearningAgentOutput.parse({});
      expect(result.profileUpdates).toBeDefined();
    });
  });

  describe("HealthCoachAgentOutput", () => {
    it("parses valid output", () => {
      const result = HealthCoachAgentOutput.parse({
        healthObservations: [
          {
            area: "sleep",
            observation: "Špatný spánek",
            suggestion: "Večerní rutina",
            urgency: "medium",
          },
        ],
        shouldAlert: false,
      });
      expect(result.healthObservations).toHaveLength(1);
    });

    it("handles empty observations", () => {
      const result = HealthCoachAgentOutput.parse({
        healthObservations: [],
        shouldAlert: false,
      });
      expect(result.healthObservations).toEqual([]);
    });

    it("provides defaults for missing fields", () => {
      const result = HealthCoachAgentOutput.parse({});
      expect(result.healthObservations).toEqual([]);
      expect(result.shouldAlert).toBe(false);
    });
  });

  describe("Enum schemas", () => {
    it("InteractionStyle accepts valid values", () => {
      expect(InteractionStyle.parse("comfort")).toBe("comfort");
      expect(InteractionStyle.parse("candid")).toBe("candid");
      expect(InteractionStyle.parse("adaptive")).toBe("adaptive");
    });

    it("InteractionStyle rejects invalid values", () => {
      expect(() => InteractionStyle.parse("invalid")).toThrow();
    });

    it("SessionMode accepts valid values", () => {
      expect(SessionMode.parse("therapy")).toBe("therapy");
      expect(SessionMode.parse("coaching")).toBe("coaching");
      expect(SessionMode.parse("mixed")).toBe("mixed");
    });
  });

  describe("New coaching schemas", () => {
    it("parses CoachingTrackerAgentOutput with nullables", () => {
      const result = CoachingTrackerAgentOutput.parse({
        agreedTasks: [
          {
            title: "10 min procházka",
            description: "Po obědě",
            dueHint: null,
            priority: "medium",
            status: "todo",
            progressPct: 0,
            matchExistingTaskId: null,
          },
        ],
        taskStatusUpdates: [],
        topicUpdates: [],
        detectedTopicTitle: null,
      });
      expect(result.agreedTasks[0].status).toBe("todo");
      expect(result.detectedTopicTitle).toBeNull();
    });

    it("provides defaults for invalid tracker payload", () => {
      const result = CoachingTrackerAgentOutput.parse({
        agreedTasks: [{ title: "Task" }],
      });
      expect(Array.isArray(result.agreedTasks)).toBe(true);
      expect(result.taskStatusUpdates).toEqual([]);
      expect(result.topicUpdates).toEqual([]);
    });

    it("parses DailyRoutineAgentOutput", () => {
      const result = DailyRoutineAgentOutput.parse({
        questions: [
          {
            topicId: "550e8400-e29b-41d4-a716-446655440000",
            question: "Co dnes uděláš pro zdraví?",
            followUpHint: null,
          },
        ],
        motivationalNote: "Jeden malý krok stačí.",
      });
      expect(result.questions).toHaveLength(1);
    });

    it("accepts activeTopicId in ChatRequestSchema", () => {
      const parsed = ChatRequestSchema.parse({
        text: "Ahoj",
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        activeTopicId: "550e8400-e29b-41d4-a716-446655440001",
        mode: "daily_routine",
        routineId: "550e8400-e29b-41d4-a716-446655440002",
      });
      expect(parsed.mode).toBe("daily_routine");
    });

    it("accepts coachingSummary in ChatResponseSchema", () => {
      const parsed = ChatResponseSchema.parse({
        transcript: "Ahoj",
        responseText: "Ahoj",
        mode: "mixed",
        goalsUpdated: false,
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        coachingSummary: {
          activeTasks: 2,
          completedTasks: 1,
          topicCount: 3,
          activeTopicId: "550e8400-e29b-41d4-a716-446655440001",
          activeTopicTitle: "Zdraví",
        },
      });
      expect(parsed.coachingSummary?.topicCount).toBe(3);
    });
  });
});
