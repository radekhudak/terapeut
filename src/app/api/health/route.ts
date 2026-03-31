import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // DB connection
  try {
    const result = await db.execute(sql`SELECT 1 as ok`);
    checks.database = { ok: true };
  } catch (error) {
    checks.database = {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  // pgvector extension
  try {
    await db.execute(
      sql`SELECT * FROM pg_extension WHERE extname = 'vector'`
    );
    checks.pgvector = { ok: true };
  } catch (error) {
    checks.pgvector = {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  // OpenAI key
  checks.openai = {
    ok: !!process.env.OPENAI_API_KEY?.startsWith("sk-"),
    detail: process.env.OPENAI_API_KEY
      ? `set (${process.env.OPENAI_API_KEY.slice(0, 7)}...)`
      : "missing",
  };

  // Encryption key
  checks.encryption = {
    ok: (process.env.ENCRYPTION_KEY?.length ?? 0) >= 32,
    detail: process.env.ENCRYPTION_KEY ? "set" : "missing",
  };

  // Tables
  try {
    const result = await db.execute(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    checks.tables = {
      ok: (result.rows as Array<{ tablename: string }>).length >= 10,
      detail: (result.rows as Array<{ tablename: string }>)
        .map((r) => r.tablename)
        .join(", "),
    };
  } catch (error) {
    checks.tables = {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    { status: allOk ? "healthy" : "unhealthy", checks },
    { status: allOk ? 200 : 503 }
  );
}
