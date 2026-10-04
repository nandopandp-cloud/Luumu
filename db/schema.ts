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
  // última atividade autenticada (null = nunca acessou desde que o campo existe)
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
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

/**
 * Plataformas (hostnames) em que o SDK de um projeto já rodou.
 *
 * Uma mesma SDK key costuma ser instalada em mais de um produto do cliente — ex.: o projeto
 * GenieX atende preparasp.jovensgenios.com e matematicaem.jovensgenios.com com a mesma key.
 * Esta tabela é o catálogo dessas plataformas: o SDK informa o hostname em que está rodando,
 * e o painel usa a lista para direcionar uma pesquisa a uma (ou algumas) delas.
 * Um registro por (projeto, host); repetição não gera escrita.
 */
export const projectHosts = pgTable(
  "project_hosts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    host: text("host").notNull(), // hostname normalizado, sem protocolo e sem porta
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("project_hosts_project_host_uidx").on(t.projectId, t.host)]
);

/**
 * Catálogo de eventos POR PLATAFORMA: em qual hostname cada evento já foi visto.
 *
 * `events` é o catálogo do projeto inteiro e não diz de onde o evento veio. Quando uma mesma
 * key roda em vários produtos, o painel precisa separar "page_view_cursos do preparasp" de
 * "page_view_cursos do matematicaem". Cada plataforma tem o próprio teto (lib/db/events.ts),
 * então um produto barulhento não ocupa o espaço dos outros.
 */
export const eventHosts = pgTable(
  "event_hosts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    host: text("host").notNull(), // hostname normalizado (lib/hosts.ts)
    name: text("name").notNull(), // slug do evento (normalizeEventName)
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("event_hosts_project_host_name_uidx").on(t.projectId, t.host, t.name),
    index("event_hosts_project_idx").on(t.projectId),
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
    // plataformas (hostnames) onde a pesquisa pode aparecer; [] = em todas as plataformas do projeto
    targetHosts: jsonb("target_hosts").notNull().default([]),
    frequency: text("frequency").notNull().default("Uma vez por usuário"),
    delay: text("delay").notNull().default("5s"),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    // limite opcional de respostas; ao atingir, a survey é pausada automaticamente. null = sem limite
    responseLimit: integer("response_limit"),
    // Aparência do widget embutido: { format, position, theme, triggerDelay, accent }
    appearance: jsonb("appearance").notNull().default({}),
    // quem criou a pesquisa (null = criada antes deste campo existir, ou usuário removido)
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
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
    host: text("host"), // plataforma (hostname) de onde a resposta veio; null = link público/legado
    device: text("device"), // mobile | tablet | desktop; null = resposta anterior a este campo
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
    /**
     * Tipos de pesquisa acompanhados (ex.: ["CSAT","SUS"]). Quando preenchido, o envio
     * deixa de ser preso a `surveyIds` fixos: a cada ciclo o cron busca, para cada tipo,
     * a campanha cuja vigência terminou mais recentemente. Assim campanhas que se sucedem
     * (01–05, depois 05–10) são relatadas sozinhas, sem reconfigurar o agendamento.
     * [] = comportamento antigo (usa surveyIds).
     */
    surveyTypes: jsonb("survey_types").notNull().default([]),
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

/* =====================================================================
   PRODUCT TOURS — ver docs/tours/ARQUITETURA.md
   ===================================================================== */

/**
 * Tour guiado. O conteúdo vive em versões: a versão 0 é o rascunho (sempre existe, é o que o
 * builder edita) e cada publicação copia o rascunho para uma versão nova (1, 2, 3...). O que
 * os usuários finais veem é `publishedVersionId` — editar nunca altera o que está no ar.
 */
export const tours = pgTable(
  "tours",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("draft"), // draft | published | archived
    publishedVersionId: text("published_version_id"),
    // o rascunho difere da versão publicada (badge "alterações não publicadas")
    hasUnpublishedChanges: boolean("has_unpublished_changes").notNull().default(true),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tours_project_idx").on(t.projectId)]
);

/** Versão de um tour (TourVersion). `settings` = gatilho, frequência, público, plataformas, aparência. */
export const tourVersions = pgTable(
  "tour_versions",
  {
    id: text("id").primaryKey(),
    tourId: text("tour_id").notNull().references(() => tours.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    version: integer("version").notNull(), // 0 = rascunho
    status: text("status").notNull().default("draft"), // draft | published | superseded
    settings: jsonb("settings").notNull().default({}),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: text("published_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tour_versions_tour_version_uidx").on(t.tourId, t.version)]
);

/**
 * Passo de uma versão (TourStep). `target` é o descritor resiliente do elemento
 * (TourStepTarget, ver lib/tours/types.ts) e `config` guarda o resto do passo tipado
 * (posição por dispositivo, botões, ação, condições...). `key` é estável entre versões.
 */
export const tourSteps = pgTable(
  "tour_steps",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id").notNull().references(() => tourVersions.id, { onDelete: "cascade" }),
    tourId: text("tour_id").notNull().references(() => tours.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    order: integer("order").notNull().default(0),
    type: text("type").notNull(), // modal | tooltip | popover | spotlight
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    route: text("route"),
    target: jsonb("target"),
    config: jsonb("config").notNull().default({}),
  },
  (t) => [index("tour_steps_version_idx").on(t.versionId)]
);

/** Eventos de execução dos tours (TourEvent) — base do analytics. */
export const tourEvents = pgTable(
  "tour_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    tourId: text("tour_id").notNull().references(() => tours.id, { onDelete: "cascade" }),
    versionId: text("version_id"),
    stepKey: text("step_key"),
    type: text("type").notNull(),
    userId: text("user_id"),
    anonymousId: text("anonymous_id"),
    sessionId: text("session_id"),
    route: text("route"),
    host: text("host"),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tour_events_tour_created_idx").on(t.tourId, t.createdAt),
    index("tour_events_project_idx").on(t.projectId),
  ]
);

/** Rotas do produto vistas pelo Product Discovery Engine (ProductRoute). */
export const productRoutes = pgTable(
  "product_routes",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    host: text("host").notNull(),
    route: text("route").notNull(),
    title: text("title").notNull().default(""),
    elementCount: integer("element_count").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("product_routes_uidx").on(t.projectId, t.host, t.route)]
);

/**
 * Element Registry (ProductElement): elementos interativos que o discovery encontrou em cada
 * rota. Alimenta o seletor de alvo do builder e, no futuro, o gerador de tours por IA — que só
 * pode usar elementos daqui, nunca inventar.
 */
export const productElements = pgTable(
  "product_elements",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    host: text("host").notNull(),
    route: text("route").notNull(),
    fingerprint: text("fingerprint").notNull(),
    kind: text("kind").notNull().default("other"),
    label: text("label").notNull().default(""),
    target: jsonb("target").notNull(),
    stability: real("stability").notNull().default(0),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("product_elements_uidx").on(t.projectId, t.host, t.route, t.fingerprint),
    index("product_elements_project_idx").on(t.projectId),
  ]
);

export type Tour = typeof tours.$inferSelect;
export type TourVersion = typeof tourVersions.$inferSelect;
export type TourStepRow = typeof tourSteps.$inferSelect;
export type TourEvent = typeof tourEvents.$inferSelect;
export type ProductElement = typeof productElements.$inferSelect;

/**
 * Pedido de mudança de plano feito na área Plano & Cobrança. Enquanto não há gateway de
 * pagamento, a troca é confirmada pela equipe Luumu: o pedido fica registrado aqui (e a equipe
 * é avisada por e-mail) até ser atendido.
 */
export const planRequests = pgTable(
  "plan_requests",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    plan: text("plan").notNull(), // PlanId pedido
    cycle: text("cycle").notNull().default("monthly"), // monthly | annual
    fromPlan: text("from_plan").notNull(),
    message: text("message").notNull().default(""),
    status: text("status").notNull().default("pending"), // pending | done | canceled
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("plan_requests_ws_idx").on(t.workspaceId)]
);

export type PlanRequest = typeof planRequests.$inferSelect;

/**
 * Coleta de heatmaps por projeto. Sem linha = desligada: o SDK é atualizado em todos os sites
 * dos clientes de uma vez, então a coleta de cliques/movimento só começa quando alguém ativa.
 * (Tabela própria, e não coluna em `projects`: sem a migração aplicada, só os heatmaps param.)
 */
export const heatmapSettings = pgTable("heatmap_settings", {
  projectId: text("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Uma visita a uma página com heatmap ativo (enviada pelo SDK ao sair da página).
 * Cliques e movimento ficam ancorados em elementos (seletor + posição relativa); ver
 * lib/heatmaps/core.ts. A agregação é feita no banco (jsonb), por página e período.
 */
export const heatmapPageviews = pgTable(
  "heatmap_pageviews",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    host: text("host").notNull().default(""),
    path: text("path").notNull(), // rota normalizada ("home", "cursos/:id")
    device: text("device").notNull(), // desktop | tablet | mobile
    sessionId: text("session_id").notNull(),
    viewportW: integer("viewport_w").notNull().default(0),
    viewportH: integer("viewport_h").notNull().default(0),
    docH: integer("doc_h").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    maxScroll: integer("max_scroll").notNull().default(0), // 0–100
    maxMove: integer("max_move").notNull().default(0), // 0–100
    clicks: jsonb("clicks").notNull().default([]), // [{ s, x, y }]
    moves: jsonb("moves").notNull().default({}), // { "sel|gx|gy": n }
    hovers: jsonb("hovers").notNull().default({}), // { sel: ms }
    labels: jsonb("labels").notNull().default({}), // { sel: rótulo }
    clickPath: text("click_path"), // "a ⟶ b ⟶ c" (null com menos de 2 cliques)
    // fração das sessões gravadas quando esta visita foi coletada (amostragem por cota)
    sampleRate: real("sample_rate").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("heatmap_pv_page_idx").on(t.projectId, t.host, t.path, t.createdAt),
    index("heatmap_pv_ws_idx").on(t.workspaceId, t.createdAt),
  ]
);

/** Cópia da página (HTML sem scripts, com dados mascarados), gzip em base64: o fundo do mapa. */
export const heatmapSnapshots = pgTable(
  "heatmap_snapshots",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    host: text("host").notNull().default(""),
    path: text("path").notNull(),
    device: text("device").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    viewportH: integer("viewport_h").notNull().default(0),
    html: text("html").notNull(), // gzip + base64
    bytes: integer("bytes").notNull().default(0), // tamanho original
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("heatmap_snap_page_uq").on(t.projectId, t.host, t.path, t.device)]
);

export type HeatmapPageview = typeof heatmapPageviews.$inferSelect;

/**
 * Analytics de produto por projeto: liga/desliga a coleta e as métricas escolhidas pelo time
 * (North Star, ativação, início/conclusão de tarefa = nomes de eventos). Sem linha = desligado.
 */
export const analyticsSettings = pgTable("analytics_settings", {
  projectId: text("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  northStarEvent: text("north_star_event"),
  activationEvent: text("activation_event"),
  taskStartEvent: text("task_start_event"),
  taskDoneEvent: text("task_done_event"),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Captura de nome e foto do usuário lida da página do produto (para a workspace inteira).
 * Seletores vazios = detecção automática (avatar no topo da tela e o nome ao lado dele).
 */
export const identityCaptureSettings = pgTable("identity_capture_settings", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  nameSelector: text("name_selector").notNull().default(""),
  avatarSelector: text("avatar_selector").notNull().default(""),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Um usuário (anônimo, por navegador) visto no projeto: primeira visita e de onde veio. */
export const analyticsUsers = pgTable(
  "analytics_users",
  {
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    anonId: text("anon_id").notNull(),
    userId: text("user_id"), // ID informado por Luumu.identify (último visto)
    userEmail: text("user_email"), // e-mail informado por Luumu.identify
    userName: text("user_name"), // nome informado por Luumu.identify (name / first_name + last_name)
    userAvatar: text("user_avatar"), // URL https da foto informada por Luumu.identify (avatar / picture / photo_url)
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    firstChannel: text("first_channel").notNull().default("direct"),
    firstSource: text("first_source").notNull().default(""),
    firstCampaign: text("first_campaign").notNull().default(""),
    firstLanding: text("first_landing").notNull().default(""),
    firstHost: text("first_host").notNull().default(""),
    firstDevice: text("first_device").notNull().default("desktop"),
  },
  (t) => [
    uniqueIndex("analytics_users_pk").on(t.projectId, t.anonId),
    index("analytics_users_first_idx").on(t.projectId, t.firstSeenAt),
  ]
);

/** Uma sessão (30 min sem atividade encerra). Atualizada a cada envio do SDK. */
export const analyticsSessions = pgTable(
  "analytics_sessions",
  {
    id: text("id").primaryKey(), // project_id + ":" + sid do SDK
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    anonId: text("anon_id").notNull(),
    userId: text("user_id"),
    host: text("host").notNull().default(""),
    device: text("device").notNull().default("desktop"),
    os: text("os").notNull().default("Outro"),
    browser: text("browser").notNull().default("Outro"),
    viewportW: integer("viewport_w").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    pageviews: integer("pageviews").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    landingPath: text("landing_path").notNull().default(""),
    exitPath: text("exit_path").notNull().default(""),
    channel: text("channel").notNull().default("direct"),
    referrer: text("referrer").notNull().default(""),
    utmSource: text("utm_source").notNull().default(""),
    utmMedium: text("utm_medium").notNull().default(""),
    utmCampaign: text("utm_campaign").notNull().default(""),
  },
  (t) => [index("analytics_sessions_started_idx").on(t.projectId, t.startedAt), index("analytics_sessions_anon_idx").on(t.projectId, t.anonId)]
);

/** Uma tela vista numa sessão, com o tempo ativo e os eventos que aconteceram nela. */
export const analyticsPageviews = pgTable(
  "analytics_pageviews",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    anonId: text("anon_id").notNull(),
    host: text("host").notNull().default(""),
    path: text("path").notNull(),
    device: text("device").notNull().default("desktop"),
    durationMs: integer("duration_ms").notNull().default(0),
    events: text("events").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("analytics_pv_project_idx").on(t.projectId, t.createdAt)]
);

/** Visões salvas do Analytics (aba + filtros + blocos), pessoais ou do time. */
export const analyticsViews = pgTable(
  "analytics_views",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    goal: text("goal").notNull().default(""),
    shared: boolean("shared").notNull().default(false),
    config: jsonb("config").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("analytics_views_project_idx").on(t.projectId)]
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
export type ProjectHost = typeof projectHosts.$inferSelect;
export type EventHost = typeof eventHosts.$inferSelect;
