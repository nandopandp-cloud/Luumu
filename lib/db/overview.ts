import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { responses, surveys } from "@/db/schema";
import { detectScoreScale, getMainScore, scopeWhere, type Scope } from "./responses";
import { getDailySeries, getViewCounts, type DailyPoint, type ViewCounts } from "./response-feed";
import { computeScore, type ScoreResult } from "@/lib/scoring";
import { fillDays } from "@/lib/period";

/*
  Números dos cards de visão geral (Dashboard e Respostas): valores do recorte, os mesmos
  valores no período anterior de mesmo tamanho (para o comparativo) e as séries diárias já
  completas com zero (para o minigráfico ter linha mesmo em dias sem resposta).
*/

/** Recorte imediatamente anterior, do mesmo tamanho. null = sem início (todo o período). */
export function previousScope(scope: Scope): Scope | null {
  if (!scope.dateFrom) return null;
  const end = scope.dateTo ?? new Date();
  const span = end.getTime() - scope.dateFrom.getTime();
  return { ...scope, dateFrom: new Date(scope.dateFrom.getTime() - span), dateTo: new Date(scope.dateFrom.getTime() - 1) };
}

export interface Overview {
  counts: ViewCounts;
  prevCounts: ViewCounts | null;
  mainScore: (ScoreResult & { surveyName: string | null }) | null;
  prevScore: ScoreResult | null;
  positivePct: number;
  prevPositivePct: number | null;
  daily: DailyPoint[];
}

export async function getOverview(scope: Scope): Promise<Overview> {
  const prev = previousScope(scope);
  const [counts, series, mainScore, prevCounts, prevScore] = await Promise.all([
    getViewCounts(scope),
    getDailySeries(scope),
    getMainScore(scope),
    prev ? getViewCounts(prev) : Promise.resolve(null),
    prev ? getMainScore(prev) : Promise.resolve(null),
  ]);
  const pct = (c: ViewCounts) => (c.all ? Math.round((c.positive / c.all) * 100) : 0);
  return {
    counts,
    prevCounts,
    mainScore,
    prevScore,
    positivePct: pct(counts),
    prevPositivePct: prevCounts?.all ? pct(prevCounts) : null,
    daily: fillDays(series, (date) => ({ date, total: 0, positive: 0, comments: 0, avgScore: null }), scope.dateFrom, scope.dateTo, 60),
  };
}

export type Granularity = "week" | "day";

export interface ScorePoint {
  key: string; // início do balde (YYYY-MM-DD)
  label: string; // "28/09"
  score: number | null; // na metodologia da nota principal (CSAT %, NPS, CES...)
  positivePct: number | null;
  total: number;
}

const MAX_ROWS = 20000;

function bucketOf(d: Date, g: Granularity): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (g === "week") t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); // segunda-feira
  return t.toISOString().slice(0, 10);
}

/**
 * Evolução no tempo: a nota principal calculada POR BALDE na metodologia certa (CSAT = % de
 * notas altas, NPS = promotores - detratores...), não uma média crua. Baldes sem resposta
 * entram vazios para o eixo do tempo ficar contínuo. Uma consulta, as duas granularidades.
 */
export async function getScoreSeries(
  scope: Scope,
  mainScore: ScoreResult | null
): Promise<Record<Granularity, ScorePoint[]>> {
  const [rows, scale] = await Promise.all([
    db
      .select({ createdAt: responses.createdAt, score: responses.score, sentiment: responses.sentiment })
      .from(responses)
      .innerJoin(surveys, eq(responses.surveyId, surveys.id))
      .where(scopeWhere(scope))
      .limit(MAX_ROWS),
    detectScoreScale(scope),
  ]);

  const build = (g: Granularity): ScorePoint[] => {
    const buckets = new Map<string, { scores: number[]; positive: number; total: number }>();
    for (const r of rows) {
      const k = bucketOf(r.createdAt, g);
      const b = buckets.get(k) ?? { scores: [], positive: 0, total: 0 };
      b.total++;
      if (r.score != null) b.scores.push(r.score);
      if (r.sentiment === "positivo") b.positive++;
      buckets.set(k, b);
    }
    const keys = Array.from(buckets.keys()).sort();
    const end = scope.dateTo ?? new Date();
    const startKey = scope.dateFrom ? bucketOf(scope.dateFrom, g) : keys[0];
    if (!startKey) return [];
    const out: ScorePoint[] = [];
    const step = g === "week" ? 7 : 1;
    for (let t = new Date(`${startKey}T00:00:00Z`); t <= end; t = new Date(t.getTime() + step * 86_400_000)) {
      const k = t.toISOString().slice(0, 10);
      const b = buckets.get(k);
      const score = b && b.scores.length && mainScore ? computeScore(b.scores, mainScore.methodology, scale).value : null;
      out.push({
        key: k,
        label: `${k.slice(8, 10)}/${k.slice(5, 7)}`,
        score: score ?? null,
        positivePct: b?.total ? Math.round((b.positive / b.total) * 100) : null,
        total: b?.total ?? 0,
      });
    }
    return out.slice(g === "week" ? -26 : -90);
  };

  return { week: build("week"), day: build("day") };
}
