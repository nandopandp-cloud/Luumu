import "server-only";
import { and, desc, eq, count, avg, sql, inArray, gte, lte, type SQL } from "drizzle-orm";
import { db } from "./client";
import { responses, answers, surveys, questions } from "@/db/schema";
import { responseId, answerId } from "./ids";
import { buildWordCloud } from "@/lib/wordcloud";

// min/max default por bloco de nota, quando a pergunta não define config.min/max explícito
const SCORE_RANGE_DEFAULTS: Record<string, { min: number; max: number }> = {
  nps: { min: 0, max: 10 },
  rating: { min: 1, max: 5 },
  stars: { min: 1, max: 5 },
  csat: { min: 1, max: 5 },
  ces: { min: 1, max: 7 },
  scale: { min: 1, max: 5 },
};
const SCORE_BLOCK_IDS = Object.keys(SCORE_RANGE_DEFAULTS);

export type ResponseRow = typeof responses.$inferSelect;

interface Scope {
  projectId: string;
  surveyId?: string; // opcional: restringe a uma pesquisa do projeto
  dateFrom?: Date; // opcional: só respostas a partir desta data (inclusive)
  dateTo?: Date; // opcional: só respostas até esta data (inclusive)
}

/** Filtro combinado: sempre por projeto (via join com surveys), opcionalmente por pesquisa e período. */
function scopeWhere(scope: Scope): SQL | undefined {
  const parts = [eq(surveys.projectId, scope.projectId)];
  if (scope.surveyId) parts.push(eq(responses.surveyId, scope.surveyId));
  if (scope.dateFrom) parts.push(gte(responses.createdAt, scope.dateFrom));
  if (scope.dateTo) parts.push(lte(responses.createdAt, scope.dateTo));
  return and(...parts);
}

/** Feed de respostas do workspace (ou de uma pesquisa dele) com o comentário principal. */
export async function listResponses(scope: Scope) {
  const rows = await db
    .select({
      id: responses.id,
      surveyId: responses.surveyId,
      respondent: responses.respondent,
      respondentEmail: responses.respondentEmail,
      channel: responses.channel,
      sentiment: responses.sentiment,
      score: responses.score,
      createdAt: responses.createdAt,
      surveyName: surveys.name,
    })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(scopeWhere(scope))
    .orderBy(desc(responses.createdAt))
    .limit(50);

  const withComment = await Promise.all(
    rows.map(async (r) => {
      const rowAnswers = await db
        .select({ value: answers.value })
        .from(answers)
        .where(eq(answers.responseId, r.id));
      const comment = rowAnswers.map((a) => extractComment(a.value)).find((c) => c) ?? "";
      return { ...r, comment };
    })
  );
  return withComment;
}

function extractComment(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "text" in value) {
    return String((value as { text: unknown }).text ?? "");
  }
  return "";
}

/** Estatísticas agregadas do workspace (ou de uma pesquisa dele). */
export async function getStats(scope: Scope) {
  const where = scopeWhere(scope);

  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(where);

  const [{ avgScore } = { avgScore: null }] = await db
    .select({ avgScore: avg(responses.score) })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(where);

  const sentiments = await db
    .select({ sentiment: responses.sentiment, n: count() })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(where)
    .groupBy(responses.sentiment);

  const pos = sentiments.find((s) => s.sentiment === "positivo")?.n ?? 0;
  const totalN = Number(total) || 0;

  return {
    total: totalN,
    avgScore: avgScore != null ? Math.round(Number(avgScore) * 10) / 10 : null,
    positivePct: totalN ? Math.round((Number(pos) / totalN) * 100) : 0,
    sentiments,
  };
}

/** Nuvem de palavras real, extraída de todos os comentários (texto curto/longo) do escopo. */
export async function getWordCloud(scope: Scope) {
  const rows = await db
    .select({ value: answers.value })
    .from(answers)
    .innerJoin(responses, eq(answers.responseId, responses.id))
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(scopeWhere(scope));

  const comments = rows.map((r) => extractComment(r.value)).filter(Boolean);
  return buildWordCloud(comments);
}

/**
 * Descobre a escala real de notas do escopo (min/max), olhando as perguntas de
 * score (nps|rating|stars|csat|ces|scale) das surveys envolvidas. Quando o escopo
 * mistura escalas diferentes (ex: workspace inteiro com NPS 0-10 e CSAT 1-5), usa a
 * maior faixa encontrada, que cobre todas sem perder granularidade.
 */
async function detectScoreScale(scope: Scope): Promise<{ min: number; max: number }> {
  const surveyIds = scope.surveyId
    ? [scope.surveyId]
    : (await db.select({ id: surveys.id }).from(surveys).where(eq(surveys.projectId, scope.projectId))).map(
        (s) => s.id
      );
  if (surveyIds.length === 0) return { min: 0, max: 10 };

  const qs = await db
    .select({ blockId: questions.blockId, config: questions.config })
    .from(questions)
    .where(and(inArray(questions.surveyId, surveyIds), inArray(questions.blockId, SCORE_BLOCK_IDS)));

  let min = 0;
  let max = 0;
  for (const q of qs) {
    const defaults = SCORE_RANGE_DEFAULTS[q.blockId];
    const cfg = (q.config as { min?: number; max?: number }) ?? {};
    const qMin = cfg.min ?? defaults.min;
    const qMax = cfg.max ?? defaults.max;
    if (qMax - qMin > max - min) {
      min = qMin;
      max = qMax;
    }
  }
  if (max === min) return { min: 0, max: 10 }; // sem pergunta de nota no escopo: assume NPS (mais comum)
  return { min, max };
}

/** Distribuição de notas normalizada em % (para as barras), na escala real da(s) pesquisa(s) do escopo. */
export async function getScoreDistribution(scope: Scope) {
  const { min, max } = await detectScoreScale(scope);

  const rows = await db
    .select({
      bucket: sql<number>`round(${responses.score})`.mapWith(Number).as("bucket"),
      n: count(),
    })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(and(scopeWhere(scope), sql`${responses.score} is not null`))
    .groupBy(sql`round(${responses.score})`);

  const byBucket = new Map(rows.map((r) => [r.bucket, Number(r.n)]));
  const total = rows.reduce((s, r) => s + Number(r.n), 0) || 1;

  const buckets: number[] = [];
  for (let b = max; b >= min; b--) buckets.push(b);

  return buckets.map((b) => {
    const pct = (b - min) / (max - min);
    const tone =
      pct >= 0.8 ? "var(--luumu-verde)" : pct >= 0.5 ? "var(--sec-amarelo)" : "var(--erro)";
    return {
      label: String(b),
      value: Math.round(((byBucket.get(b) ?? 0) / total) * 100),
      tone,
    };
  });
}

/** Distribuição real de respostas por canal, em %, para o donut do dashboard. */
export async function getChannelSplit(scope: Scope) {
  const rows = await db
    .select({ channel: responses.channel, n: count() })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(scopeWhere(scope))
    .groupBy(responses.channel)
    .orderBy(desc(count()));

  const palette = [
    "var(--luumu-roxo)", "var(--luumu-roxo-claro)", "var(--luumu-verde)", "var(--sec-ciano)",
  ];
  const total = rows.reduce((s, r) => s + Number(r.n), 0) || 1;
  return rows.map((r, i) => ({
    name: r.channel,
    value: Math.round((Number(r.n) / total) * 100),
    color: palette[i % palette.length],
  }));
}

/**
 * Evolução da nota média por semana (últimas `weeks` semanas), para a área do dashboard.
 * Só considera respostas com score. Retorna [{ date: "dd/mm", csat }].
 */
export async function getScoreTrend(scope: Scope, weeks = 8) {
  const rows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${responses.createdAt}), 'DD/MM')`.as("week"),
      weekStart: sql<string>`date_trunc('week', ${responses.createdAt})`.as("week_start"),
      avgScore: avg(responses.score),
    })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(and(scopeWhere(scope), sql`${responses.score} is not null`))
    .groupBy(sql`date_trunc('week', ${responses.createdAt})`)
    .orderBy(sql`date_trunc('week', ${responses.createdAt})`);

  return rows.slice(-weeks).map((r) => ({
    date: r.week,
    csat: r.avgScore != null ? Math.round(Number(r.avgScore) * 10) / 10 : 0,
  }));
}

export interface ExportRow {
  id: string;
  surveyName: string;
  respondent: string;
  channel: string;
  sentiment: string;
  score: number | null;
  comment: string;
  createdAt: Date;
}

/**
 * Todas as respostas do escopo (sem limite), achatadas para exportação.
 * Inclui o comentário principal de cada resposta. Ordenado do mais recente ao mais antigo.
 */
export async function listResponsesForExport(scope: Scope): Promise<ExportRow[]> {
  const rows = await db
    .select({
      id: responses.id,
      surveyId: responses.surveyId,
      respondent: responses.respondent,
      respondentEmail: responses.respondentEmail,
      channel: responses.channel,
      sentiment: responses.sentiment,
      score: responses.score,
      createdAt: responses.createdAt,
      surveyName: surveys.name,
    })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(scopeWhere(scope))
    .orderBy(desc(responses.createdAt));

  return Promise.all(
    rows.map(async (r) => {
      const rowAnswers = await db
        .select({ value: answers.value })
        .from(answers)
        .where(eq(answers.responseId, r.id));
      const comment = rowAnswers.map((a) => extractComment(a.value)).find((c) => c) ?? "";
      return {
        id: r.id,
        surveyName: r.surveyName,
        respondent: r.respondentEmail ?? r.respondent ?? "Anônimo",
        channel: r.channel,
        sentiment: r.sentiment ?? "—",
        score: r.score,
        comment,
        createdAt: r.createdAt,
      };
    })
  );
}

/** Grava uma resposta com suas answers (a validação de tenant é feita antes, na API). */
export async function submitResponse(input: {
  surveyId: string;
  channel?: string;
  answers: { questionId: string; value: unknown }[];
  score: number | null;
  sentiment: "positivo" | "neutro" | "negativo" | null;
  respondent?: string | null;
  respondentEmail?: string | null;
}) {
  const rid = responseId();
  await db.insert(responses).values({
    id: rid,
    surveyId: input.surveyId,
    channel: input.channel ?? "Link",
    score: input.score ?? undefined,
    sentiment: input.sentiment ?? undefined,
    respondent: input.respondent ?? undefined,
    respondentEmail: input.respondentEmail ?? undefined,
  });
  if (input.answers.length) {
    await db.insert(answers).values(
      input.answers.map((a) => ({
        id: answerId(),
        responseId: rid,
        questionId: a.questionId,
        value: (a.value ?? {}) as object,
      }))
    );
  }
  return rid;
}
