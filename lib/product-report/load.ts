import "server-only";
import { getProductReportSettings, latestSyncs, listStoredPeriods } from "@/lib/db/product-report";
import { buildReportModel, type ReportModel } from "./model";
import { periodsUntil, yearPeriodsUntil, type PeriodId } from "./period";

export const HISTORY_SIZE = 8;

/**
 * Modelo "ao vivo" da quinzena (o que está salvo agora). Três consultas, qualquer quinzena.
 * As sincronizações cobrem a janela dos gráficos e o ano inteiro (média anual da North Star).
 */
export async function loadReportModel(
  workspaceId: string,
  period: PeriodId,
  opts: { now?: Date; author?: ReportModel["author"] } = {}
): Promise<ReportModel> {
  const periods = [...new Set([...periodsUntil(period, HISTORY_SIZE), ...yearPeriodsUntil(period)])];
  const [stored, settings, { syncs, lastAttempt }] = await Promise.all([
    listStoredPeriods(workspaceId),
    getProductReportSettings(workspaceId),
    latestSyncs(workspaceId, periods, period),
  ]);
  return buildReportModel({ period, stored, syncs, lastAttempt, weights: settings.weights, now: opts.now, historySize: HISTORY_SIZE, author: opts.author });
}
