import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { log } from "@/lib/logger";

const CompleteSchema = z.object({
  userId: z.string().uuid(),
  routineId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const payload = CompleteSchema.parse(await request.json());
    const [existing] = await db
      .select({ id: schema.dailyRoutines.id })
      .from(schema.dailyRoutines)
      .where(
        and(
          eq(schema.dailyRoutines.id, payload.routineId),
          eq(schema.dailyRoutines.userId, payload.userId)
        )
      )
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    }

    const [routine] = await db
      .update(schema.dailyRoutines)
      .set({ completed: true, completedAt: new Date() })
      .where(eq(schema.dailyRoutines.id, payload.routineId))
      .returning();

    return NextResponse.json({ routine });
  } catch (error) {
    log("error", "API", "daily_routine_complete_failed", {
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
