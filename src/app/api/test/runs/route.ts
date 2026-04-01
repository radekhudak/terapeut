import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";

function assertTestMode() {
  if (process.env.NODE_ENV === "production" && !process.env.TEST_MODE_SECRET) {
    throw new Error("Test mode not enabled");
  }
}

export async function GET(request: NextRequest) {
  try {
    assertTestMode();
    if (process.env.NODE_ENV === "production") {
      const secret = request.headers.get("x-test-secret");
      if (secret !== process.env.TEST_MODE_SECRET) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const runs = await db
      .select()
      .from(schema.testRuns)
      .orderBy(desc(schema.testRuns.startedAt))
      .limit(50);

    return NextResponse.json(runs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Test mode not enabled") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTestMode();
    if (process.env.NODE_ENV === "production") {
      const secret = request.headers.get("x-test-secret");
      if (secret !== process.env.TEST_MODE_SECRET) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { personaId, userId } = body;

    if (!personaId || !userId) {
      return NextResponse.json(
        { error: "personaId and userId are required" },
        { status: 400 }
      );
    }

    const [run] = await db
      .insert(schema.testRuns)
      .values({
        personaId,
        userId,
        status: "running",
      })
      .returning();

    return NextResponse.json(run);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
