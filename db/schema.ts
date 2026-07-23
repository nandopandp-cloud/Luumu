import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  index,
} from "drizzle-orm/pg-core";

/* =====================================================================
   LUUMU — Schema (Neon Postgres via Drizzle)
   ===================================================================== */

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  plan: text("plan").notNull().default("growth"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---- Auth & Multi-tenant ---- */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"), // owner | admin | editor | viewer
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("memberships_user_idx").on(t.userId), index("memberships_ws_idx").on(t.workspaceId)]
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Default"),
    publicKey: text("public_key").notNull().unique(), // pk_...
    secretHash: text("secret_hash").notNull(), // hash da sk_...
    domains: jsonb("domains").notNull().default([]), // allowlist de origens
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("api_keys_ws_idx").on(t.workspaceId), index("api_keys_pk_idx").on(t.publicKey)]
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    bucket: text("bucket").primaryKey(), // ex.: "res:<ip>:<pk>:<minuteWindow>"
    count: integer("count").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  }
);

export const surveys = pgTable(
  "surveys",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(), // CSAT | NPS | CES | ...
    status: text("status").notNull().default("rascunho"), // rascunho|ativa|pausada|encerrada
    channel: text("channel").notNull().default("In-app"),
    audience: text("audience").notNull().default("Todos os usuários"),
    segment: text("segment").notNull().default("Todos"),
    language: text("language").notNull().default("pt"),
    trigger: text("trigger").notNull().default("Ao concluir onboarding"),
    frequency: text("frequency").notNull().default("Uma vez por usuário"),
    delay: text("delay").notNull().default("5s"),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    // Aparência do widget embutido: { format, position, theme, triggerDelay, accent }
    appearance: jsonb("appearance").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [index("surveys_workspace_idx").on(t.workspaceId)]
);

export const questions = pgTable(
  "questions",
  {
    id: text("id").primaryKey(),
    surveyId: text("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    order: integer("order").notNull().default(0),
    blockId: text("block_id").notNull(), // csat|nps|choice|long|...
    title: text("title").notNull(),
    required: boolean("required").notNull().default(false),
    // { options?: string[], min?, max?, minLabel?, maxLabel?, placeholder? }
    config: jsonb("config").notNull().default({}),
    // { showIf?: { questionId: string, op: "lte"|"gte"|"eq", value: number|string } }
    logic: jsonb("logic").notNull().default({}),
  },
  (t) => [index("questions_survey_idx").on(t.surveyId)]
);

export const responses = pgTable(
  "responses",
  {
    id: text("id").primaryKey(),
    surveyId: text("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    respondent: text("respondent"), // nullable (anônimo)
    channel: text("channel").notNull().default("Link"),
    sentiment: text("sentiment"), // positivo|neutro|negativo (derivado)
    score: real("score"), // nota principal (nullable)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("responses_survey_idx").on(t.surveyId)]
);

export const answers = pgTable(
  "answers",
  {
    id: text("id").primaryKey(),
    responseId: text("response_id")
      .notNull()
      .references(() => responses.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    value: jsonb("value").notNull().default({}),
  },
  (t) => [index("answers_response_idx").on(t.responseId)]
);

export type Workspace = typeof workspaces.$inferSelect;
export type Survey = typeof surveys.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Response = typeof responses.$inferSelect;
export type Answer = typeof answers.$inferSelect;
export type User = typeof users.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
