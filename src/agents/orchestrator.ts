import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { reflectionAgent } from "./reflection-agent";
import { runConversationAgent } from "./conversation-agent";
import { feedbackAgent } from "./feedback-agent";
import { learningAgent, shouldRunSynthesis } from "./learning-agent";
import { insightAgent } from "./insight-agent";
import { goalAgent } from "./goal-agent";
import { healthCoachAgent } from "./health-coach-agent";
import { buildContext } from "@/context/builder";
import { transcribeAudio, generateEmbedding, chatCompletion } from "@/lib/openai";
import { encrypt, decrypt } from "@/lib/crypto";
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

  // 1. STT if audio
  let transcript = input.text ?? "";

  if (input.audioBuffer && input.audioFilename) {
    try {
      const sttResult = await transcribeAudio(
        input.audioBuffer,
        input.audioFilename
      );
      transcript = sttResult.text;
      log("info", "Orchestrator", "stt_completed", {
        data: { textLength: transcript.length },
      });
    } catch (error) {
      log("error", "Orchestrator", "stt_failed", {
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      throw new Error(
        `STT failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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
  const messageId = await saveMessage(
    sessionId,
    input.userId,
    "user",
    transcript
  );

  // 5. Embed in background (fire and forget, don't block response)
  embedMessageAsync(messageId, transcript);

  let responseText: string;
  let mode: SessionMode = "mixed";
  const goalsUpdated = false;

  if (isOnboarding) {
    responseText = await handleOnboarding(
      input.userId,
      sessionId,
      transcript
    );
    mode = "mixed";
  } else {
    const result = await handleNormalChat(
      input.userId,
      sessionId,
      messageId,
      transcript,
      profile
    );
    responseText = result.responseText;
    mode = result.mode;
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

// ── Onboarding ─────────────────────────────────────────────────────

interface OnboardingPhase {
  id: string;
  label: string;
  prompt: string;
}

const ONBOARDING_REVIEW_PHASE = "summary_review";

const ONBOARDING_PHASES: OnboardingPhase[] = [
  {
    id: "reason",
    label: "Důvod příchodu",
    prompt: `Uživatel právě přišel. Tvůj úkol: zjistit PROČ přišel.
Polož přímou otázku bez velkého uvítání. Příklad:
"Co tě sem přivádí? Řekni mi v pár větách, co bys chtěl/a řešit nebo změnit."
Buď stručný (1-2 věty max). Nejsi konverzační chatbot -- jdi rovnou na věc.`,
  },
  {
    id: "life_situation",
    label: "Životní situace",
    prompt: `Uživatel ti právě řekl, co ho trápí. Teď potřebuješ kontext jeho životní situace.
Polož 2-3 STRUKTUROVANÉ otázky najednou. Příklad:
"Díky. Potřebuju pár faktů, abych lépe porozuměl/a tvé situaci:
1. Jaká je tvoje pracovní situace? (zaměstnaný/OSVČ/student/jiné)
2. Žiješ s někým? (partner, rodina, sám/sama)
3. Jak je ti?"
Buď stručný a věcný. Nepřidávej empatické fráze navíc.`,
  },
  {
    id: "areas_rating",
    label: "Hodnocení oblastí",
    prompt: `Teď potřebuješ rychlé hodnocení spokojenosti v klíčových oblastech.
Požádej uživatele o čísla 1-10. Přesně takto:
"Ohodnoť svou spokojenost 1-10 v těchto oblastech:
1. Práce / kariéra
2. Vztahy (partner, rodina, přátelé)
3. Zdraví (fyzické i psychické)
4. Finance
5. Osobní růst / smysluplnost
6. Volný čas / zábava"
Nic víc nepřidávej.`,
  },
  {
    id: "deep_dive",
    label: "Hloubkové otázky",
    prompt: `Na základě předchozích odpovědí uživatele identifikuj 1-2 NEJSLABŠÍ oblasti (nejnižší čísla nebo nejvíce bolestivé téma) a polož cílené otázky.
Příklady:
- Pokud jsou vztahy problém: "Můžeš být konkrétnější ohledně vztahů? Co přesně nefunguje? Jak dlouho to trvá?"
- Pokud je to práce: "Co přesně tě na práci trápí? Šéf, kolegy, náplň práce, nebo celý obor?"
- Pokud je to zdraví: "Jaké zdravotní problémy máš? Spánek, energie, bolesti, psychika?"
Ptej se SPECIFICKY, ne obecně. Max 2-3 otázky.`,
  },
  {
    id: "interaction_style",
    label: "Styl komunikace",
    prompt: `Potřebuješ zjistit, jaký styl komunikace uživatel preferuje.
Polož tuto otázku PŘESNĚ:
"Poslední důležitá otázka: Jak chceš, abych s tebou komunikoval/a?
A) Podporující -- chci hlavně naslouchání a pochopení
B) Přímý -- chci slyšet pravdu, i když je nepříjemná
C) Nech to na tobě -- přizpůsob se situaci
Vyber A, B, nebo C."
Nic víc nepřidávej.`,
  },
  {
    id: "goals",
    label: "Cíle",
    prompt: `Uživatel zvolil styl komunikace. Teď zjisti jeho cíle.
Polož tuto otázku:
"Co bys chtěl/a, aby se za 3 měsíce změnilo? Napiš 1-3 konkrétní věci, na kterých chceš pracovat."
Buď stručný.`,
  },
  {
    id: "summary",
    label: "Shrnutí",
    prompt: `Diagnostika je téměř hotová. Na základě VŠECH předchozích odpovědí:
1. Stručně shrň, co jsi pochopil/a o uživateli (3-5 bodů)
2. Pojmenuj hlavní oblasti k práci
3. Zeptej se: "Sedí ti to? Chceš něco doplnit nebo opravit?"
Buď strukturovaný a věcný.`,
  },
];

const ONBOARDING_PHASE_IDS = ONBOARDING_PHASES.map((p) => p.id);
const REQUIRED_ONBOARDING_PHASE_IDS = [...ONBOARDING_PHASE_IDS];

function mapLegacyPhaseToCurrent(phase: string): string {
  if (phase === "A") return "reason";
  if (phase === "B") return "deep_dive";
  if (phase === "C") return "interaction_style";
  return phase;
}

function normalizeCoveredAreas(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (value): value is string =>
      typeof value === "string" && ONBOARDING_PHASE_IDS.includes(value)
  );
}

function getNextOnboardingPhase(currentPhaseId: string): string | null {
  const currentIndex = ONBOARDING_PHASE_IDS.indexOf(currentPhaseId);
  if (currentIndex < 0) return ONBOARDING_PHASE_IDS[0] ?? null;
  if (currentIndex === ONBOARDING_PHASE_IDS.length - 1)
    return ONBOARDING_REVIEW_PHASE;
  return ONBOARDING_PHASE_IDS[currentIndex + 1] ?? null;
}

function resolveCurrentOnboardingPhase(
  currentPhaseRaw: string | null | undefined,
  coveredAreas: string[]
): string {
  const legacyMapped = mapLegacyPhaseToCurrent(currentPhaseRaw ?? "");

  if (legacyMapped === "done") return "done";
  if (legacyMapped === ONBOARDING_REVIEW_PHASE) return ONBOARDING_REVIEW_PHASE;
  if (ONBOARDING_PHASE_IDS.includes(legacyMapped)) return legacyMapped;

  const nextUncovered =
    ONBOARDING_PHASE_IDS.find((phaseId) => !coveredAreas.includes(phaseId)) ??
    ONBOARDING_REVIEW_PHASE;
  return nextUncovered;
}

function isSummaryConfirmed(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    /(\bano\b|\bsed[ií]\b|\bp[řr]esn[ěe]\b|\bsouhlas[ií]m\b|\bd[áa]v[áa]\s+to\s+smysl\b)/i.test(
      normalized
    ) && !/\bne\b|\bnesed[ií]\b|\bnesouhlas[ií]m\b/i.test(normalized)
  );
}

function hasAllRequiredOnboardingPhases(coveredAreas: string[]): boolean {
  return REQUIRED_ONBOARDING_PHASE_IDS.every((phaseId) =>
    coveredAreas.includes(phaseId)
  );
}

export const __onboardingTestUtils = {
  mapLegacyPhaseToCurrent,
  normalizeCoveredAreas,
  getNextOnboardingPhase,
  resolveCurrentOnboardingPhase,
  isSummaryConfirmed,
  hasAllRequiredOnboardingPhases,
  ONBOARDING_REVIEW_PHASE,
  ONBOARDING_PHASE_IDS,
};

async function handleOnboarding(
  userId: string,
  sessionId: string,
  transcript: string
): Promise<string> {
  const [history, onboardingState] = await Promise.all([
    getConversationHistory(sessionId),
    getOnboardingState(userId),
  ]);

  const coveredAreas = normalizeCoveredAreas(onboardingState.coveredAreas);
  const currentPhaseId = resolveCurrentOnboardingPhase(
    onboardingState.currentPhase,
    coveredAreas
  );

  // If state says done but profile isn't complete yet, heal the inconsistency.
  if (currentPhaseId === "done") {
    await markOnboardingComplete(userId);
    return "Onboarding je dokončený. Můžeme rovnou pokračovat konkrétně.";
  }

  // Extra turn after summary: user confirms/corrects summary, then we switch to normal flow.
  if (currentPhaseId === ONBOARDING_REVIEW_PHASE) {
    const summaryConfirmed = isSummaryConfirmed(transcript);
    const allRequiredCovered = hasAllRequiredOnboardingPhases(coveredAreas);
    const existingDiagnosticData =
      onboardingState.diagnosticData &&
      typeof onboardingState.diagnosticData === "object"
        ? (onboardingState.diagnosticData as Record<string, unknown>)
        : {};

    const diagnosticData = {
      ...existingDiagnosticData,
      summaryConfirmed,
      summaryReviewInput: transcript,
      summaryReviewedAt: new Date().toISOString(),
    };

    await db
      .update(schema.onboardingState)
      .set({
        diagnosticData,
        updatedAt: new Date(),
      })
      .where(eq(schema.onboardingState.userId, userId));

    // Explicit confirmation preferred, but fallback completes onboarding
    // if all required phases were already covered.
    if (summaryConfirmed || allRequiredCovered) {
      await markOnboardingComplete(userId);
      return summaryConfirmed
        ? "Perfektní, díky za potvrzení. Onboarding je hotový a jdeme rovnou na konkrétní kroky."
        : "Díky za upřesnění. Onboarding je hotový a můžeme pokračovat konkrétně.";
    }

    return "Chápu. Co mám v mém shrnutí upravit, aby přesně sedělo?";
  }

  const currentPhase = ONBOARDING_PHASES.find((p) => p.id === currentPhaseId);
  if (!currentPhase) {
    await markOnboardingComplete(userId);
    return "Onboarding je hotový. Můžeme pokračovat konkrétně.";
  }

  const phaseIndex = ONBOARDING_PHASE_IDS.indexOf(currentPhase.id);

  const systemPrompt = `Jsi AI terapeut a kouč. Mluvíš česky. Provádíš STRUKTUROVANOU úvodní diagnostiku.

AKTUÁLNÍ FÁZE: ${currentPhase.label} (${currentPhase.id}) — fáze ${phaseIndex + 1}/${ONBOARDING_PHASES.length}

INSTRUKCE PRO TUTO FÁZI:
${currentPhase.prompt}

GLOBÁLNÍ PRAVIDLA:
- Odpovídej PŘÍMO textem, NE jako JSON.
- Buď stručný a strukturovaný. Žádné zbytečné fráze.
- Pokud uživatel odpoví mimo téma, stručně reaguj a vrať se k otázce.
- Pokud uživatel nechce odpovědět, zaznamenej to a posuň se dál.
- NIKDY nepřidávej empatické výplně typu "Děkuji za sdílení", "To musí být těžké" apod. Jdi na věc.`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: transcript },
  ];

  const responseText = await chatCompletion(messages, {
    temperature: 0.6,
  });

  const style = currentPhase.id === "interaction_style"
    ? detectInteractionStyle(transcript)
    : null;
  if (style) {
    await db
      .update(schema.userProfile)
      .set({ interactionStyle: style, updatedAt: new Date() })
      .where(eq(schema.userProfile.userId, userId));
  }

  const nextPhase = getNextOnboardingPhase(currentPhase.id) ?? "done";
  const updatedCovered = Array.from(new Set([...coveredAreas, currentPhase.id]));
  const existingDiagnosticData =
    onboardingState.diagnosticData &&
    typeof onboardingState.diagnosticData === "object"
      ? (onboardingState.diagnosticData as Record<string, unknown>)
      : {};

  await db
    .update(schema.onboardingState)
    .set({
      currentPhase: nextPhase,
      coveredAreas: updatedCovered,
      diagnosticData: {
        ...existingDiagnosticData,
        lastPhaseAsked: currentPhase.id,
        lastPhaseAskedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(schema.onboardingState.userId, userId));

  return responseText;
}

function detectInteractionStyle(
  text: string
): "comfort" | "candid" | "adaptive" | null {
  const lower = text.toLowerCase();
  if (/\ba\b/.test(lower) || /podpor|naslou|pochop/i.test(lower))
    return "comfort";
  if (/\bb\b/.test(lower) || /přím|pravd|upřím|naplno/i.test(lower))
    return "candid";
  if (/\bc\b/.test(lower) || /přizpůsob|nech|situac/i.test(lower))
    return "adaptive";
  return null;
}

// ── Normal Chat ────────────────────────────────────────────────────

async function handleNormalChat(
  userId: string,
  sessionId: string,
  messageId: string,
  transcript: string,
  profile: Awaited<ReturnType<typeof getOrCreateProfile>>
): Promise<{ responseText: string; mode: SessionMode }> {
  const voiceSentiment: string | null = null;

  let context;
  try {
    context = await buildContext(userId, sessionId, transcript, voiceSentiment);
  } catch (error) {
    log("warn", "Orchestrator", "context_build_failed", {
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    // Fallback minimal context
    context = {
      shortTerm: [],
      longTermRelevant: [],
      userConstraints: [],
      growthMilestones: [],
      activeGoals: [],
      pendingActions: [],
      voiceSentiment: null,
      sessionMode: "mixed" as SessionMode,
      interactionStyle: (profile.interactionStyle ?? "adaptive") as
        | "comfort"
        | "candid"
        | "adaptive",
      healthTrends: null,
      assessmentBaseline: null,
      recentCheckins: null,
    };
  }

  const history = await getConversationHistory(sessionId);

  // Reflection Agent
  let reflection;
  try {
    reflection = await reflectionAgent.run(
      [{ role: "user", content: transcript }],
      {
        traits: profile.traits,
        disprovedPatterns: profile.disprovedPatterns,
        interactionStyle: profile.interactionStyle,
        recentHistory: history.slice(-5).map((m) => m.content),
      }
    );
  } catch (error) {
    log("warn", "Orchestrator", "reflection_agent_failed", {
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    reflection = {
      warnings: [],
      suggestedTone: "přátelský a empatický",
      relevantTraits: [],
      interactionStyleOverride: undefined,
    };
  }

  // Conversation Agent
  const conversationResult = await runConversationAgent(
    transcript,
    context,
    reflection,
    history
  );

  // Schedule background agent pipeline
  scheduleAsyncPipeline({
    messageId,
    userId,
    sessionId,
    content: transcript,
    voiceSentiment: voiceSentiment ?? undefined,
  });

  return {
    responseText: conversationResult.response,
    mode: conversationResult.detectedMode,
  };
}

// ── Background job scheduling ──────────────────────────────────────

let pendingJob: InsightJobData | null = null;

export interface InsightJobData {
  messageId: string;
  userId: string;
  sessionId: string;
  content: string;
  voiceSentiment?: string;
}

function scheduleAsyncPipeline(data: InsightJobData) {
  pendingJob = data;
}

export function consumePendingJob(): InsightJobData | null {
  const job = pendingJob;
  pendingJob = null;
  return job;
}

// ── Async Agent Pipeline (runs via after()) ────────────────────────

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

  try {
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
      {
        currentTraits: profile.traits,
        disprovedPatterns: profile.disprovedPatterns,
      }
    );

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

    await applyProfileUpdates(data.userId, learningResult);

    // Insight Agent
    const insightResult = await insightAgent.run(
      [
        {
          role: "user",
          content: `Konverzace:\n${history.slice(-10).map((m) => `${m.role}: ${m.content}`).join("\n")}`,
        },
      ],
      {
        currentTraits: profile.traits,
        disprovedPatterns: profile.disprovedPatterns,
      }
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

    await db.insert(schema.interactionMetadata).values({
      messageId: data.messageId,
      voiceSentiment: data.voiceSentiment,
      responseMode: "mixed",
    });

    log("info", "Orchestrator", "async_pipeline_completed", {
      userId: data.userId,
    });
  } catch (error) {
    log("error", "Orchestrator", "async_pipeline_error", {
      userId: data.userId,
      data: { error: error instanceof Error ? error.message : String(error) },
    });
  }
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
      data: {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      },
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

async function markOnboardingComplete(userId: string) {
  await db
    .update(schema.userProfile)
    .set({
      onboardingCompleted: true,
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
      traitsToAdd?: Record<string, unknown> | null;
      traitsToRemove?: string[] | null;
      confidenceAdjustment?: number | null;
    };
    disprovedPatternsToAdd?: string[] | null;
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
    data: { confidenceScore: newConfidence },
  });
}
