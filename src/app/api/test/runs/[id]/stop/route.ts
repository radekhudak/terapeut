import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

function assertTestMode() {
  if (process.env.NODE_ENV === "production" && !process.env.TEST_MODE_SECRET) {
    throw new Error("Test mode not enabled");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertTestMode();
    if (process.env.NODE_ENV === "production") {
      const secret = request.headers.get("x-test-secret");
      if (secret !== process.env.TEST_MODE_SECRET) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { id } = await params;
    const body = await request.json();
    const { reason, stepCount } = body;

    const [updated] = await db
      .update(schema.testRuns)
      .set({
        status: reason === "completed" ? "completed" : "stopped",
        stoppedReason: reason ?? "manual",
        stepCount: stepCount ?? 0,
        endedAt: new Date(),
      })
      .where(eq(schema.testRuns.id, id))
      .returning();

    return NextResponse.json(updated ?? { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Test mode not enabled") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
