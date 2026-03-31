import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Auth middleware placeholder.
 *
 * Current behavior: reads userId from X-User-Id header or request body.
 * Validates that the user exists in DB.
 *
 * Future SSO: Replace with Auth.js (NextAuth v5) session check.
 * The rest of the app uses `getUserFromRequest()` so only this file
 * needs to change when SSO is added.
 *
 * Migration path:
 * 1. Install next-auth: `npm install next-auth@beta @auth/drizzle-adapter`
 * 2. Create `src/lib/auth-config.ts` with providers (Google, Apple, GitHub)
 * 3. Update this file to use `auth()` from next-auth instead of header check
 * 4. Link anonymous users to SSO accounts via `authProvider` + `authProviderId`
 * 5. Add middleware.ts for protected routes
 */
export async function getUserFromRequest(
  request: NextRequest
): Promise<{ userId: string } | null> {
  // Check header first (used by frontend)
  const headerUserId = request.headers.get("x-user-id");
  if (headerUserId) {
    const exists = await userExists(headerUserId);
    if (exists) return { userId: headerUserId };
  }

  // Check body for form data or JSON
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      // Can't consume body twice, so we rely on header for multipart
      return null;
    }

    const cloned = request.clone();
    const body = await cloned.json();
    if (body.userId) {
      const exists = await userExists(body.userId);
      if (exists) return { userId: body.userId };
    }
  } catch {
    // body parsing failed, that's fine
  }

  return null;
}

async function userExists(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return !!user;
}

/**
 * Helper: return 401 if user is not authenticated.
 * Use in API routes: const auth = await requireUser(request); if (auth instanceof NextResponse) return auth;
 */
export async function requireUser(
  request: NextRequest
): Promise<{ userId: string } | NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Provide X-User-Id header or userId in body." },
      { status: 401 }
    );
  }
  return user;
}
