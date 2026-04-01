import {
  AnyPgColumn,
  pgTable,
  uuid,
  text,
  timestamp,
  real,
  integer,
  boolean,
  jsonb,
  varchar,
  index,
  uniqueIndex,
  vector,
  bigint,
} from "drizzle-orm/pg-core";

// ── Users ──────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayName: varchar("display_name", { length: 100 }),
  username: varchar("username", { length: 50 }).unique(),
  passwordHash: text("password_hash"),
  email: varchar("email", { length: 255 }).unique(),
  // SSO fields -- null until auth is enabled
  authProvider: varchar("auth_provider", { length: 30 }), // google | apple | github | email | null
  authProviderId: varchar("auth_provider_id", { length: 255 }),
  avatarUrl: text("avatar_url"),
  isAnonymous: boolean("is_anonymous").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});

// ── Messages ───────────────────────────────────────────────────────
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => conversationSessions.id),
    userId: uuid("user_id").notNull(),
    role: varchar("role", { length: 20 }).notNull(), // user | assistant | system
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("messages_session_idx").on(table.sessionId),
    index("messages_user_idx").on(table.userId),
  ]
);

// ── Conversation Sessions ──────────────────────────────────────────
export const conversationSessions = pgTable("conversation_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  sessionMode: varchar("session_mode", { length: 20 }).default("mixed"), // therapy | coaching | mixed
});

// ── User Profile ───────────────────────────────────────────────────
export const userProfile = pgTable("user_profile", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique(),
  traits: text("traits"), // AES-256 encrypted JSON
  confidenceScore: real("confidence_score").default(0.3),
  disprovedPatterns: jsonb("disproved_patterns").default([]),
  coachingPreferences: jsonb("coaching_preferences").default({}),
  interactionStyle: varchar("interaction_style", { length: 20 }).default(
    "adaptive"
  ), // comfort | candid | adaptive
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Insights ───────────────────────────────────────────────────────
export const insights = pgTable(
  "insights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    insightTextEncrypted: text("insight_text_encrypted").notNull(), // AES-256
    insightType: varchar("insight_type", { length: 20 }).notNull(), // pattern | observation | milestone
    confidence: real("confidence").default(0.5),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("insights_user_idx").on(table.userId)]
);

// ── Feedback Log ───────────────────────────────────────────────────
export const feedbackLog = pgTable(
  "feedback_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id").references(() => messages.id),
    userId: uuid("user_id").notNull(),
    type: varchar("type", { length: 20 }).notNull(), // positive | negative | correction
    correctionDetail: text("correction_detail"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("feedback_user_idx").on(table.userId)]
);

// ── Interaction Metadata ───────────────────────────────────────────
export const interactionMetadata = pgTable("interaction_metadata", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: uuid("message_id").references(() => messages.id),
  topicId: uuid("topic_id"),
  userMoodDelta: real("user_mood_delta"),
  voiceSentiment: varchar("voice_sentiment", { length: 50 }),
  responseMode: varchar("response_mode", { length: 20 }), // therapy | coaching
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Goals ──────────────────────────────────────────────────────────
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    area: varchar("area", { length: 30 }).notNull(), // health | career | relationships | habits | mindset | finance | fun | other
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    targetDate: timestamp("target_date"),
    status: varchar("status", { length: 20 }).default("active"), // active | completed | paused | abandoned
    progressPct: integer("progress_pct").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("goals_user_idx").on(table.userId)]
);

// ── Action Plans ───────────────────────────────────────────────────
export const actionPlans = pgTable(
  "action_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id),
    stepDescription: text("step_description").notNull(),
    dueDate: timestamp("due_date"),
    completed: boolean("completed").default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("action_plans_goal_idx").on(table.goalId)]
);

// ── Check-ins ──────────────────────────────────────────────────────
export const checkIns = pgTable(
  "check_ins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    goalId: uuid("goal_id").references(() => goals.id),
    mood: integer("mood"), // 1-10
    energy: integer("energy"), // 1-10
    sleepQuality: integer("sleep_quality"), // 1-10
    progressNote: text("progress_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("check_ins_user_idx").on(table.userId)]
);

// ── Assessments ────────────────────────────────────────────────────
export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    type: varchar("type", { length: 20 }).notNull(), // phq9 | gad7 | pss10 | psqi
    score: integer("score").notNull(),
    answers: jsonb("answers").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("assessments_user_idx").on(table.userId)]
);

// ── Journal Entries ────────────────────────────────────────────────
export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    contentEncrypted: text("content_encrypted").notNull(), // AES-256
    moodTag: varchar("mood_tag", { length: 50 }),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("journal_user_idx").on(table.userId)]
);

// ── Health Data ────────────────────────────────────────────────────
export const healthData = pgTable(
  "health_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    source: varchar("source", { length: 30 }).notNull(), // apple_health | google_fit | manual
    metricType: varchar("metric_type", { length: 30 }).notNull(), // sleep_hours | steps | hrv | ...
    value: real("value").notNull(),
    recordedAt: timestamp("recorded_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("health_data_user_idx").on(table.userId),
    index("health_data_recorded_idx").on(table.recordedAt),
  ]
);

// ── Media Entries ──────────────────────────────────────────────────
export const mediaEntries = pgTable("media_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // photo | screenshot
  aiDescription: text("ai_description"),
  linkedGoalId: uuid("linked_goal_id").references(() => goals.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Onboarding State ───────────────────────────────────────────────
export const onboardingState = pgTable("onboarding_state", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique(),
  currentPhase: varchar("current_phase", { length: 30 }).default("A"),
  coveredAreas: jsonb("covered_areas").default([]),
  pendingAreas: jsonb("pending_areas").default([]),
  diagnosticData: jsonb("diagnostic_data").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Coaching Tasks ──────────────────────────────────────────────────
export const coachingTasks = pgTable(
  "coaching_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    goalId: uuid("goal_id").references(() => goals.id),
    sessionId: uuid("session_id").references(() => conversationSessions.id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).default("todo").notNull(), // todo | in_progress | done | skipped
    priority: varchar("priority", { length: 20 }).default("medium").notNull(), // low | medium | high
    progressPct: integer("progress_pct").default(0).notNull(),
    dueDate: timestamp("due_date"),
    sourceMessageId: uuid("source_message_id").references(() => messages.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("coaching_tasks_user_status_updated_idx").on(
      table.userId,
      table.status,
      table.updatedAt
    ),
    index("coaching_tasks_goal_idx").on(table.goalId),
  ]
);

// ── Topic Nodes ─────────────────────────────────────────────────────
export const topicNodes = pgTable(
  "topic_nodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => topicNodes.id),
    title: varchar("title", { length: 255 }).notNull(),
    progressPct: integer("progress_pct").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("topic_nodes_user_parent_idx").on(table.userId, table.parentId)]
);

// ── Topic Notes ─────────────────────────────────────────────────────
export const topicNotes = pgTable(
  "topic_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topicNodes.id),
    userId: uuid("user_id").notNull(),
    noteType: varchar("note_type", { length: 20 }).notNull(), // key_thought | milestone | user_note
    contentEncrypted: text("content_encrypted").notNull(),
    sourceMessageId: uuid("source_message_id").references(() => messages.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("topic_notes_topic_created_idx").on(table.topicId, table.createdAt)]
);

// ── Daily Routines ──────────────────────────────────────────────────
export const dailyRoutines = pgTable(
  "daily_routines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    routineDate: varchar("routine_date", { length: 10 }).notNull(), // YYYY-MM-DD in user's timezone
    timezone: varchar("timezone", { length: 64 }).default("Europe/Prague").notNull(),
    topicsCovered: jsonb("topics_covered").default([]).notNull(),
    questions: jsonb("questions").default([]).notNull(),
    completed: boolean("completed").default(false).notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("daily_routines_user_date_unique").on(
      table.userId,
      table.routineDate
    ),
  ]
);

// ── Test Runs (telemetry) ──────────────────────────────────────────
export const testRuns = pgTable(
  "test_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personaId: varchar("persona_id", { length: 50 }).notNull(),
    userId: uuid("user_id").notNull(),
    sessionId: uuid("session_id"),
    status: varchar("status", { length: 20 }).default("running").notNull(),
    stepCount: integer("step_count").default(0).notNull(),
    stoppedReason: varchar("stopped_reason", { length: 100 }),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
  },
  (table) => [index("test_runs_status_idx").on(table.status)]
);

// ── Test Run Events ────────────────────────────────────────────────
export const testRunEvents = pgTable(
  "test_run_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => testRuns.id),
    stepIndex: integer("step_index").notNull(),
    eventType: varchar("event_type", { length: 30 }).notNull(),
    payloadJson: jsonb("payload_json").default({}).notNull(),
    latencyMs: bigint("latency_ms", { mode: "number" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("test_run_events_run_idx").on(table.runId, table.stepIndex)]
);
