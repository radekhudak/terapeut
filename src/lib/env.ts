import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().optional(),
  POSTGRES_URL: z.string().optional(),
  ENCRYPTION_KEY: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema> & { databaseUrl: string };

let _env: Env | null = null;

function getEnv(): Env {
  if (_env) return _env;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten());
    throw new Error("Invalid environment variables");
  }

  const databaseUrl = parsed.data.POSTGRES_URL ?? parsed.data.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Either POSTGRES_URL or DATABASE_URL must be set");
  }

  _env = { ...parsed.data, databaseUrl };
  return _env;
}

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});
