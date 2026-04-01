import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";

function assertTestMode() {
  if (process.env.NODE_ENV === "production" && !process.env.TEST_MODE_SECRET) {
    throw new Error("Test mode not enabled");
  }
}

export async function GET(
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
    const events = await db
      .select()
      .from(schema.testRunEvents)
      .where(eq(schema.testRunEvents.runId, id))
      .orderBy(asc(schema.testRunEvents.stepIndex));

    return NextResponse.json(events);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Test mode not enabled") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertTestMode();

    const { id } = await params;
    const body = await request.json();
    const { stepIndex, eventType, payloadJson, latencyMs } = body;

    const [event] = await db
      .insert(schema.testRunEvents)
      .values({
        runId: id,
        stepIndex: stepIndex ?? 0,
        eventType: eventType ?? "unknown",
        payloadJson: payloadJson ?? {},
        latencyMs: latencyMs ?? null,
      })
      .returning();

    return NextResponse.json(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
