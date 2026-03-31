import { NextRequest, NextResponse } from "next/server";
import { generateSpeech } from "@/lib/openai";
import { log } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    const audioStream = await generateSpeech(text);

    return new NextResponse(audioStream as unknown as BodyInit, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    log("error", "API", "tts_error", {
      data: { error: error instanceof Error ? error.message : String(error) },
    });

    return NextResponse.json(
      { error: "TTS generation failed" },
      { status: 500 }
    );
  }
}
