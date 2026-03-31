import OpenAI from "openai";
import { env } from "./env";

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string
): Promise<{ text: string; language: string }> {
  const file = new File([new Uint8Array(audioBuffer)], filename, {
    type: "audio/webm",
  });

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: "cs",
    response_format: "verbose_json",
  });

  return {
    text: response.text,
    language: (response as unknown as { language?: string }).language ?? "cs",
  };
}

export async function generateSpeech(
  text: string
): Promise<ReadableStream<Uint8Array>> {
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: "nova",
    input: text,
    response_format: "mp3",
  });

  return response.body as unknown as ReadableStream<Uint8Array>;
}

export async function chatCompletion(
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: { temperature?: number; response_format?: { type: "json_object" } }
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: options?.temperature ?? 0.7,
    ...(options?.response_format && {
      response_format: options.response_format,
    }),
  });

  return response.choices[0]?.message?.content ?? "";
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
}
