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

export const ConversationAgentOutput = z.object({
  response: z.string(),
  detectedMode: SessionMode,
  shouldFollowUp: z.boolean(),
  followUpTopic: z.string().optional(),
});
export type ConversationAgentOutput = z.infer<typeof ConversationAgentOutput>;

export const FeedbackAgentOutput = z.object({
  hasCorrection: z.boolean(),
  correctionDetail: z.string().optional(),
  feedbackType: FeedbackType.optional(),
  disprovedPattern: z.string().optional(),
});
export type FeedbackAgentOutput = z.infer<typeof FeedbackAgentOutput>;

export const InsightAgentOutput = z.object({
  insights: z.array(
    z.object({
      text: z.string(),
      type: InsightType,
      confidence: z.number().min(0).max(1),
    })
  ),
});
export type InsightAgentOutput = z.infer<typeof InsightAgentOutput>;

export const ReflectionAgentOutput = z.object({
  warnings: z.array(z.string()),
  suggestedTone: z.string(),
  relevantTraits: z.array(z.string()),
  interactionStyleOverride: InteractionStyle.optional(),
});
export type ReflectionAgentOutput = z.infer<typeof ReflectionAgentOutput>;

export const GoalAgentOutput = z.object({
  detectedGoals: z.array(
    z.object({
      title: z.string(),
      area: GoalArea,
      description: z.string(),
      suggestedSteps: z.array(z.string()),
    })
  ),
});
export type GoalAgentOutput = z.infer<typeof GoalAgentOutput>;

export const DiagnosticAgentOutput = z.object({
  coveredAreas: z.array(z.string()),
  pendingAreas: z.array(z.string()),
  suggestedNextQuestions: z.array(z.string()),
  detectedInteractionStyle: InteractionStyle.optional(),
  suggestedDataSources: z.array(z.string()),
  initialTraits: z.record(z.string(), z.unknown()).optional(),
  phase: OnboardingPhase,
});
export type DiagnosticAgentOutput = z.infer<typeof DiagnosticAgentOutput>;

export const MoodAnalysisOutput = z.object({
  mood: z.number().min(1).max(10),
  energy: z.number().min(1).max(10),
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  dominantEmotion: z.string(),
});
export type MoodAnalysisOutput = z.infer<typeof MoodAnalysisOutput>;

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
