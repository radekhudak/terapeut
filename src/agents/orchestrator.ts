import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { reflectionAgent } from "./reflection-agent";
import { runConversationAgent } from "./conversation-agent";
import { feedbackAgent } from "./feedback-agent";
import { learningAgent, shouldRunSynthesis } from "./learning-agent";
import { insightAgent } from "./insight-agent";
import { goalAgent } from "./goal-agent";
import { healthCoachAgent } from "./health-coach-agent";
import { diagnosticAgent } from "./diagnostic-agent";
import { buildContext } from "@/context/builder";
import { transcribeAudio, generateEmbedding } from "@/lib/openai";
import { encrypt, decrypt } from "@/lib/crypto";
import { insightQueue } from "@/lib/redis";
import { log, startTrace } from "@/lib/logger";
import type { ChatResponse, SessionMode } from "@/lib/types";

export interface ChatInput {
  userId: string;
  sessionId?: string;
  text?: string;
  audioBuffer?: Buffer;
  audioFilename?: string;
}

export async function handleChat(input: ChatInput): Promise<ChatResponse> {
  startTrace();

  log("info", "Orchestrator", "chat_started", {
    userId: input.userId,
    data: { hasAudio: !!input.audioBuffer, hasText: !!input.text },
  });

  let transcript = input.text ?? "";
  const voiceSentiment: string | null = null;

  if (input.audioBuffer && input.audioFilename) {
    const sttResult = await transcribeAudio(
      input.audioBuffer,
      input.audioFilename
    );
    transcript = sttResult.text;
    log("info", "Orchestrator", "stt_completed", {
      data: { textLength: transcript.length },
    });
  }

  if (!transcript.trim()) {
    throw new Error("No input text or audio provided");
  }

  // 2. Get or create session
  const sessionId = input.sessionId ?? (await createSession(input.userId));

  // 3. Check onboarding status
  const profile = await getOrCreateProfile(input.userId);
  const isOnboarding = !profile.onboardingCompleted;

  // 4. Save user message
  const messageId = await saveMessage(sessionId, input.userId, "user", transcript);

  // 5. Start embedding in background
  embedMessageAsync(messageId, transcript);

  let responseText: string;
  let mode: SessionMode = "mixed";
  const goalsUpdated = false;

  if (isOnboarding) {
    // Onboarding flow
    const onboarding = await getOnboardingState(input.userId);
    const history = await getConversationHistory(sessionId);

    const diagnosticResult = await diagnosticAgent.run(
      [{ role: "user", content: transcript }],
      {
        coveredAreas: onboarding?.coveredAreas ?? [],
        pendingAreas: onboarding?.pendingAreas ?? [],
        currentPhase: onboarding?.currentPhase ?? "A",
        conversationHistory: history,
      }
    );

    // Generate conversational response for onboarding
    const onboardingMessages = [
      {
        role: "system" as const,
        content: `Jsi přátelský AI terapeut/kouč, který právě provádí úvodní diagnostiku. Mluvíš česky.
Polož další otázky přirozeným konverzačním tónem. Nepoužívej JSON formát -- mluv normálně.
Otázky k položení: ${diagnosticResult.suggestedNextQuestions.join("; ")}
${diagnosticResult.phase === "C" ? "Nabídni relevantní datové zdroje: " + diagnosticResult.suggestedDataSources.join(", ") : ""}
${diagnosticResult.phase === "done" ? "Diagnostika je hotová. Shrň, co jsi zjistil, a zeptej se, jestli to sedí." : ""}`,
      },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: transcript },
    ];

    const { chatCompletion } = await import("@/lib/openai");
    responseText = await chatCompletion(onboardingMessages, {
      temperature: 0.8,
    });

    // Update onboarding state
    await updateOnboardingState(input.userId, diagnosticResult);

    if (diagnosticResult.phase === "done") {
      await markOnboardingComplete(input.userId, diagnosticResult);
    }

    mode = "mixed";
  } else {
    // Normal flow
    const context = await buildContext(
      input.userId,
      sessionId,
      transcript,
      voiceSentiment
    );
    const history = await getConversationHistory(sessionId);

    // 6. Reflection Agent
    const reflection = await reflectionAgent.run(
      [{ role: "user", content: transcript }],
      {
        traits: profile.traits,
        disprovedPatterns: profile.disprovedPatterns,
        interactionStyle: profile.interactionStyle,
        recentHistory: history.slice(-5).map((m) => m.content),
      }
    );

    // 7. Conversation Agent
    const conversationResult = await runConversationAgent(
      transcript,
      context,
      reflection,
      history
    );

    responseText = conversationResult.response;
    mode = conversationResult.detectedMode;

    // 8. Enqueue async agent jobs
    await insightQueue.add("process", {
      messageId,
      userId: input.userId,
      sessionId,
      content: transcript,
      voiceSentiment: voiceSentiment ?? undefined,
    });
  }

  // 9. Save assistant message
  await saveMessage(sessionId, input.userId, "assistant", responseText);

  log("info", "Orchestrator", "chat_completed", {
    userId: input.userId,
    data: { mode, isOnboarding, responseLength: responseText.length },
  });

  return {
    transcript,
    responseText,
    mode,
    goalsUpdated,
    sessionId,
  };
}

// ── Async Agent Pipeline (runs via Redis worker) ───────────────────

export async function processInsightJob(data: {
  messageId: string;
  userId: string;
  sessionId: string;
  content: string;
  voiceSentiment?: string;
}) {
  startTrace();

  log("info", "Orchestrator", "async_pipeline_started", {
    userId: data.userId,
    data: { messageId: data.messageId },
  });

  const history = await getConversationHistory(data.sessionId);
  const profile = await getOrCreateProfile(data.userId);

  // Feedback Agent
  const feedbackResult = await feedbackAgent.run(
    [
      {
        role: "user",
        content: `Předchozí konverzace:\n${history.slice(-5).map((m) => `${m.role}: ${m.content}`).join("\n")}\n\nPoslední zpráva uživatele: ${data.content}`,
      },
    ],
    { currentTraits: profile.traits, disprovedPatterns: profile.disprovedPatterns }
  );

  // Save feedback if detected
  if (feedbackResult.feedbackType) {
    await db.insert(schema.feedbackLog).values({
      messageId: data.messageId,
      userId: data.userId,
      type: feedbackResult.feedbackType,
      correctionDetail: feedbackResult.correctionDetail,
    });
  }

  // Learning Agent
  const messageCount = await getMessageCount(data.userId);
  const needsSynthesis = await shouldRunSynthesis(messageCount);

  const learningResult = await learningAgent.run(
    [
      {
        role: "user",
        content: `Feedback: ${JSON.stringify(feedbackResult)}\nPoslední zpráva: ${data.content}\nVoice sentiment: ${data.voiceSentiment ?? "unknown"}`,
      },
    ],
    {
      currentTraits: profile.traits,
      confidenceScore: profile.confidenceScore,
      disprovedPatterns: profile.disprovedPatterns,
      synthesisNeeded: needsSynthesis,
    }
  );

  // Apply profile updates
  await applyProfileUpdates(data.userId, learningResult);

  // Insight Agent
  const insightResult = await insightAgent.run(
    [
      {
        role: "user",
        content: `Konverzace:\n${history.slice(-10).map((m) => `${m.role}: ${m.content}`).join("\n")}`,
      },
    ],
    { currentTraits: profile.traits, disprovedPatterns: profile.disprovedPatterns }
  );

  for (const insight of insightResult.insights) {
    await db.insert(schema.insights).values({
      userId: data.userId,
      insightTextEncrypted: encrypt(insight.text),
      insightType: insight.type,
      confidence: insight.confidence,
    });
  }

  // Goal Agent
  const goalResult = await goalAgent.run(
    [{ role: "user", content: data.content }],
    {
      activeGoals: await db
        .select()
        .from(schema.goals)
        .where(eq(schema.goals.userId, data.userId)),
    }
  );

  for (const goal of goalResult.detectedGoals) {
    const [inserted] = await db
      .insert(schema.goals)
      .values({
        userId: data.userId,
        area: goal.area,
        title: goal.title,
        description: goal.description,
      })
      .returning({ id: schema.goals.id });

    if (inserted) {
      for (const step of goal.suggestedSteps) {
        await db.insert(schema.actionPlans).values({
          goalId: inserted.id,
          stepDescription: step,
        });
      }
    }
  }

  // Health Coach Agent
  const healthResult = await healthCoachAgent.run(
    [{ role: "user", content: data.content }],
    { voiceSentiment: data.voiceSentiment }
  );

  if (healthResult.healthObservations.length > 0) {
    log("info", "HealthCoachAgent", "observations_found", {
      userId: data.userId,
      data: { count: healthResult.healthObservations.length },
    });
  }

  // Interaction metadata
  await db.insert(schema.interactionMetadata).values({
    messageId: data.messageId,
    voiceSentiment: data.voiceSentiment,
    responseMode: "mixed",
  });

  log("info", "Orchestrator", "async_pipeline_completed", {
    userId: data.userId,
    data: {
      feedbackType: feedbackResult.feedbackType,
      insightsCreated: insightResult.insights.length,
      goalsCreated: goalResult.detectedGoals.length,
    },
  });
}

// ── Helpers ────────────────────────────────────────────────────────

async function createSession(userId: string): Promise<string> {
  const [session] = await db
    .insert(schema.conversationSessions)
    .values({ userId })
    .returning({ id: schema.conversationSessions.id });
  return session.id;
}

async function saveMessage(
  sessionId: string,
  userId: string,
  role: string,
  content: string
): Promise<string> {
  const [msg] = await db
    .insert(schema.messages)
    .values({ sessionId, userId, role, content })
    .returning({ id: schema.messages.id });

  log("info", "DB", "message_saved", {
    userId,
    data: { messageId: msg.id, role },
  });

  return msg.id;
}

async function embedMessageAsync(
  messageId: string,
  content: string
): Promise<void> {
  try {
    const embedding = await generateEmbedding(content);
    await db
      .update(schema.messages)
      .set({ embedding })
      .where(eq(schema.messages.id, messageId));
  } catch (error) {
    log("warn", "Orchestrator", "embedding_failed", {
      data: { messageId, error: error instanceof Error ? error.message : String(error) },
    });
  }
}

async function getOrCreateProfile(userId: string) {
  const rows = await db
    .select()
    .from(schema.userProfile)
    .where(eq(schema.userProfile.userId, userId))
    .limit(1);

  if (rows[0]) return rows[0];

  const [profile] = await db
    .insert(schema.userProfile)
    .values({
      userId,
      interactionStyle: "adaptive",
      onboardingCompleted: false,
    })
    .returning();

  return profile;
}

async function getConversationHistory(sessionId: string) {
  return db
    .select({ role: schema.messages.role, content: schema.messages.content })
    .from(schema.messages)
    .where(eq(schema.messages.sessionId, sessionId))
    .orderBy(schema.messages.createdAt)
    .limit(50);
}

async function getOnboardingState(userId: string) {
  const rows = await db
    .select()
    .from(schema.onboardingState)
    .where(eq(schema.onboardingState.userId, userId))
    .limit(1);

  if (rows[0]) return rows[0];

  const [state] = await db
    .insert(schema.onboardingState)
    .values({ userId })
    .returning();

  return state;
}

async function updateOnboardingState(
  userId: string,
  diagnosticResult: { coveredAreas: string[]; pendingAreas: string[]; phase: string; initialTraits?: Record<string, unknown> | null }
) {
  await db
    .update(schema.onboardingState)
    .set({
      coveredAreas: diagnosticResult.coveredAreas,
      pendingAreas: diagnosticResult.pendingAreas,
      currentPhase: diagnosticResult.phase,
      updatedAt: new Date(),
    })
    .where(eq(schema.onboardingState.userId, userId));
}

async function markOnboardingComplete(
  userId: string,
  diagnosticResult: { detectedInteractionStyle?: string | null; initialTraits?: Record<string, unknown> | null }
) {
  await db
    .update(schema.userProfile)
    .set({
      onboardingCompleted: true,
      interactionStyle: diagnosticResult.detectedInteractionStyle ?? "adaptive",
      traits: diagnosticResult.initialTraits
        ? encrypt(JSON.stringify(diagnosticResult.initialTraits))
        : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.userProfile.userId, userId));

  await db
    .update(schema.onboardingState)
    .set({ currentPhase: "done", updatedAt: new Date() })
    .where(eq(schema.onboardingState.userId, userId));

  log("info", "Orchestrator", "onboarding_completed", { userId });
}

async function getMessageCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.messages)
    .where(eq(schema.messages.userId, userId));
  return Number(result[0]?.count ?? 0);
}

async function applyProfileUpdates(
  userId: string,
  learningResult: {
    profileUpdates: {
      traitsToAdd?: Record<string, unknown>;
      traitsToRemove?: string[];
      confidenceAdjustment?: number;
    };
    disprovedPatternsToAdd?: string[];
  }
) {
  const profile = await getOrCreateProfile(userId);

  let traits: Record<string, unknown> = {};
  if (profile.traits) {
    try {
      traits = JSON.parse(decrypt(profile.traits));
    } catch {
      traits = {};
    }
  }

  if (learningResult.profileUpdates.traitsToAdd) {
    Object.assign(traits, learningResult.profileUpdates.traitsToAdd);
  }
  if (learningResult.profileUpdates.traitsToRemove) {
    for (const key of learningResult.profileUpdates.traitsToRemove) {
      delete traits[key];
    }
  }

  const newConfidence = Math.max(
    0,
    Math.min(
      1,
      (profile.confidenceScore ?? 0.3) +
        (learningResult.profileUpdates.confidenceAdjustment ?? 0)
    )
  );

  const disprovedPatterns = [
    ...((profile.disprovedPatterns as string[]) ?? []),
    ...(learningResult.disprovedPatternsToAdd ?? []),
  ];

  await db
    .update(schema.userProfile)
    .set({
      traits: encrypt(JSON.stringify(traits)),
      confidenceScore: newConfidence,
      disprovedPatterns,
      updatedAt: new Date(),
    })
    .where(eq(schema.userProfile.userId, userId));

  log("info", "LearningAgent", "profile_updated", {
    userId,
    data: {
      confidenceScore: newConfidence,
      traitsAdded: Object.keys(
        learningResult.profileUpdates.traitsToAdd ?? {}
      ).length,
      traitsRemoved: learningResult.profileUpdates.traitsToRemove?.length ?? 0,
    },
  });
}
