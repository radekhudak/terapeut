import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/openai";
import { z } from "zod";

const RequestSchema = z.object({
  personaPrompt: z.string(),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  currentPhase: z.string().optional(),
});

function assertTestMode() {
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.TEST_MODE_SECRET;
    if (!secret) {
      throw new Error("Test mode not enabled");
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTestMode();

    if (process.env.NODE_ENV === "production") {
      const headerSecret = request.headers.get("x-test-secret");
      if (headerSecret !== process.env.TEST_MODE_SECRET) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { personaPrompt, conversationHistory, currentPhase } = parsed.data;

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: personaPrompt },
    ];

    for (const msg of conversationHistory) {
      if (msg.role === "assistant") {
        messages.push({ role: "user", content: msg.content });
      } else {
        messages.push({ role: "assistant", content: msg.content });
      }
    }

    if (messages.length === 1) {
      messages.push({
        role: "user",
        content: "Ahoj, vítej. Jak ti mohu pomoci?",
      });
    }

    const response = await chatCompletion(messages, {
      temperature: 0.15,
    });

    return NextResponse.json({
      response,
      phase: currentPhase ?? "unknown",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Test mode not enabled") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Simulation failed", detail: message },
      { status: 500 }
    );
  }
}
