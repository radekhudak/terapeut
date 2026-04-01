import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { sql, inArray } from "drizzle-orm";

function assertTestMode() {
  if (process.env.NODE_ENV === "production" && !process.env.TEST_MODE_SECRET) {
    throw new Error("Test mode not enabled");
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTestMode();
    if (process.env.NODE_ENV === "production") {
      const secret = request.headers.get("x-test-secret");
      if (secret !== process.env.TEST_MODE_SECRET) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const testUsers = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(sql`display_name LIKE '[TEST]%'`);

    const userIds = testUsers.map((u) => u.id);

    if (userIds.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No test users found",
        deletedUsers: 0,
      });
    }

    // Delete test run events first (FK -> test_runs)
    const testRunRows = await db
      .select({ id: schema.testRuns.id })
      .from(schema.testRuns)
      .where(inArray(schema.testRuns.userId, userIds));
    const testRunIds = testRunRows.map((r) => r.id);

    if (testRunIds.length > 0) {
      await db
        .delete(schema.testRunEvents)
        .where(inArray(schema.testRunEvents.runId, testRunIds));
      await db
        .delete(schema.testRuns)
        .where(inArray(schema.testRuns.id, testRunIds));
    }

    // Get topic node IDs for these users
    const topicNodeRows = await db
      .select({ id: schema.topicNodes.id })
      .from(schema.topicNodes)
      .where(inArray(schema.topicNodes.userId, userIds));
    const topicNodeIds = topicNodeRows.map((t) => t.id);

    // 1. topic_notes (FK -> topic_nodes, messages)
    if (topicNodeIds.length > 0) {
      await db
        .delete(schema.topicNotes)
        .where(inArray(schema.topicNotes.topicId, topicNodeIds));
    }

    // 2. topic_nodes -- clear self-reference first, then delete
    if (topicNodeIds.length > 0) {
      await db
        .update(schema.topicNodes)
        .set({ parentId: null })
        .where(inArray(schema.topicNodes.userId, userIds));
      await db
        .delete(schema.topicNodes)
        .where(inArray(schema.topicNodes.userId, userIds));
    }

    // 3. coaching_tasks (FK -> goals, conversation_sessions, messages)
    await db
      .delete(schema.coachingTasks)
      .where(inArray(schema.coachingTasks.userId, userIds));

    // 4. daily_routines
    await db
      .delete(schema.dailyRoutines)
      .where(inArray(schema.dailyRoutines.userId, userIds));

    // Get goal IDs for FK cleanup
    const goalRows = await db
      .select({ id: schema.goals.id })
      .from(schema.goals)
      .where(inArray(schema.goals.userId, userIds));
    const goalIds = goalRows.map((g) => g.id);

    // 5. action_plans (FK -> goals)
    if (goalIds.length > 0) {
      await db
        .delete(schema.actionPlans)
        .where(inArray(schema.actionPlans.goalId, goalIds));
    }

    // 6. media_entries (FK -> goals) - only entries linked to test user goals
    if (goalIds.length > 0) {
      await db
        .delete(schema.mediaEntries)
        .where(inArray(schema.mediaEntries.linkedGoalId, goalIds));
    }

    // 7. check_ins (FK -> goals)
    await db
      .delete(schema.checkIns)
      .where(inArray(schema.checkIns.userId, userIds));

    // 8. goals
    if (goalIds.length > 0) {
      await db
        .delete(schema.goals)
        .where(inArray(schema.goals.id, goalIds));
    }

    // Get message IDs for FK cleanup
    const messageRows = await db
      .select({ id: schema.messages.id })
      .from(schema.messages)
      .where(inArray(schema.messages.userId, userIds));
    const messageIds = messageRows.map((m) => m.id);

    // 9. interaction_metadata (FK -> messages)
    if (messageIds.length > 0) {
      await db
        .delete(schema.interactionMetadata)
        .where(inArray(schema.interactionMetadata.messageId, messageIds));
    }

    // 10. feedback_log (FK -> messages)
    if (messageIds.length > 0) {
      await db
        .delete(schema.feedbackLog)
        .where(inArray(schema.feedbackLog.messageId, messageIds));
    }

    // Get session IDs for FK cleanup
    const sessionRows = await db
      .select({ id: schema.conversationSessions.id })
      .from(schema.conversationSessions)
      .where(inArray(schema.conversationSessions.userId, userIds));
    const sessionIds = sessionRows.map((s) => s.id);

    // 11. messages (FK -> conversation_sessions)
    if (messageIds.length > 0) {
      await db
        .delete(schema.messages)
        .where(inArray(schema.messages.id, messageIds));
    }

    // 12. conversation_sessions
    if (sessionIds.length > 0) {
      await db
        .delete(schema.conversationSessions)
        .where(inArray(schema.conversationSessions.id, sessionIds));
    }

    // 13. insights
    await db
      .delete(schema.insights)
      .where(inArray(schema.insights.userId, userIds));

    // 14. assessments
    await db
      .delete(schema.assessments)
      .where(inArray(schema.assessments.userId, userIds));

    // 15. journal_entries
    await db
      .delete(schema.journalEntries)
      .where(inArray(schema.journalEntries.userId, userIds));

    // 16. health_data
    await db
      .delete(schema.healthData)
      .where(inArray(schema.healthData.userId, userIds));

    // 17. onboarding_state
    await db
      .delete(schema.onboardingState)
      .where(inArray(schema.onboardingState.userId, userIds));

    // 18. user_profile
    await db
      .delete(schema.userProfile)
      .where(inArray(schema.userProfile.userId, userIds));

    // 19. users
    await db
      .delete(schema.users)
      .where(inArray(schema.users.id, userIds));

    return NextResponse.json({
      ok: true,
      message: `Cleaned up ${userIds.length} test user(s)`,
      deletedUsers: userIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Test mode not enabled") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
