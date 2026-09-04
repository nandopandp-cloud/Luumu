import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* =====================================================================
   LUUMU — Schema (Neon Postgres via Drizzle)
   ===================================================================== */

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  plan: text("plan").notNull().default("growth"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  logoUrl: text("logo_url"), // URL da logo no blob storage (null = usa a inicial)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---- Auth & Multi-tenant ---- */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"), // foto no blob storage (null = usa a inicial do nome)
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

/**
 * Projeto — unidade de isolamento dentro do workspace. Cada projeto tem sua
 * própria SDK key e agrupa surveys, eventos e respostas. O cliente instala o
 * script de um projeto no produto correspondente.
 */
export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logoUrl: text("logo_url"), // URL da logo no blob storage (null = usa a inicial do nome)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("projects_ws_idx").on(t.workspaceId)]
);

/**
 * Escopo de projetos de um membro. Regra (importante): a AUSÊNCIA de linhas para uma
 * membership significa "acesso a todos os projetos do workspace" — é o padrão de todo
 * membro novo e o comportamento histórico. Havendo ao menos uma linha, o membro passa a
 * enxergar SOMENTE os projetos listados aqui. O owner ignora esta tabela: vê sempre tudo.
 */
export const membershipProjects = pgTable(
  "membership_projects",
  {
    id: text("id").primaryKey(),
    membershipId: text("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("membership_projects_uidx").on(t.membershipId, t.projectId),
    index("membership_projects_membership_idx").on(t.membershipId),
    index("membership_projects_project_idx").on(t.projectId),
  ]
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Default"),
    publicKey: text("public_key").notNull().unique(), // pk_...
    secretHash: text("secret_hash").notNull(), // hash da sk_...
    domains: jsonb("domains").notNull().default([]), // allowlist de origens
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("api_keys_ws_idx").on(t.workspaceId),
    index("api_keys_project_idx").on(t.projectId),
    index("api_keys_pk_idx").on(t.publicKey),
  ]
);

/**
 * [EM DESUSO] O rate limit passou a ser contado em memória (lib/api/ratelimit.ts) — no banco
 * era uma escrita por requisição do SDK, e sem rotina de limpeza a tabela só crescia.
 * Mantida no schema para não exigir migração destrutiva; pode ser removida (DROP TABLE) num
 * momento planejado. As linhas antigas podem ser apagadas com segurança a qualquer momento.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    bucket: text("bucket").primaryKey(), // ex.: "res:<ip>:<pk>:<minuteWindow>"
    count: integer("count").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  }
);

/**
 * Eventos rastreados pelo SDK no produto do cliente (ex.: "onboarding_concluido").
 * Um registro por (workspace, nome); atualizado a cada ocorrência para virar gatilho de survey.
 */
export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // slug do evento, único por projeto
    count: integer("count").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("events_project_name_uidx").on(t.projectId, t.name),
    index("events_project_idx").on(t.projectId),
  ]
);

export const surveys = pgTable(
  "surveys",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(), // CSAT | NPS | CES | ...
    status: text("status").notNull().default("rascunho"), // rascunho|ativa|pausada|encerrada
    channel: text("channel").notNull().default("In-app"),
    audience: text("audience").notNull().default("Todos os usuários"),
    segment: text("segment").notNull().default("Todos"),
    language: text("language").notNull().default("pt"),
    trigger: text("trigger").notNull().default("Ao concluir onboarding"),
    // nome do evento (rastreado pelo SDK do cliente) que dispara esta survey; null = sem gatilho por evento
    // [LEGADO] mantido por compatibilidade; a fonte da verdade agora é triggerEvents (array)
    triggerEvent: text("trigger_event"),
    // lista de eventos que disparam esta survey (a survey aparece se QUALQUER um ocorrer); [] = sem gatilho
    triggerEvents: jsonb("trigger_events").notNull().default([]),
    // modo de público-alvo: "email" ou "id" quando audience = "Usuários específicos"; null caso "Todos"
    audienceMode: text("audience_mode"), // "email" | "id" | null
    // lista de emails ou IDs alvo quando audience = "Usuários específicos"
    audienceList: jsonb("audience_list").notNull().default([]),
    frequency: text("frequency").notNull().default("Uma vez por usuário"),
    delay: text("delay").notNull().default("5s"),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    // limite opcional de respostas; ao atingir, a survey é pausada automaticamente. null = sem limite
    responseLimit: integer("response_limit"),
    // Aparência do widget embutido: { format, position, theme, triggerDelay, accent }
    appearance: jsonb("appearance").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [index("surveys_workspace_idx").on(t.workspaceId), index("surveys_project_idx").on(t.projectId)]
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
    respondent: text("respondent"), // nullable (anônimo) — id externo informado via Luumu.identify()
    respondentEmail: text("respondent_email"), // email informado via Luumu.identify() (nullable)
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

/**
 * Agendamento de envio automático de relatórios por e-mail.
 * O cron diário (/api/cron/reports) processa os que já venceram (nextRunAt <= agora e ativo).
 */
export const scheduledReports = pgTable(
  "scheduled_reports",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    recipients: jsonb("recipients").notNull().default([]), // string[] de e-mails
    frequency: text("frequency").notNull().default("weekly"), // daily | weekly | monthly
    period: text("period").notNull().default("30d"), // janela de dados: 7d|30d|90d|12m|all
    format: text("format").notNull().default("pdf"), // pdf | xlsx | csv
    // ids das pesquisas incluídas ([] = todas do projeto)
    surveyIds: jsonb("survey_ids").notNull().default([]),
    active: boolean("active").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scheduled_reports_project_idx").on(t.projectId), index("scheduled_reports_next_run_idx").on(t.nextRunAt)]
);

/**
 * Link público (read-only) de um relatório de pesquisa. O token é secreto e aleatório;
 * quem tiver o link vê a página /r/[token] sem login. Revogável (active=false).
 */
export const publicReports = pgTable(
  "public_reports",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(), // parte secreta da URL /r/<token>
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    // pesquisa exibida; null = visão consolidada do projeto
    surveyId: text("survey_id").references(() => surveys.id, { onDelete: "cascade" }),
    period: text("period").notNull().default("all"), // janela de dados exibida
    active: boolean("active").notNull().default(true),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    viewCount: integer("view_count").notNull().default(0),
  },
  (t) => [index("public_reports_project_idx").on(t.projectId)]
);

export type Workspace = typeof workspaces.$inferSelect;
export type Survey = typeof surveys.$inferSelect;
export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type PublicReport = typeof publicReports.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Response = typeof responses.$inferSelect;
export type Answer = typeof answers.$inferSelect;
export type User = typeof users.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type MembershipProject = typeof membershipProjects.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Project = typeof projects.$inferSelect;
