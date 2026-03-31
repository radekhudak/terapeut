import { z } from "zod";

// ── Interaction Style ──────────────────────────────────────────────
export const InteractionStyle = z.enum(["comfort", "candid", "adaptive"]);
export type InteractionStyle = z.infer<typeof InteractionStyle>;

// ── Session Mode ───────────────────────────────────────────────────
export const SessionMode = z.enum(["therapy", "coaching", "mixed"]);
export type SessionMode = z.infer<typeof SessionMode>;

// ── Message Role ───────────────────────────────────────────────────
export const MessageRole = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof MessageRole>;

// ── Goal Area ──────────────────────────────────────────────────────
export const GoalArea = z.enum([
  "health",
  "career",
  "relationships",
  "habits",
  "mindset",
  "finance",
  "fun",
  "other",
]);
export type GoalArea = z.infer<typeof GoalArea>;

// ── Goal Status ────────────────────────────────────────────────────
export const GoalStatus = z.enum([
  "active",
  "completed",
  "paused",
  "abandoned",
]);
export type GoalStatus = z.infer<typeof GoalStatus>;

// ── Feedback Type ──────────────────────────────────────────────────
export const FeedbackType = z.enum(["positive", "negative", "correction"]);
export type FeedbackType = z.infer<typeof FeedbackType>;

// ── Assessment Type ────────────────────────────────────────────────
export const AssessmentType = z.enum(["phq9", "gad7", "pss10", "psqi"]);
export type AssessmentType = z.infer<typeof AssessmentType>;

// ── Health Metric ──────────────────────────────────────────────────
export const HealthMetricType = z.enum([
  "sleep_hours",
  "sleep_quality",
  "steps",
  "exercise_minutes",
  "hrv",
  "screen_time",
]);
export type HealthMetricType = z.infer<typeof HealthMetricType>;

// ── Health Data Source ─────────────────────────────────────────────
export const HealthDataSource = z.enum([
  "apple_health",
  "google_fit",
  "manual",
]);
export type HealthDataSource = z.infer<typeof HealthDataSource>;

// ── Insight Type ───────────────────────────────────────────────────
export const InsightType = z.enum(["pattern", "observation", "milestone"]);
export type InsightType = z.infer<typeof InsightType>;

// ── Onboarding Phase ───────────────────────────────────────────────
export const OnboardingPhase = z.enum(["A", "B", "C", "done"]);
export type OnboardingPhase = z.infer<typeof OnboardingPhase>;

// ── Agent Output Schemas ───────────────────────────────────────────
// LLMs return null for missing fields, so we use .nullish() (= null | undefined)

export const ConversationAgentOutput = z.object({
  response: z.string(),
  detectedMode: SessionMode.catch("mixed"),
  shouldFollowUp: z.boolean().catch(false),
  followUpTopic: z.string().nullish(),
});
export type ConversationAgentOutput = z.infer<typeof ConversationAgentOutput>;

export const FeedbackAgentOutput = z.object({
  hasCorrection: z.boolean().catch(false),
  correctionDetail: z.string().nullish(),
  feedbackType: FeedbackType.nullish(),
  disprovedPattern: z.string().nullish(),
});
export type FeedbackAgentOutput = z.infer<typeof FeedbackAgentOutput>;

export const InsightAgentOutput = z.object({
  insights: z
    .array(
      z.object({
        text: z.string(),
        type: InsightType.catch("observation"),
        confidence: z.number().min(0).max(1).catch(0.5),
      })
    )
    .catch([]),
});
export type InsightAgentOutput = z.infer<typeof InsightAgentOutput>;

export const ReflectionAgentOutput = z.object({
  warnings: z.array(z.string()).catch([]),
  suggestedTone: z.string().catch("přátelský a empatický"),
  relevantTraits: z.array(z.string()).catch([]),
  interactionStyleOverride: InteractionStyle.nullish(),
});
export type ReflectionAgentOutput = z.infer<typeof ReflectionAgentOutput>;

export const GoalAgentOutput = z.object({
  detectedGoals: z
    .array(
      z.object({
        title: z.string(),
        area: GoalArea.catch("other"),
        description: z.string().catch(""),
        suggestedSteps: z.array(z.string()).catch([]),
      })
    )
    .catch([]),
});
export type GoalAgentOutput = z.infer<typeof GoalAgentOutput>;

export const DiagnosticAgentOutput = z.object({
  coveredAreas: z.array(z.string()).catch([]),
  pendingAreas: z.array(z.string()).catch([]),
  suggestedNextQuestions: z.array(z.string()).catch([]),
  detectedInteractionStyle: InteractionStyle.nullish(),
  suggestedDataSources: z.array(z.string()).catch([]),
  initialTraits: z.record(z.string(), z.unknown()).nullish(),
  phase: OnboardingPhase.catch("A"),
});
export type DiagnosticAgentOutput = z.infer<typeof DiagnosticAgentOutput>;

export const MoodAnalysisOutput = z.object({
  mood: z.number().min(1).max(10).catch(5),
  energy: z.number().min(1).max(10).catch(5),
  sentiment: z
    .enum(["positive", "neutral", "negative", "mixed"])
    .catch("neutral"),
  dominantEmotion: z.string().catch("neutrální"),
});
export type MoodAnalysisOutput = z.infer<typeof MoodAnalysisOutput>;

// Learning Agent output
export const LearningAgentOutput = z.object({
  profileUpdates: z.object({
    traitsToAdd: z.record(z.string(), z.unknown()).nullish(),
    traitsToRemove: z.array(z.string()).nullish(),
    confidenceAdjustment: z.number().nullish(),
  }).catch({ traitsToAdd: null, traitsToRemove: null, confidenceAdjustment: null }),
  disprovedPatternsToAdd: z.array(z.string()).nullish(),
  synthesisReport: z.string().nullish(),
});
export type LearningAgentOutput = z.infer<typeof LearningAgentOutput>;

// Health Coach Agent output
export const HealthCoachAgentOutput = z.object({
  healthObservations: z
    .array(
      z.object({
        area: z.string(),
        observation: z.string(),
        suggestion: z.string().nullish(),
        urgency: z.enum(["low", "medium", "high"]).catch("low"),
      })
    )
    .catch([]),
  shouldAlert: z.boolean().catch(false),
});
export type HealthCoachAgentOutput = z.infer<typeof HealthCoachAgentOutput>;

// ── Context Builder ────────────────────────────────────────────────
export interface ConversationContext {
  shortTerm: string[];
  longTermRelevant: string[];
  userConstraints: string[];
  growthMilestones: string[];
  activeGoals: string[];
  pendingActions: string[];
  voiceSentiment: string | null;
  sessionMode: SessionMode;
  interactionStyle: InteractionStyle;
  healthTrends: string | null;
  assessmentBaseline: string | null;
  recentCheckins: string | null;
}

// ── Chat API ───────────────────────────────────────────────────────
export const ChatRequestSchema = z.object({
  text: z.string().optional(),
  sessionId: z.string().uuid().optional(),
});

export const ChatResponseSchema = z.object({
  transcript: z.string(),
  responseText: z.string(),
  audioUrl: z.string().optional(),
  mode: SessionMode,
  goalsUpdated: z.boolean(),
  sessionId: z.string().uuid(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
