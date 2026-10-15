import "server-only";
import { getProductReportSettings, latestSyncs, listStoredPeriods } from "@/lib/db/product-report";
import { buildReportModel, type ReportModel } from "./model";
import { periodsUntil, yearPeriodsUntil, type PeriodId } from "./period";

export const HISTORY_SIZE = 8;

/**
 * Erro de banco sem as tabelas/colunas do módulo (migrações 0032–0034 não aplicadas):
 * relação inexistente (42P01) ou coluna inexistente (42703). Percorre a cadeia de `cause`
 * porque o Drizzle embrulha o erro original do driver.
 */
export function isProductReportSchemaMissing(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
    const code = (e as { code?: unknown }).code;
    const msg = e instanceof Error ? e.message : String(e);
    if (code === "42P01" || code === "42703") return true;
    if (/(relation|column) "?(product_report_\w+|intro)"? .*does not exist|product_report_\w+" does not exist/i.test(msg)) return true;
    e = e instanceof Error ? (e as { cause?: unknown }).cause : undefined;
  }
  return false;
}

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
