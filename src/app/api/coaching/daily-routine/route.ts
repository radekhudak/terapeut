import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { dailyRoutineAgent } from "@/agents/daily-routine-agent";
import { decrypt } from "@/lib/crypto";
import { log } from "@/lib/logger";

const QuerySchema = z.object({
  userId: z.string().uuid(),
  check: z
    .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
    .optional(),
  timezone: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.parse({
      userId: searchParams.get("userId"),
      check: searchParams.get("check") ?? undefined,
      timezone: searchParams.get("timezone") ?? undefined,
    });
    const timezone = parsed.timezone ?? "Europe/Prague";
    const routineDate = getLocalDate(timezone);
    const checkOnly = parsed.check === "1" || parsed.check === "true";

    const [existing] = await db
      .select()
      .from(schema.dailyRoutines)
      .where(
        and(
          eq(schema.dailyRoutines.userId, parsed.userId),
          eq(schema.dailyRoutines.routineDate, routineDate)
        )
      )
      .limit(1);

    if (checkOnly) {
      return NextResponse.json({
        needed: !existing || !existing.completed,
        lastCompletedAt: existing?.completedAt ?? null,
      });
    }

    if (existing) {
      return NextResponse.json({
        routine: existing,
      });
    }

    const topicCandidates = await selectTopicsForRoutine(parsed.userId);
    const generated = await generateDailyQuestions(parsed.userId, topicCandidates);

    const [created] = await db
      .insert(schema.dailyRoutines)
      .values({
        userId: parsed.userId,
        routineDate,
        timezone,
        topicsCovered: topicCandidates.map((t) => t.id),
        questions: generated.questions,
      })
      .returning();

    return NextResponse.json({
      routine: created,
      motivationalNote: generated.motivationalNote,
    });
  } catch (error) {
    log("error", "API", "daily_routine_get_failed", {
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function selectTopicsForRoutine(userId: string) {
  const rootTopics = await db
    .select({
      id: schema.topicNodes.id,
      title: schema.topicNodes.title,
      progressPct: schema.topicNodes.progressPct,
      updatedAt: schema.topicNodes.updatedAt,
    })
    .from(schema.topicNodes)
    .where(
      and(eq(schema.topicNodes.userId, userId), sql`${schema.topicNodes.parentId} IS NULL`)
    );

  if (rootTopics.length === 0) {
    return [
      { id: crypto.randomUUID(), title: "Práce / kariéra", progressPct: 0, score: 1 },
      { id: crypto.randomUUID(), title: "Vztahy", progressPct: 0, score: 0.9 },
      { id: crypto.randomUUID(), title: "Zdraví", progressPct: 0, score: 0.8 },
    ];
  }

  const [lastNotes, lastCheckin] = await Promise.all([
    db
      .select({
        topicId: schema.topicNotes.topicId,
        createdAt: schema.topicNotes.createdAt,
      })
      .from(schema.topicNotes)
      .where(eq(schema.topicNotes.userId, userId))
      .orderBy(desc(schema.topicNotes.createdAt))
      .limit(200),
    db
      .select({ mood: schema.checkIns.mood })
      .from(schema.checkIns)
      .where(eq(schema.checkIns.userId, userId))
      .orderBy(desc(schema.checkIns.createdAt))
      .limit(1),
  ]);

  const lastDiscussed = new Map<string, Date>();
  for (const note of lastNotes) {
    if (!lastDiscussed.has(note.topicId)) {
      lastDiscussed.set(note.topicId, note.createdAt);
    }
  }

  const urgencyBoost = (lastCheckin[0]?.mood ?? 6) <= 4 ? 1 : 0;
  const now = new Date();
  const scored = rootTopics.map((topic) => {
    const last = lastDiscussed.get(topic.id) ?? topic.updatedAt;
    const daysSince = Math.min(
      7,
      Math.max(0, Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)))
    );
    const score =
      0.4 * (daysSince / 7) +
      0.3 * (1 - (topic.progressPct ?? 0) / 100) +
      0.2 * 0.5 +
      0.1 * urgencyBoost;
    return {
      id: topic.id,
      title: topic.title,
      progressPct: topic.progressPct ?? 0,
      score,
      daysSince,
    };
  });

  const forced = scored.filter((t) => t.daysSince > 6);
  const sorted = scored.sort((a, b) => b.score - a.score);
  const merged = [...forced, ...sorted].filter(
    (topic, index, arr) => arr.findIndex((x) => x.id === topic.id) === index
  );
  return merged.slice(0, 3);
}

async function generateDailyQuestions(
  userId: string,
  topics: Array<{ id: string; title: string }>
) {
  if (topics.length === 0) {
    return {
      questions: [],
      motivationalNote: "Dnes si dej krátkou pauzu a jednu vědomou reflexi.",
    };
  }

  const notes = await db
    .select({
      topicId: schema.topicNotes.topicId,
      noteType: schema.topicNotes.noteType,
      contentEncrypted: schema.topicNotes.contentEncrypted,
      createdAt: schema.topicNotes.createdAt,
    })
    .from(schema.topicNotes)
    .where(eq(schema.topicNotes.userId, userId))
    .orderBy(desc(schema.topicNotes.createdAt))
    .limit(100);

  const notesByTopic = new Map<string, string[]>();
  for (const note of notes) {
    const arr = notesByTopic.get(note.topicId) ?? [];
    if (arr.length < 5) {
      arr.push(`[${note.noteType}] ${safeDecrypt(note.contentEncrypted)}`);
      notesByTopic.set(note.topicId, arr);
    }
  }

  try {
    return await dailyRoutineAgent.run(
      [
        {
          role: "user",
          content: `Navrhni denní otázky pro témata:\n${topics
            .map((t) => `${t.id}: ${t.title}`)
            .join("\n")}`,
        },
      ],
      {
        topics: topics.map((topic) => ({
          ...topic,
          notes: notesByTopic.get(topic.id) ?? [],
        })),
      }
    );
  } catch (error) {
    log("warn", "DailyRoutineAgent", "fallback_used", {
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    return {
      questions: topics.map((topic) => ({
        topicId: topic.id,
        question: `Jaký nejmenší konkrétní krok dnes uděláš v tématu "${topic.title}"?`,
        followUpHint: "Co ti to usnadní?",
      })),
      motivationalNote: "Důležitá je konzistence, ne dokonalost.",
    };
  }
}

function safeDecrypt(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return "[encrypted]";
  }
}

function getLocalDate(timezone: string): string {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}
