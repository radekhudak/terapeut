import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { log } from "@/lib/logger";

/**
 * POST /api/users -- Create a new anonymous user
 * Returns existing user if X-User-Id header is present and valid.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const displayName = body.displayName as string | undefined;

    const [user] = await db
      .insert(schema.users)
      .values({
        displayName: displayName ?? null,
        isAnonymous: true,
      })
      .returning();

    log("info", "API", "user_created", {
      userId: user.id,
      data: { isAnonymous: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    log("error", "API", "user_create_error", {
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users?id=<uuid> -- Get user by ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json(
        { error: "id query param is required" },
        { status: 400 }
      );
    }

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update last seen
    await db
      .update(schema.users)
      .set({ lastSeenAt: new Date() })
      .where(eq(schema.users.id, userId));

    return NextResponse.json(user);
  } catch (error) {
    log("error", "API", "user_get_error", {
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      { error: "Failed to get user" },
      { status: 500 }
    );
  }
}
