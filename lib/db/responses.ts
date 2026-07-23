import "server-only";
import { and, desc, eq, count, avg, sql, type SQL } from "drizzle-orm";
import { db } from "./client";
import { responses, answers, surveys } from "@/db/schema";
import { responseId, answerId } from "./ids";

export type ResponseRow = typeof responses.$inferSelect;

interface Scope {
  workspaceId: string;
  surveyId?: string; // opcional: restringe a uma pesquisa do workspace
}

/** Filtro combinado: sempre por workspace (via join com surveys), opcionalmente por pesquisa. */
function scopeWhere(scope: Scope): SQL | undefined {
  const parts = [eq(surveys.workspaceId, scope.workspaceId)];
  if (scope.surveyId) parts.push(eq(responses.surveyId, scope.surveyId));
  return and(...parts);
}

/** Feed de respostas do workspace (ou de uma pesquisa dele) com o comentário principal. */
export async function listResponses(scope: Scope) {
  const rows = await db
    .select({
      id: responses.id,
      surveyId: responses.surveyId,
      respondent: responses.respondent,
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

/** Distribuição de notas 1–5 normalizada em % (para as barras). */
export async function getScoreDistribution(scope: Scope) {
  const rows = await db
    .select({
      bucket: sql<number>`round(${responses.score})`.mapWith(Number).as("bucket"),
      n: count(),
    })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(scopeWhere(scope))
    .groupBy(sql`round(${responses.score})`);

  const tones: Record<number, string> = {
    5: "var(--luumu-verde)", 4: "var(--luumu-verde)", 3: "var(--sec-amarelo)",
    2: "var(--sec-laranja)", 1: "var(--erro)",
  };
  const byBucket = new Map(rows.map((r) => [r.bucket, Number(r.n)]));
  const total = rows.reduce((s, r) => s + Number(r.n), 0) || 1;
  return [5, 4, 3, 2, 1].map((b) => ({
    label: `${b} ★`,
    value: Math.round(((byBucket.get(b) ?? 0) / total) * 100),
    tone: tones[b],
  }));
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

/** Grava uma resposta com suas answers (a validação de tenant é feita antes, na API). */
export async function submitResponse(input: {
  surveyId: string;
  channel?: string;
  answers: { questionId: string; value: unknown }[];
  score: number | null;
  sentiment: "positivo" | "neutro" | "negativo" | null;
}) {
  const rid = responseId();
  await db.insert(responses).values({
    id: rid,
    surveyId: input.surveyId,
    channel: input.channel ?? "Link",
    score: input.score ?? undefined,
    sentiment: input.sentiment ?? undefined,
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
