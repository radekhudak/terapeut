import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { log } from "@/lib/logger";

const TopicCreateSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(255),
  parentId: z.string().uuid().nullable().optional(),
  progressPct: z.number().int().min(0).max(100).optional(),
});

const TopicNoteCreateSchema = z.object({
  userId: z.string().uuid(),
  topicId: z.string().uuid(),
  noteType: z.enum(["key_thought", "milestone", "user_note"]),
  content: z.string().min(1),
});

const TopicPatchSchema = z.object({
  userId: z.string().uuid(),
  topicId: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  progressPct: z.number().int().min(0).max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const [nodes, notes] = await Promise.all([
      db
        .select()
        .from(schema.topicNodes)
        .where(eq(schema.topicNodes.userId, userId))
        .orderBy(schema.topicNodes.createdAt),
      db
        .select()
        .from(schema.topicNotes)
        .where(eq(schema.topicNotes.userId, userId))
        .orderBy(desc(schema.topicNotes.createdAt))
        .limit(200),
    ]);

    const notesByTopic = new Map<string, Array<Record<string, unknown>>>();
    for (const note of notes) {
      const existing = notesByTopic.get(note.topicId) ?? [];
      existing.push({
        id: note.id,
        noteType: note.noteType,
        content: safeDecrypt(note.contentEncrypted),
        createdAt: note.createdAt,
      });
      notesByTopic.set(note.topicId, existing);
    }

    return NextResponse.json({
      topics: nodes.map((node) => ({
        ...node,
        notes: notesByTopic.get(node.id) ?? [],
      })),
    });
  } catch (error) {
    return handleError("coaching_topics_get_failed", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string | undefined;

    if (action === "addNote") {
      const payload = TopicNoteCreateSchema.parse(body);
      const [topic] = await db
        .select({ id: schema.topicNodes.id })
        .from(schema.topicNodes)
        .where(
          and(
            eq(schema.topicNodes.id, payload.topicId),
            eq(schema.topicNodes.userId, payload.userId)
          )
        )
        .limit(1);
      if (!topic) {
        return NextResponse.json({ error: "Topic not found" }, { status: 404 });
      }
      const [note] = await db
        .insert(schema.topicNotes)
        .values({
          topicId: payload.topicId,
          userId: payload.userId,
          noteType: payload.noteType,
          contentEncrypted: encrypt(payload.content),
        })
        .returning();
      return NextResponse.json(
        {
          note: {
            ...note,
            content: payload.content,
          },
        },
        { status: 201 }
      );
    }

    const payload = TopicCreateSchema.parse(body);
    if (payload.parentId) {
      const [parent] = await db
        .select({ id: schema.topicNodes.id })
        .from(schema.topicNodes)
        .where(
          and(
            eq(schema.topicNodes.id, payload.parentId),
            eq(schema.topicNodes.userId, payload.userId)
          )
        )
        .limit(1);
      if (!parent) {
        return NextResponse.json(
          { error: "Parent topic not found" },
          { status: 404 }
        );
      }
    }
    const [topic] = await db
      .insert(schema.topicNodes)
      .values({
        userId: payload.userId,
        title: payload.title,
        parentId: payload.parentId ?? null,
        progressPct: payload.progressPct ?? 0,
      })
      .returning();
    return NextResponse.json({ topic }, { status: 201 });
  } catch (error) {
    return handleError("coaching_topics_post_failed", error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = TopicPatchSchema.parse(await request.json());
    const [existing] = await db
      .select({ id: schema.topicNodes.id })
      .from(schema.topicNodes)
      .where(
        and(
          eq(schema.topicNodes.id, payload.topicId),
          eq(schema.topicNodes.userId, payload.userId)
        )
      )
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    const [topic] = await db
      .update(schema.topicNodes)
      .set({
        title: payload.title,
        progressPct: payload.progressPct,
        updatedAt: new Date(),
      })
      .where(eq(schema.topicNodes.id, payload.topicId))
      .returning();

    return NextResponse.json({ topic });
  } catch (error) {
    return handleError("coaching_topics_patch_failed", error);
  }
}

function safeDecrypt(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return "[encrypted]";
  }
}

function handleError(event: string, error: unknown) {
  log("error", "API", event, {
    data: { error: error instanceof Error ? error.message : String(error) },
  });
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid request body", details: error.issues },
      { status: 400 }
    );
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
