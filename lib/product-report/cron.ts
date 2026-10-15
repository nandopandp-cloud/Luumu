import "server-only";
import { listAutoSyncWorkspaces, syncStatusSince } from "@/lib/db/product-report";
import { syncPeriod } from "./collect";
import { lastClosedPeriod, periodRange } from "./period";

/** Falhas seguidas do cron numa quinzena antes de desistir (a tela segue permitindo tentar). */
export const MAX_CRON_ATTEMPTS = 3;

/**
 * Passo do cron diário (/api/cron/reports): para cada workspace com atualização automática
 * ligada, sincroniza a última quinzena ENCERRADA se ela ainda não tem uma sincronização feita
 * depois do fim. Na prática roda uma vez por quinzena (no dia 1 e no dia 16), com nova tentativa
 * nos dias seguintes se falhar. Cada execução é de uma quinzena só: nunca mistura períodos.
 * Não envia e-mail.
 */
export async function runProductReportCron(now = new Date()) {
  const period = lastClosedPeriod(now);
  const { to } = periodRange(period);
  const results: { period: string; status: string }[] = [];

  for (const ws of await listAutoSyncWorkspaces()) {
    try {
      const st = await syncStatusSince(ws.workspaceId, period, to);
      if (st.done) {
        results.push({ period, status: "já atualizada" });
        continue;
      }
      if (st.cronFailures >= MAX_CRON_ATTEMPTS) {
        results.push({ period, status: `desistiu após ${MAX_CRON_ATTEMPTS} falhas` });
        continue;
      }
      // sem sessão no cron: o vínculo plataforma → projeto foi validado contra o escopo da
      // conta autorizada quando ela o salvou; aqui só se exige que o projeto seja do workspace
      const run = await syncPeriod({ workspaceId: ws.workspaceId, period, trigger: "cron", allowedProjectIds: null });
      results.push({ period, status: run.status });
    } catch (e) {
      console.error("[product-report] cron:", e instanceof Error ? e.message.slice(0, 300) : e);
      results.push({ period, status: "error" });
    }
  }
  return results;
}
