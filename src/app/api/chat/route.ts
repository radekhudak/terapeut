import { NextRequest, NextResponse } from "next/server";
import { handleChat } from "@/agents/orchestrator";
import { log, startTrace } from "@/lib/logger";

export async function POST(request: NextRequest) {
  startTrace();

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let userId: string;
    let sessionId: string | undefined;
    let text: string | undefined;
    let audioBuffer: Buffer | undefined;
    let audioFilename: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      userId = formData.get("userId") as string;
      sessionId = (formData.get("sessionId") as string) || undefined;
      text = (formData.get("text") as string) || undefined;

      const audioFile = formData.get("audio") as File | null;
      if (audioFile) {
        const arrayBuffer = await audioFile.arrayBuffer();
        audioBuffer = Buffer.from(arrayBuffer);
        audioFilename = audioFile.name || "recording.webm";
      }
    } else {
      const body = await request.json();
      userId = body.userId;
      sessionId = body.sessionId;
      text = body.text;
    }

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (!text && !audioBuffer) {
      return NextResponse.json(
        { error: "Either text or audio is required" },
        { status: 400 }
      );
    }

    const result = await handleChat({
      userId,
      sessionId,
      text,
      audioBuffer,
      audioFilename,
    });

    return NextResponse.json(result);
  } catch (error) {
    log("error", "API", "chat_error", {
      data: { error: error instanceof Error ? error.message : String(error) },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
