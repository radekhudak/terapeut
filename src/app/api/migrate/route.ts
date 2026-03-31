import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function POST() {
  try {
    await db.execute(
      sql`ALTER TABLE onboarding_state ALTER COLUMN current_phase TYPE varchar(30)`
    );
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS username varchar(50)`
    );
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text`
    );
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)`
    );
    return NextResponse.json({
      ok: true,
      message: "Migrations applied",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
