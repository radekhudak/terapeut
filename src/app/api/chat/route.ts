import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import {
  handleChat,
  consumePendingJob,
  processInsightJob,
} from "@/agents/orchestrator";
import { log, startTrace } from "@/lib/logger";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  startTrace();

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let userId: string;
    let sessionId: string | undefined;
    let text: string | undefined;
    let activeTopicId: string | undefined;
    let mode: "normal" | "daily_routine" | undefined;
    let routineId: string | undefined;
    let audioBuffer: Buffer | undefined;
    let audioFilename: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      userId = formData.get("userId") as string;
      sessionId = (formData.get("sessionId") as string) || undefined;
      text = (formData.get("text") as string) || undefined;
      activeTopicId = (formData.get("activeTopicId") as string) || undefined;
      mode = ((formData.get("mode") as string) || undefined) as
        | "normal"
        | "daily_routine"
        | undefined;
      routineId = (formData.get("routineId") as string) || undefined;

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
      activeTopicId = body.activeTopicId;
      mode = body.mode;
      routineId = body.routineId;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
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
      activeTopicId,
      mode,
      routineId,
      audioBuffer,
      audioFilename,
    });

    const pendingJob = consumePendingJob();
    if (pendingJob) {
      after(async () => {
        try {
          await processInsightJob(pendingJob);
        } catch (error) {
          log("error", "AsyncPipeline", "background_job_failed", {
            data: {
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    log("error", "API", "chat_error", {
      data: { error: message, stack },
    });

    return NextResponse.json(
      {
        error: "Chat failed",
        detail: message,
      },
      { status: 500 }
    );
  }
}
