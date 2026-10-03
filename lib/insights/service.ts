import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { questions, responses, surveys } from "@/db/schema";
import { getMainScore, scopeWhere, type Scope } from "@/lib/db/responses";
import { commentSql } from "@/lib/db/response-feed";
import { getScoreSeries, previousScope } from "@/lib/db/overview";
import { defaultScaleForBlock, formatScore, SCORE_BLOCK_IDS } from "@/lib/scoring";
import { periodLabel, periodToRange } from "@/lib/period";
import { scoreDelta } from "@/components/ui/InsightCard";
import { analyzeInsights, levelFromScore, levelFromSentiment, type AnalyzedResponse } from "./analyze";
import type { InsightsData, SatisfactionMetric } from "./types";

/*
  Camada de serviço da área Insights:

    UI (app/(app)/insights)  →  getInsights()  →  banco do Luumu + analyzeInsights()

  É aqui que um motor de IA (ou GET /api/insights) entra no futuro: basta devolver o mesmo
  `InsightsData`. Hoje os números vêm das respostas reais e os temas do dicionário
  determinístico (lib/insights/themes.ts) — nada é inventado.
*/

export interface InsightsFilters {
  projectId: string;
  surveyId?: string;
  host?: string;
  period?: string;
  from?: string;
  to?: string;
}

const MAX_ROWS = 5000;

type Row = { id: string; surveyId: string; createdAt: Date; score: number | null; sentiment: string | null; comment: string | null };

async function readResponses(scope: Scope): Promise<Row[]> {
  return db
    .select({
      id: responses.id,
      surveyId: responses.surveyId,
      createdAt: responses.createdAt,
      score: responses.score,
      sentiment: responses.sentiment,
      comment: commentSql,
    })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(scopeWhere(scope))
    .limit(MAX_ROWS);
}

/** Escala da PRIMEIRA pergunta de nota de cada pesquisa (é dela que sai responses.score). */
async function scalesFor(surveyIds: string[]): Promise<Map<string, { min: number; max: number }>> {
  const map = new Map<string, { min: number; max: number }>();
  if (!surveyIds.length) return map;
  const qs = await db
    .select({ surveyId: questions.surveyId, blockId: questions.blockId, config: questions.config })
    .from(questions)
    .where(inArray(questions.surveyId, surveyIds))
    .orderBy(asc(questions.order));
  for (const q of qs) {
    if (map.has(q.surveyId) || !SCORE_BLOCK_IDS.includes(q.blockId)) continue;
    const d = defaultScaleForBlock(q.blockId);
    const cfg = (q.config as { min?: number; max?: number }) ?? {};
    map.set(q.surveyId, { min: cfg.min ?? d.min, max: cfg.max ?? d.max });
  }
  return map;
}

export async function getInsights(f: InsightsFilters): Promise<InsightsData> {
  const { from, to } = periodToRange(f.period, f.from, f.to);
  const scope: Scope = { projectId: f.projectId, surveyId: f.surveyId, host: f.host, dateFrom: from, dateTo: to };
  const prev = previousScope(scope);

  const [cur, before, main, prevMain] = await Promise.all([
    readResponses(scope),
    prev ? readResponses(prev) : Promise.resolve(null),
    getMainScore(scope),
    prev ? getMainScore(prev) : Promise.resolve(null),
  ]);
  const [scales, series] = await Promise.all([
    scalesFor(Array.from(new Set([...cur, ...(before ?? [])].map((r) => r.surveyId)))),
    getScoreSeries(scope, main),
  ]);

  const toAnalyzed = (r: Row): AnalyzedResponse => {
    const sentiment = (r.sentiment as AnalyzedResponse["sentiment"]) ?? null;
    const scale = scales.get(r.surveyId);
    return {
      id: r.id,
      createdAt: r.createdAt,
      score: r.score,
      sentiment,
      level: r.score != null && scale ? levelFromScore(r.score, scale) : levelFromSentiment(sentiment),
      comment: r.comment ?? "",
    };
  };

  const satisfaction: SatisfactionMetric | null = main
    ? {
        label: main.label,
        value: formatScore(main),
        delta: scoreDelta(main, prevMain) as SatisfactionMetric["delta"],
        trend: series.week.map((p) => p.score).filter((v): v is number => v != null),
        formula: main.formula,
      }
    : null;

  return analyzeInsights({
    periodLabel: periodLabel(f.period, f.from, f.to).toLowerCase(),
    now: new Date(),
    from,
    to,
    current: cur.map(toAnalyzed),
    previous: before ? before.map(toAnalyzed) : null,
    satisfaction,
  });
}
