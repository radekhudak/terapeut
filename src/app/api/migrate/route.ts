import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function POST() {
  try {
    await db.execute(
      sql`ALTER TABLE onboarding_state ALTER COLUMN current_phase TYPE varchar(30)`
    );
    return NextResponse.json({ ok: true, message: "Column altered" });
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
