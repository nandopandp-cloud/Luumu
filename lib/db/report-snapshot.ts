import "server-only";
import { getStats, getMainScore, getScoreDistribution, getWordCloud, type Scope } from "./responses";
import { formatScore } from "@/lib/scoring";
import { periodToDateFrom, PERIOD_OPTIONS } from "@/lib/period";
import type { WordCloudItem } from "@/lib/wordcloud";

export interface DistributionBucket {
  label: string;
  value: number; // %
  tone: string;
}

export interface ReportSnapshot {
  scopeName: string;
  periodLabel: string;
  total: number;
  positivePct: number;
  scoreLabel: string;
  scoreValue: string;
  scoreFormula: string | null;
  distribution: DistributionBucket[];
  wordCloud: WordCloudItem[];
}

/**
 * Monta o conjunto de indicadores de um relatório (mesmos números do painel), reaproveitado
 * pela página pública, pelo e-mail agendado e pelo cron. Uma única fonte de verdade.
 */
export async function buildReportSnapshot(opts: {
  projectId: string;
  surveyId?: string | null;
  surveyName?: string | null;
  period: string;
}): Promise<ReportSnapshot> {
  const scope: Scope = {
    projectId: opts.projectId,
    surveyId: opts.surveyId || undefined,
    dateFrom: periodToDateFrom(opts.period),
  };

  const [stats, mainScore, distribution, wordCloud] = await Promise.all([
    getStats(scope),
    getMainScore(scope),
    getScoreDistribution(scope),
    getWordCloud(scope),
  ]);

  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === opts.period)?.label ?? "Todo o período";

  return {
    scopeName: opts.surveyName || (opts.surveyId ? "Pesquisa" : "Todas as pesquisas"),
    periodLabel,
    total: stats.total,
    positivePct: stats.positivePct,
    scoreLabel: mainScore?.label ?? "Score",
    scoreValue: mainScore ? formatScore(mainScore) : "—",
    scoreFormula: mainScore?.formula ?? null,
    distribution,
    wordCloud,
  };
}
