import { z } from "zod";
import { chatCompletion } from "@/lib/openai";
import { log } from "@/lib/logger";
import type OpenAI from "openai";

const MAX_RETRIES = 2;

export abstract class BaseAgent<TOutput> {
  abstract name: string;
  abstract systemPrompt: string;
  abstract outputSchema: z.ZodType<TOutput>;

  async run(
    userMessages: OpenAI.ChatCompletionMessageParam[],
    context?: Record<string, unknown>
  ): Promise<TOutput> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: this.systemPrompt },
      ...userMessages,
    ];

    if (context) {
      messages.splice(1, 0, {
        role: "system",
        content: `Context:\n${JSON.stringify(context, null, 2)}`,
      });
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const raw = await chatCompletion(messages, {
          temperature: 0.4,
          response_format: { type: "json_object" },
        });

        const parsed = JSON.parse(raw);
        const validated = this.outputSchema.parse(parsed);

        log("info", this.name, "success", {
          attempt,
          data: validated as Record<string, unknown>,
        });

        return validated;
      } catch (error) {
        log("warn", this.name, "retry", {
          attempt,
          data: {
            error: error instanceof Error ? error.message : String(error),
          },
        });

        if (attempt === MAX_RETRIES) {
          log("error", this.name, "failed_after_retries", {
            data: {
              error: error instanceof Error ? error.message : String(error),
            },
          });
          throw error;
        }
      }
    }

    throw new Error(`${this.name}: unreachable`);
  }
}
