import { db, schema } from "@/db";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { generateEmbedding } from "@/lib/openai";
import { decrypt } from "@/lib/crypto";
import type { ConversationContext, InteractionStyle, SessionMode } from "@/lib/types";
import { log } from "@/lib/logger";

export async function buildContext(
  userId: string,
  sessionId: string,
  currentMessage: string,
  voiceSentiment: string | null
): Promise<ConversationContext> {
  const [
    shortTermMessages,
    profile,
    activeGoals,
    pendingActions,
    recentCheckIns,
    latestAssessment,
    healthTrends,
    longTermRelevant,
  ] = await Promise.all([
    getShortTermMessages(sessionId),
    getUserProfile(userId),
    getActiveGoals(userId),
    getPendingActions(userId),
    getRecentCheckIns(userId),
    getLatestAssessment(userId),
    getHealthTrends(userId),
    getLongTermRelevant(userId, currentMessage),
  ]);

  const milestones = await getGrowthMilestones(userId);

  const context: ConversationContext = {
    shortTerm: shortTermMessages,
    longTermRelevant,
    userConstraints: (profile?.disprovedPatterns as string[]) ?? [],
    growthMilestones: milestones,
    activeGoals: activeGoals.map(
      (g) => `[${g.area}] ${g.title} (${g.progressPct}%)`
    ),
    pendingActions: pendingActions.map(
      (a) =>
        `${a.stepDescription}${a.dueDate ? ` (do ${a.dueDate.toLocaleDateString("cs")})` : ""}`
    ),
    voiceSentiment,
    sessionMode: (profile?.coachingPreferences as Record<string, unknown>)
      ?.preferredMode as SessionMode ?? "mixed",
    interactionStyle:
      (profile?.interactionStyle as InteractionStyle) ?? "adaptive",
    healthTrends: healthTrends,
    assessmentBaseline: latestAssessment,
    recentCheckins: recentCheckIns,
  };

  log("info", "ContextBuilder", "context_built", {
    userId,
    data: {
      shortTermCount: context.shortTerm.length,
      longTermCount: context.longTermRelevant.length,
      goalsCount: context.activeGoals.length,
    },
  });

  return context;
}

async function getShortTermMessages(sessionId: string): Promise<string[]> {
  const rows = await db
    .select({ role: schema.messages.role, content: schema.messages.content })
    .from(schema.messages)
    .where(eq(schema.messages.sessionId, sessionId))
    .orderBy(desc(schema.messages.createdAt))
    .limit(5);

  return rows.reverse().map((r) => `${r.role}: ${r.content}`);
}

async function getUserProfile(userId: string) {
  const rows = await db
    .select()
    .from(schema.userProfile)
    .where(eq(schema.userProfile.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

async function getActiveGoals(userId: string) {
  return db
    .select()
    .from(schema.goals)
    .where(
      and(eq(schema.goals.userId, userId), eq(schema.goals.status, "active"))
    )
    .orderBy(desc(schema.goals.updatedAt))
    .limit(5);
}

async function getPendingActions(userId: string) {
  return db
    .select({
      stepDescription: schema.actionPlans.stepDescription,
      dueDate: schema.actionPlans.dueDate,
    })
    .from(schema.actionPlans)
    .innerJoin(schema.goals, eq(schema.actionPlans.goalId, schema.goals.id))
    .where(
      and(
        eq(schema.goals.userId, userId),
        eq(schema.actionPlans.completed, false)
      )
    )
    .orderBy(schema.actionPlans.dueDate)
    .limit(5);
}

async function getRecentCheckIns(userId: string): Promise<string | null> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = await db
    .select()
    .from(schema.checkIns)
    .where(
      and(
        eq(schema.checkIns.userId, userId),
        gte(schema.checkIns.createdAt, sevenDaysAgo)
      )
    )
    .orderBy(desc(schema.checkIns.createdAt))
    .limit(7);

  if (rows.length === 0) return null;

  const avgMood =
    rows.reduce((sum, r) => sum + (r.mood ?? 0), 0) / rows.length;
  const avgEnergy =
    rows.reduce((sum, r) => sum + (r.energy ?? 0), 0) / rows.length;

  return `Průměr 7 dní: mood ${avgMood.toFixed(1)}/10, energie ${avgEnergy.toFixed(1)}/10 (${rows.length} záznamů)`;
}

async function getLatestAssessment(userId: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(schema.assessments)
    .where(eq(schema.assessments.userId, userId))
    .orderBy(desc(schema.assessments.createdAt))
    .limit(2);

  if (rows.length === 0) return null;

  return rows
    .map((r) => `${r.type.toUpperCase()}: ${r.score} bodů`)
    .join(", ");
}

async function getHealthTrends(userId: string): Promise<string | null> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = await db
    .select()
    .from(schema.healthData)
    .where(
      and(
        eq(schema.healthData.userId, userId),
        gte(schema.healthData.recordedAt, sevenDaysAgo)
      )
    )
    .orderBy(desc(schema.healthData.recordedAt))
    .limit(20);

  if (rows.length === 0) return null;

  const byType: Record<string, number[]> = {};
  for (const r of rows) {
    if (!byType[r.metricType]) byType[r.metricType] = [];
    byType[r.metricType].push(r.value);
  }

  return Object.entries(byType)
    .map(([type, values]) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return `${type}: průměr ${avg.toFixed(1)}`;
    })
    .join(", ");
}

async function getLongTermRelevant(
  userId: string,
  currentMessage: string
): Promise<string[]> {
  try {
    const embedding = await generateEmbedding(currentMessage);
    const embeddingStr = `[${embedding.join(",")}]`;

    const rows = await db.execute(
      sql`SELECT content, 1 - (embedding <=> ${embeddingStr}::vector) as similarity
          FROM messages
          WHERE user_id = ${userId}
            AND embedding IS NOT NULL
            AND role = 'user'
          ORDER BY embedding <=> ${embeddingStr}::vector
          LIMIT 5`
    );

    return (rows.rows as Array<{ content: string; similarity: number }>)
      .filter((r) => r.similarity > 0.3)
      .map((r) => r.content);
  } catch (error) {
    log("warn", "ContextBuilder", "rag_retrieval_failed", {
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    return [];
  }
}

async function getGrowthMilestones(userId: string): Promise<string[]> {
  const rows = await db
    .select()
    .from(schema.insights)
    .where(
      and(
        eq(schema.insights.userId, userId),
        eq(schema.insights.insightType, "milestone")
      )
    )
    .orderBy(desc(schema.insights.createdAt))
    .limit(5);

  return rows.map((r) => {
    try {
      return decrypt(r.insightTextEncrypted);
    } catch {
      return "[encrypted]";
    }
  });
}
