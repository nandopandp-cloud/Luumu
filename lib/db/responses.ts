import "server-only";
import { desc, eq, count, avg, sql } from "drizzle-orm";
import { db } from "./client";
import { responses, answers, surveys } from "@/db/schema";
import { responseId, answerId } from "./ids";

export type ResponseRow = typeof responses.$inferSelect;

/** Feed de respostas (opcionalmente de uma pesquisa específica) com o comentário principal. */
export async function listResponses(surveyIdFilter?: string) {
  const base = db
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
    .leftJoin(surveys, eq(responses.surveyId, surveys.id))
    .orderBy(desc(responses.createdAt))
    .limit(50);

  const rows = surveyIdFilter
    ? await base.where(eq(responses.surveyId, surveyIdFilter))
    : await base;

  // pega o comentário de texto (se houver) entre as answers da resposta
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

/** Estatísticas agregadas de uma pesquisa (ou global). */
export async function getStats(surveyIdFilter?: string) {
  const where = surveyIdFilter ? eq(responses.surveyId, surveyIdFilter) : undefined;

  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(responses)
    .where(where);

  const [{ avgScore } = { avgScore: null }] = await db
    .select({ avgScore: avg(responses.score) })
    .from(responses)
    .where(where);

  const sentiments = await db
    .select({ sentiment: responses.sentiment, n: count() })
    .from(responses)
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
export async function getScoreDistribution(surveyIdFilter?: string) {
  const where = surveyIdFilter ? eq(responses.surveyId, surveyIdFilter) : undefined;
  const rows = await db
    .select({
      bucket: sql<number>`round(${responses.score})`.mapWith(Number).as("bucket"),
      n: count(),
    })
    .from(responses)
    .where(where)
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

/** Grava uma resposta com suas answers (usado pela página pública /s/[id]). */
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
