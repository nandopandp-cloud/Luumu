import "server-only";
import { getProductReportSettings, latestSyncs, listStoredPeriods } from "@/lib/db/product-report";
import { buildReportModel, type ReportModel } from "./model";
import { periodsUntil, type PeriodId } from "./period";

export const HISTORY_SIZE = 8;

/** Modelo "ao vivo" da quinzena (o que está salvo agora). Três consultas, qualquer quinzena. */
export async function loadReportModel(workspaceId: string, period: PeriodId, now = new Date()): Promise<ReportModel> {
  const [stored, settings, { syncs, lastAttempt }] = await Promise.all([
    listStoredPeriods(workspaceId),
    getProductReportSettings(workspaceId),
    latestSyncs(workspaceId, periodsUntil(period, HISTORY_SIZE), period),
  ]);
  return buildReportModel({ period, stored, syncs, lastAttempt, weights: settings.weights, now, historySize: HISTORY_SIZE });
}
