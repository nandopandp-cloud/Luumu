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
