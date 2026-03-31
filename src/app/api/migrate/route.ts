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
    await db.execute(
      sql`ALTER TABLE interaction_metadata ADD COLUMN IF NOT EXISTS topic_id uuid`
    );

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS coaching_tasks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        goal_id uuid REFERENCES goals(id),
        session_id uuid REFERENCES conversation_sessions(id),
        title varchar(255) NOT NULL,
        description text,
        status varchar(20) NOT NULL DEFAULT 'todo',
        priority varchar(20) NOT NULL DEFAULT 'medium',
        progress_pct integer NOT NULL DEFAULT 0,
        due_date timestamp,
        source_message_id uuid REFERENCES messages(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS topic_nodes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        parent_id uuid REFERENCES topic_nodes(id),
        title varchar(255) NOT NULL,
        progress_pct integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS topic_notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        topic_id uuid NOT NULL REFERENCES topic_nodes(id),
        user_id uuid NOT NULL,
        note_type varchar(20) NOT NULL,
        content_encrypted text NOT NULL,
        source_message_id uuid REFERENCES messages(id),
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS daily_routines (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        routine_date varchar(10) NOT NULL,
        timezone varchar(64) NOT NULL DEFAULT 'Europe/Prague',
        topics_covered jsonb NOT NULL DEFAULT '[]'::jsonb,
        questions jsonb NOT NULL DEFAULT '[]'::jsonb,
        completed boolean NOT NULL DEFAULT false,
        completed_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coaching_tasks_user_status_updated_idx
      ON coaching_tasks (user_id, status, updated_at DESC)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coaching_tasks_goal_idx
      ON coaching_tasks (goal_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS topic_nodes_user_parent_idx
      ON topic_nodes (user_id, parent_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS topic_notes_topic_created_idx
      ON topic_notes (topic_id, created_at DESC)
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS daily_routines_user_date_unique
      ON daily_routines (user_id, routine_date)
    `);

    await db.execute(sql`
      INSERT INTO coaching_tasks (
        user_id, goal_id, title, description, status, priority, progress_pct, due_date, created_at, updated_at
      )
      SELECT
        g.user_id,
        ap.goal_id,
        LEFT(ap.step_description, 255),
        ap.step_description,
        CASE WHEN ap.completed THEN 'done' ELSE 'todo' END,
        'medium',
        CASE WHEN ap.completed THEN 100 ELSE 0 END,
        ap.due_date,
        ap.created_at,
        now()
      FROM action_plans ap
      INNER JOIN goals g ON g.id = ap.goal_id
      WHERE NOT EXISTS (
        SELECT 1 FROM coaching_tasks ct
        WHERE ct.goal_id = ap.goal_id
          AND ct.description = ap.step_description
      )
    `);

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
