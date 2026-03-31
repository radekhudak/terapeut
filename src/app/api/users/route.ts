import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { log } from "@/lib/logger";
import { hashPassword } from "@/lib/password";

function sanitizeUser<T extends Record<string, unknown>>(user: T) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user as T & { passwordHash?: string | null };
  return safe;
}

/**
 * POST /api/users -- Create a user.
 * - If username+password are provided, creates a non-anonymous local user.
 * - If not provided, creates anonymous user (backward compatibility).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const displayName = body.displayName as string | undefined;
    const username = body.username as string | undefined;
    const password = body.password as string | undefined;

    if ((username && !password) || (!username && password)) {
      return NextResponse.json(
        { error: "username and password must be provided together" },
        { status: 400 }
      );
    }

    if (username && password) {
      if (username.length < 3) {
        return NextResponse.json(
          { error: "username must be at least 3 characters" },
          { status: 400 }
        );
      }
      if (password.length < 6) {
        return NextResponse.json(
          { error: "password must be at least 6 characters" },
          { status: 400 }
        );
      }

      const existing = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.username, username))
        .limit(1);

      if (existing[0]) {
        return NextResponse.json(
          { error: "Username already exists" },
          { status: 409 }
        );
      }

      const passwordHash = await hashPassword(password);
      const [user] = await db
        .insert(schema.users)
        .values({
          displayName: displayName ?? username,
          username,
          passwordHash,
          authProvider: "local",
          authProviderId: username,
          isAnonymous: false,
        })
        .returning();

      log("info", "API", "user_created", {
        userId: user.id,
        data: { isAnonymous: false, username },
      });

      return NextResponse.json(sanitizeUser(user), { status: 201 });
    }

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

    return NextResponse.json(sanitizeUser(user), { status: 201 });
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
 * GET /api/users?list=1 -- List users for quick switching
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shouldList = searchParams.get("list") === "1";
    const userId = searchParams.get("id");

    if (shouldList) {
      const users = await db.select().from(schema.users).limit(50);
      return NextResponse.json(users.map((u) => sanitizeUser(u)));
    }

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

    return NextResponse.json(sanitizeUser(user));
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
