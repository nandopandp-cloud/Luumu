import { resolvePeople } from "./people";
import "server-only";
import { hostList } from "@/lib/hosts";
import { and, asc, desc, eq, count, avg, sql, inArray, gte, lte, or, isNull, type SQL } from "drizzle-orm";
import { db } from "./client";
import { responses, answers, surveys, questions } from "@/db/schema";
import { responseId, answerId } from "./ids";
import { buildWordCloud } from "@/lib/wordcloud";
import {
  methodologyForBlock,
  defaultScaleForBlock,
  computeScore,
  SCORE_BLOCK_IDS,
  type ScoreResult,
} from "@/lib/scoring";

export type ResponseRow = typeof responses.$inferSelect;

export interface Scope {
  projectId: string;
  surveyId?: string; // opcional: restringe a uma pesquisa do projeto
  dateFrom?: Date; // opcional: só respostas a partir desta data (inclusive)
  dateTo?: Date; // opcional: só respostas até esta data (inclusive)
  host?: string; // opcional: só respostas de uma plataforma (hostname)
}

/** Filtro combinado: sempre por projeto (via join com surveys), opcionalmente por pesquisa e período. */
export function scopeWhere(scope: Scope): SQL | undefined {
  const parts = [eq(surveys.projectId, scope.projectId)];
  if (scope.surveyId) parts.push(eq(responses.surveyId, scope.surveyId));
  if (scope.dateFrom) parts.push(gte(responses.createdAt, scope.dateFrom));
  if (scope.dateTo) parts.push(lte(responses.createdAt, scope.dateTo));
  /*
    Plataforma: vale o host gravado na resposta. Respostas sem host (anteriores à coluna, ou
    do link público) contam para a plataforma só se a pesquisa for direcionada a ela —
    pesquisa sem alvo não diz de qual produto a resposta veio.
  */
  const hosts = hostList(scope.host);
  if (hosts.length) {
    parts.push(
      or(
        inArray(responses.host, hosts),
        and(isNull(responses.host), sql`(${sql.join(hosts.map((h) => sql`${surveys.targetHosts} @> ${JSON.stringify([h])}::jsonb`), sql` or `)})`)
      )!
    );
  }
  return and(...parts);
}

/**
 * Busca o comentário principal (primeira answer com texto) de várias respostas de uma vez,
 * via um único IN — evita 1 query por resposta (era o maior N+1 do app, cada query é um
 * round-trip HTTP completo ao Neon, então isso importa muito mais do que pareceria em SQL local).
 */
async function commentsByResponseId(responseIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (responseIds.length === 0) return map;

  const rows = await db
    .select({ responseId: answers.responseId, value: answers.value })
    .from(answers)
    .where(inArray(answers.responseId, responseIds));

  for (const r of rows) {
    if (map.has(r.responseId)) continue; // mantém a primeira answer com texto, igual ao comportamento anterior
    const comment = extractComment(r.value);
    if (comment) map.set(r.responseId, comment);
  }
  return map;
}

function extractComment(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "text" in value) {
    return String((value as { text: unknown }).text ?? "");
  }
  return "";
}

/**
 * Estatísticas agregadas do workspace (ou de uma pesquisa dele).
 * As 2 queries (totais e por sentimento) rodam em paralelo — antes eram 3 sequenciais,
 * cada uma um round-trip HTTP completo ao Neon (driver neon-http não faz pooling).
 */
export async function getStats(scope: Scope) {
  const where = scopeWhere(scope);

  const [[{ total, avgScore } = { total: 0, avgScore: null }], sentiments] = await Promise.all([
    db
      .select({ total: count(), avgScore: avg(responses.score) })
      .from(responses)
      .innerJoin(surveys, eq(responses.surveyId, surveys.id))
      .where(where),
    db
      .select({ sentiment: responses.sentiment, n: count() })
      .from(responses)
      .innerJoin(surveys, eq(responses.surveyId, surveys.id))
      .where(where)
      .groupBy(responses.sentiment),
  ]);

  const pos = sentiments.find((s) => s.sentiment === "positivo")?.n ?? 0;
  const totalN = Number(total) || 0;

  return {
    total: totalN,
    avgScore: avgScore != null ? Math.round(Number(avgScore) * 10) / 10 : null,
    positivePct: totalN ? Math.round((Number(pos) / totalN) * 100) : 0,
    sentiments,
  };
}

/**
 * Score principal do escopo, calculado na metodologia correta de cada tipo de pesquisa
 * (NPS = %promotores−%detratores, CSAT = % top-box, CES = média com direção invertida —
 * ver lib/scoring.ts) em vez de uma média simples aplicada indiscriminadamente.
 *
 * Quando o escopo mistura pesquisas de metodologias diferentes (ex: workspace inteiro
 * com uma pesquisa NPS e outra CSAT), não há como combinar os números em um só sem
 * quebrar a metodologia de ambas — então o card mostra a metodologia PREDOMINANTE
 * (a que tem mais respostas no escopo atual), com o nome da pesquisa de origem.
 */
export async function getMainScore(scope: Scope): Promise<(ScoreResult & { surveyName: string | null }) | null> {
  // pergunta de score de cada survey do escopo (a primeira, na ordem do builder)
  const surveyIds = scope.surveyId
    ? [scope.surveyId]
    : (await db.select({ id: surveys.id }).from(surveys).where(eq(surveys.projectId, scope.projectId))).map(
        (s) => s.id
      );
  if (surveyIds.length === 0) return null;

  const [scoreQuestions, rows] = await Promise.all([
    db
      .select({ surveyId: questions.surveyId, blockId: questions.blockId, config: questions.config, order: questions.order })
      .from(questions)
      .where(and(inArray(questions.surveyId, surveyIds), inArray(questions.blockId, SCORE_BLOCK_IDS)))
      .orderBy(asc(questions.order)),
    db
      .select({ surveyId: responses.surveyId, surveyName: surveys.name, score: responses.score })
      .from(responses)
      .innerJoin(surveys, eq(responses.surveyId, surveys.id))
      .where(and(scopeWhere(scope), sql`${responses.score} is not null`)),
  ]);

  // primeira pergunta de nota de cada survey (mesma regra usada no widget/SDK pra decidir o score da resposta)
  const scoreQuestionBySurvey = new Map<string, { blockId: string; config: unknown }>();
  for (const q of scoreQuestions) {
    if (!scoreQuestionBySurvey.has(q.surveyId)) scoreQuestionBySurvey.set(q.surveyId, q);
  }

  const scoresBySurvey = new Map<string, { name: string; scores: number[] }>();
  for (const r of rows) {
    if (r.score == null) continue;
    const entry = scoresBySurvey.get(r.surveyId) ?? { name: r.surveyName, scores: [] };
    entry.scores.push(r.score);
    scoresBySurvey.set(r.surveyId, entry);
  }
  if (scoresBySurvey.size === 0) return null;

  // metodologia predominante: a survey com mais respostas no escopo
  const [topSurveyId, top] = Array.from(scoresBySurvey.entries()).sort((a, b) => b[1].scores.length - a[1].scores.length)[0];
  const scoreQuestion = scoreQuestionBySurvey.get(topSurveyId);
  const methodology = methodologyForBlock(scoreQuestion?.blockId);
  const cfg = (scoreQuestion?.config as { min?: number; max?: number }) ?? {};
  const defaults = defaultScaleForBlock(scoreQuestion?.blockId);
  const scale = { min: cfg.min ?? defaults.min, max: cfg.max ?? defaults.max };

  const result = computeScore(top.scores, methodology, scale);
  return { ...result, surveyName: scope.surveyId ? null : top.name };
}

/**
 * Nuvem de palavras real, extraída dos comentários (texto curto/longo) mais recentes do
 * escopo. Limitado às últimas 2000 respostas: a nuvem não perde utilidade amostrando as
 * mais recentes, e sem teto essa query cresceria sem limite conforme o workspace acumula
 * respostas (é a única leitura de responses.ts sem LIMIT).
 */
export async function getWordCloud(scope: Scope) {
  const rows = await db
    .select({ value: answers.value })
    .from(answers)
    .innerJoin(responses, eq(answers.responseId, responses.id))
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(scopeWhere(scope))
    .orderBy(desc(responses.createdAt))
    .limit(2000);

  const comments = rows.map((r) => extractComment(r.value)).filter(Boolean);
  return buildWordCloud(comments);
}

/**
 * Descobre a escala real de notas do escopo (min/max). Usa só a PRIMEIRA pergunta de nota de
 * cada pesquisa — é dela que sai `responses.score` (mesma regra de listSurveys/getMainScore).
 * Antes olhava todas: uma pesquisa CSAT (1–5) com uma pergunta NPS extra (0–10) mais abaixo
 * ganhava escala 0–10, com metade das barras sempre vazias. Quando o escopo mistura pesquisas
 * de escalas diferentes (ex.: NPS 0–10 e CSAT 1–5), usa a maior faixa, que cobre todas.
 */
export async function detectScoreScale(scope: Scope): Promise<{ min: number; max: number }> {
  const qs = await db
    .select({ surveyId: questions.surveyId, blockId: questions.blockId, config: questions.config })
    .from(questions)
    .innerJoin(surveys, eq(questions.surveyId, surveys.id))
    .where(
      and(
        eq(surveys.projectId, scope.projectId),
        scope.surveyId ? eq(questions.surveyId, scope.surveyId) : undefined,
        inArray(questions.blockId, SCORE_BLOCK_IDS)
      )
    )
    .orderBy(asc(questions.order));

  const firstBySurvey = new Map<string, (typeof qs)[number]>();
  for (const q of qs) if (!firstBySurvey.has(q.surveyId)) firstBySurvey.set(q.surveyId, q);

  let min = 0;
  let max = 0;
  for (const q of firstBySurvey.values()) {
    const defaults = defaultScaleForBlock(q.blockId);
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

/**
 * Distribuição de notas normalizada em % (para as barras), na escala real da(s) pesquisa(s) do escopo.
 * detectScoreScale e a query de contagem por nota rodam em paralelo — a segunda não
 * depende do resultado da primeira (só precisa dela depois, para desenhar os buckets).
 */
export async function getScoreDistribution(scope: Scope) {
  const [{ min, max }, rows] = await Promise.all([
    detectScoreScale(scope),
    db
      .select({
        bucket: sql<number>`round(${responses.score})`.mapWith(Number).as("bucket"),
        n: count(),
      })
      .from(responses)
      .innerJoin(surveys, eq(responses.surveyId, surveys.id))
      .where(and(scopeWhere(scope), sql`${responses.score} is not null`))
      .groupBy(sql`round(${responses.score})`),
  ]);

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

export interface ExportRow {
  id: string;
  surveyName: string;
  /** nome da pessoa (de Analytics › Usuários); "" quando não se sabe */
  name: string;
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

  const [commentByResponse, personOf] = await Promise.all([commentsByResponseId(rows.map((r) => r.id)), resolvePeople(scope.projectId, rows)]);
  return rows.map((r) => ({
    id: r.id,
    surveyName: r.surveyName,
    name: personOf(r).name ?? "",
    respondent: r.respondentEmail ?? r.respondent ?? "Anônimo",
    channel: r.channel,
    sentiment: r.sentiment ?? "—",
    comment: commentByResponse.get(r.id) ?? "",
    score: r.score,
    createdAt: r.createdAt,
  }));
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
  host?: string | null;
  device?: string | null;
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
    host: input.host ?? undefined,
    device: input.device ?? undefined,
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
