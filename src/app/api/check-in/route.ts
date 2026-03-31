import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { z } from "zod";
import { log } from "@/lib/logger";

const CheckInSchema = z.object({
  userId: z.string().uuid(),
  goalId: z.string().uuid().optional(),
  mood: z.number().min(1).max(10),
  energy: z.number().min(1).max(10),
  sleepQuality: z.number().min(1).max(10).optional(),
  progressNote: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = CheckInSchema.parse(body);

    const [checkIn] = await db
      .insert(schema.checkIns)
      .values({
        userId: data.userId,
        goalId: data.goalId,
        mood: data.mood,
        energy: data.energy,
        sleepQuality: data.sleepQuality,
        progressNote: data.progressNote,
      })
      .returning();

    log("info", "API", "check_in_saved", {
      userId: data.userId,
      data: { mood: data.mood, energy: data.energy },
    });

    return NextResponse.json(checkIn);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    log("error", "API", "check_in_error", {
      data: { error: error instanceof Error ? error.message : String(error) },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
