import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { log } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const goals = await db
      .select()
      .from(schema.goals)
      .where(eq(schema.goals.userId, userId))
      .orderBy(schema.goals.updatedAt);

    const goalsWithActions = await Promise.all(
      goals.map(async (goal) => {
        const actions = await db
          .select()
          .from(schema.actionPlans)
          .where(eq(schema.actionPlans.goalId, goal.id))
          .orderBy(schema.actionPlans.dueDate);

        return { ...goal, actions };
      })
    );

    return NextResponse.json(goalsWithActions);
  } catch (error) {
    log("error", "API", "goals_error", {
      data: { error: error instanceof Error ? error.message : String(error) },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
