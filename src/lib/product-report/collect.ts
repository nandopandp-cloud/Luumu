import "server-only";
import { collectingSince, getAnalytics, getAnalyticsSettings } from "@/lib/db/analytics";
import { getMainScore, getStats, type Scope } from "@/lib/db/responses";
import { listProjects } from "@/lib/db/projects";
import { insertRun, getProductReportSettings } from "@/lib/db/product-report";
import { kpis } from "@/lib/analytics/derive";
import { PLATFORMS, type Metric, type PlatformIndicatorKey, type PlatformKey } from "./indicators";
import { periodRange, type PeriodId } from "./period";
import type { CollectedValue, SyncSnapshot } from "./model";

/*
  Busca os indicadores de uma quinzena nos projetos de cada plataforma, com as MESMAS consultas
  das telas da Luumu (nada de fórmula paralela):
    - Aderência: KPI "Aderência (DAU/MAU)" do Analytics (lib/analytics/derive.ts → stickiness)
    - Tempo de uso: "Tempo médio de uso" do Analytics (média de duração das sessões)
    - CSAT: score das pesquisas do tipo CSAT do projeto (lib/surveys/scoring.ts, % top-box)
  Só leitura. O resultado vira uma execução "sync" em product_report_runs.
*/

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

async function collectAnalytics(projectId: string, from: Date, to: Date): Promise<Partial<Record<Metric, CollectedValue>>> {
  const [st, since] = await Promise.all([getAnalyticsSettings(projectId), collectingSince(projectId)]);
  const d = await getAnalytics({ projectId, from, to }, st, new Set(["daily", "totals"]));
  const t = d.totals;
  const warnings: string[] = [];
  if (!st.enabled) warnings.push("coleta de analytics desligada no projeto");
  if (since && new Date(since) > from) warnings.push(`coleta de analytics começou em ${fmtDay(since)}, quinzena incompleta`);

  if (!t || t.sessions === 0) {
    const none = { value: null, warnings: [...warnings, "nenhuma sessão registrada na quinzena"] };
    return { adherence: none, usage: none };
  }
  const stickiness = kpis(d).stickiness.value;
  return {
    adherence: { value: stickiness === null ? null : stickiness * 100, detail: `${t.users} usuários ativos · MAU ${t.mau}`, warnings },
    usage: { value: t.ms / 60_000, detail: `${t.sessions} sessões`, warnings },
  };
}

async function collectCsat(projectId: string, from: Date, to: Date): Promise<CollectedValue> {
  // respostas: o fim é inclusivo em scopeWhere; a quinzena termina 1 ms antes da seguinte
  const scope: Scope = { projectId, dateFrom: from, dateTo: new Date(to.getTime() - 1), surveyType: "CSAT" };
  const [score, stats] = await Promise.all([getMainScore(scope), getStats(scope)]);
  if (!score || score.value === null) return { value: null, warnings: ["nenhuma resposta de pesquisa CSAT na quinzena"] };
  return { value: score.value, detail: `${stats.total} respostas${score.surveyName ? ` · ${score.surveyName}` : ""}` };
}

/** Mensagem curta e sem dado de consulta (o erro do driver traz SQL e parâmetros). */
function safeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/fetch failed|HTTP status (402|429|5\d\d)|quota/i.test(msg)) return "banco de dados indisponível";
  return "falha ao consultar os dados";
}

export async function collectPeriod(
  workspaceId: string,
  period: PeriodId,
  platformProjects: Partial<Record<PlatformKey, string>>,
  /** projetos que quem pediu pode ver (null = sem restrição, ex.: cron) */
  allowedProjectIds: string[] | null
): Promise<Pick<SyncSnapshot, "status" | "error" | "values" | "projects">> {
  const { from, to } = periodRange(period);
  const workspaceProjects = await listProjects(workspaceId);
  const values: SyncSnapshot["values"] = {};
  const projects: SyncSnapshot["projects"] = {};
  const errors: string[] = [];
  let reachable = 0;

  await Promise.all(
    PLATFORMS.map(async (p) => {
      const id = platformProjects[p.key];
      // o projeto tem que ser do workspace e visível para quem pediu
      const project = id && (allowedProjectIds === null || allowedProjectIds.includes(id)) ? workspaceProjects.find((x) => x.id === id) : undefined;
      projects[p.key] = project ? { id: project.id, name: project.name } : null;
      if (!project) return;
      reachable++;
      try {
        const metrics = p.metrics as readonly Metric[];
        const [analytics, csat] = await Promise.all([
          collectAnalytics(project.id, from, to),
          metrics.includes("csat") ? collectCsat(project.id, from, to) : Promise.resolve(undefined),
        ]);
        for (const m of metrics) {
          const v = m === "csat" ? csat : analytics[m];
          if (v) values[`${p.key}.${m}` as PlatformIndicatorKey] = v;
        }
      } catch (e) {
        // sem dado de usuário no log: só a plataforma e a mensagem do erro
        console.error(`[product-report] coleta ${p.key} ${period}:`, e instanceof Error ? e.message.slice(0, 300) : e);
        errors.push(`${p.label}: ${safeError(e)}`);
      }
    })
  );

  const failedAll = reachable > 0 && errors.length === reachable;
  return {
    status: failedAll ? "error" : errors.length || reachable < PLATFORMS.length ? "partial" : "ok",
    error: errors.length ? errors.join("; ") : null,
    values,
    projects,
  };
}

/** Coleta a quinzena e registra a execução (inclusive a falha, para nova tentativa). */
export async function syncPeriod(input: {
  workspaceId: string;
  period: PeriodId;
  trigger: "manual" | "cron";
  userId?: string | null;
  allowedProjectIds: string[] | null;
}) {
  const settings = await getProductReportSettings(input.workspaceId);
  let result: Awaited<ReturnType<typeof collectPeriod>>;
  try {
    result = await collectPeriod(input.workspaceId, input.period, settings.platformProjects, input.allowedProjectIds);
  } catch (e) {
    console.error(`[product-report] sync ${input.period}:`, e instanceof Error ? e.message.slice(0, 300) : e);
    result = { status: "error", error: safeError(e), values: {}, projects: {} };
  }
  const run = await insertRun({
    workspaceId: input.workspaceId,
    period: input.period,
    kind: "sync",
    status: result.status,
    trigger: input.trigger,
    data: { values: result.values, projects: result.projects },
    error: result.error,
    createdBy: input.userId ?? null,
  });
  return { ...run, status: result.status, error: result.error };
}
