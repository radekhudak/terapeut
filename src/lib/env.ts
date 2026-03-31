import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten());
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

export const env = getEnv();
