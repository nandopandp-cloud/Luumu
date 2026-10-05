import { resolvePeople, type Person } from "./people";
import "server-only";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "./client";
import { answers, questions, responses, surveys } from "@/db/schema";
import { scopeWhere, type Scope } from "./responses";

/*
  Dados da tela de Respostas: feed com ordenação e abas no banco, contagem por aba, série
  diária para os minigráficos e o detalhe de uma resposta. As funções recebem o mesmo `Scope`
  das demais (projeto + pesquisa + período + plataforma), então tudo bate com os filtros.
*/

export const FEED_SORTS = [
  "recent",
  "oldest",
  "score_desc",
  "score_asc",
  "comments_first",
  "longest",
  "negative_first",
  "positive_first",
] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export const FEED_VIEWS = ["all", "comments", "positive", "negative", "neutral"] as const;
export type FeedView = (typeof FEED_VIEWS)[number];

/**
 * Comentário principal da resposta: o primeiro texto livre (perguntas "long"/"short" gravam
 * `{ text }`). Subconsulta correlacionada: permite filtrar e ordenar por comentário no banco.
 */
export const commentSql = sql<string | null>`(
  select nullif(btrim(a.value->>'text'), '')
    from ${answers} a
   where a.response_id = ${responses.id} and nullif(btrim(a.value->>'text'), '') is not null
   limit 1
)`;

const SENTIMENT_RANK = sql`case ${responses.sentiment} when 'negativo' then 0 when 'neutro' then 1 when 'positivo' then 2 else 3 end`;

function viewWhere(view: FeedView): SQL | undefined {
  if (view === "comments") return sql`${commentSql} is not null`;
  if (view === "positive") return eq(responses.sentiment, "positivo");
  if (view === "negative") return eq(responses.sentiment, "negativo");
  if (view === "neutral") return eq(responses.sentiment, "neutro");
  return undefined;
}

function sortOrder(sort: FeedSort): SQL[] {
  switch (sort) {
    case "oldest":
      return [asc(responses.createdAt)];
    case "score_desc":
      return [sql`${responses.score} desc nulls last`, desc(responses.createdAt)];
    case "score_asc":
      return [sql`${responses.score} asc nulls last`, desc(responses.createdAt)];
    case "comments_first":
      return [sql`(${commentSql} is null)`, desc(responses.createdAt)];
    case "longest":
      return [sql`length(${commentSql}) desc nulls last`, desc(responses.createdAt)];
    case "negative_first":
      return [SENTIMENT_RANK, desc(responses.createdAt)];
    case "positive_first":
      return [sql`${SENTIMENT_RANK} = 3`, sql`${SENTIMENT_RANK} desc`, desc(responses.createdAt)];
    default:
      return [desc(responses.createdAt)];
  }
}

export interface FeedItem {
  id: string;
  surveyId: string;
  surveyName: string;
  respondent: string | null;
  respondentEmail: string | null;
  channel: string;
  host: string | null;
  device: string | null;
  sentiment: "positivo" | "neutro" | "negativo" | null;
  score: number | null;
  comment: string;
  createdAt: Date;
  /** nome, e-mail e foto (de Analytics › Usuários) */
  person: Person;
}

/** Página do feed: `limit` itens + se há mais. */
export async function getResponseFeed(
  scope: Scope,
  opts: { view: FeedView; sort: FeedSort; limit: number }
): Promise<{ items: FeedItem[]; hasMore: boolean }> {
  const rows = await db
    .select({
      id: responses.id,
      surveyId: responses.surveyId,
      surveyName: surveys.name,
      respondent: responses.respondent,
      respondentEmail: responses.respondentEmail,
      channel: responses.channel,
      host: responses.host,
      device: responses.device,
      sentiment: responses.sentiment,
      score: responses.score,
      comment: commentSql,
      createdAt: responses.createdAt,
    })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(and(scopeWhere(scope), viewWhere(opts.view)))
    .orderBy(...sortOrder(opts.sort))
    .limit(opts.limit + 1);

  const page = rows.slice(0, opts.limit);
  const personOf = await resolvePeople(scope.projectId, page);
  return {
    hasMore: rows.length > opts.limit,
    items: page.map((r) => ({
      ...r,
      comment: r.comment ?? "",
      sentiment: r.sentiment as FeedItem["sentiment"],
      person: personOf(r),
    })),
  };
}

export interface ViewCounts {
  all: number;
  comments: number;
  positive: number;
  negative: number;
  neutral: number;
}

/** Contagem de cada aba numa única consulta (filtros agregados). */
export async function getViewCounts(scope: Scope): Promise<ViewCounts> {
  const [r] = await db
    .select({
      all: sql<number>`count(*)::int`,
      comments: sql<number>`count(*) filter (where ${commentSql} is not null)::int`,
      positive: sql<number>`count(*) filter (where ${responses.sentiment} = 'positivo')::int`,
      negative: sql<number>`count(*) filter (where ${responses.sentiment} = 'negativo')::int`,
      neutral: sql<number>`count(*) filter (where ${responses.sentiment} = 'neutro')::int`,
    })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(scopeWhere(scope));
  return {
    all: Number(r?.all ?? 0),
    comments: Number(r?.comments ?? 0),
    positive: Number(r?.positive ?? 0),
    negative: Number(r?.negative ?? 0),
    neutral: Number(r?.neutral ?? 0),
  };
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  total: number;
  positive: number;
  comments: number;
  avgScore: number | null;
}

/** Série diária do recorte (minigráficos dos cards). Só dias com resposta. */
export async function getDailySeries(scope: Scope): Promise<DailyPoint[]> {
  const day = sql<string>`to_char(date_trunc('day', ${responses.createdAt}), 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      date: day,
      total: sql<number>`count(*)::int`,
      positive: sql<number>`count(*) filter (where ${responses.sentiment} = 'positivo')::int`,
      comments: sql<number>`count(*) filter (where ${commentSql} is not null)::int`,
      avgScore: sql<number | null>`avg(${responses.score})::float`,
    })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(scopeWhere(scope))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows.map((r) => ({
    date: r.date,
    total: Number(r.total),
    positive: Number(r.positive),
    comments: Number(r.comments),
    avgScore: r.avgScore != null ? Number(r.avgScore) : null,
  }));
}

export interface ResponseDetail {
  id: string;
  surveyName: string;
  respondent: string | null;
  respondentEmail: string | null;
  channel: string;
  host: string | null;
  device: string | null;
  sentiment: string | null;
  score: number | null;
  createdAt: Date;
  answers: { question: string; blockId: string; value: string }[];
}

function answerText(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "object") return String(value);
  const v = value as Record<string, unknown>;
  const raw = v.text ?? v.score ?? v.value;
  if (Array.isArray(raw)) return raw.join(", ");
  return raw == null ? "" : String(raw);
}

/** Resposta completa (todas as perguntas), só se pertencer ao projeto. */
export async function getResponseDetail(id: string, projectId: string): Promise<ResponseDetail | null> {
  const [head] = await db
    .select({
      id: responses.id,
      surveyId: responses.surveyId,
      surveyName: surveys.name,
      respondent: responses.respondent,
      respondentEmail: responses.respondentEmail,
      channel: responses.channel,
      host: responses.host,
      device: responses.device,
      sentiment: responses.sentiment,
      score: responses.score,
      createdAt: responses.createdAt,
    })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(and(eq(responses.id, id), eq(surveys.projectId, projectId)))
    .limit(1);
  if (!head) return null;

  const rows = await db
    .select({ value: answers.value, title: questions.title, blockId: questions.blockId, order: questions.order })
    .from(answers)
    .leftJoin(questions, eq(questions.id, answers.questionId))
    .where(eq(answers.responseId, id))
    .orderBy(asc(questions.order));

  return {
    id: head.id,
    surveyName: head.surveyName,
    respondent: head.respondent,
    respondentEmail: head.respondentEmail,
    channel: head.channel,
    host: head.host,
    device: head.device,
    sentiment: head.sentiment,
    score: head.score,
    createdAt: head.createdAt,
    answers: rows
      .map((r) => ({ question: r.title ?? "Pergunta removida", blockId: r.blockId ?? "", value: answerText(r.value) }))
      .filter((a) => a.value !== ""),
  };
}
