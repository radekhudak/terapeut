import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { log } from "@/lib/logger";

const TaskCreateSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  goalId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done", "skipped"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  progressPct: z.number().int().min(0).max(100).optional(),
  dueDate: z.string().datetime().optional(),
});

const TaskPatchSchema = z.object({
  userId: z.string().uuid(),
  taskId: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done", "skipped"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  progressPct: z.number().int().min(0).max(100).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const where = status
      ? and(
          eq(schema.coachingTasks.userId, userId),
          eq(schema.coachingTasks.status, status)
        )
      : eq(schema.coachingTasks.userId, userId);

    const rows = await db
      .select()
      .from(schema.coachingTasks)
      .where(where)
      .orderBy(desc(schema.coachingTasks.updatedAt));

    return NextResponse.json({ tasks: rows });
  } catch (error) {
    log("error", "API", "coaching_tasks_get_failed", {
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = TaskCreateSchema.parse(await request.json());
    const [created] = await db
      .insert(schema.coachingTasks)
      .values({
        userId: payload.userId,
        sessionId: payload.sessionId,
        goalId: payload.goalId,
        title: payload.title,
        description: payload.description,
        status: payload.status ?? "todo",
        priority: payload.priority ?? "medium",
        progressPct: payload.progressPct ?? 0,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
        updatedAt: new Date(),
      })
      .returning();
    return NextResponse.json({ task: created }, { status: 201 });
  } catch (error) {
    return handleError("coaching_tasks_post_failed", error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = TaskPatchSchema.parse(await request.json());
    const [existing] = await db
      .select({ id: schema.coachingTasks.id })
      .from(schema.coachingTasks)
      .where(
        and(
          eq(schema.coachingTasks.id, payload.taskId),
          eq(schema.coachingTasks.userId, payload.userId)
        )
      )
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(schema.coachingTasks)
      .set({
        title: payload.title,
        description: payload.description,
        status: payload.status,
        priority: payload.priority,
        progressPct: payload.progressPct,
        dueDate:
          payload.dueDate === undefined
            ? undefined
            : payload.dueDate === null
              ? null
              : new Date(payload.dueDate),
        updatedAt: new Date(),
      })
      .where(eq(schema.coachingTasks.id, payload.taskId))
      .returning();

    return NextResponse.json({ task: updated });
  } catch (error) {
    return handleError("coaching_tasks_patch_failed", error);
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
  if (error instanceof Error && error.message.includes("invalid input syntax")) {
    return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
