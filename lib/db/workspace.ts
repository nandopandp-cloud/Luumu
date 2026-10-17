import "server-only";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { monthStart, planOf, type PlanId } from "@/lib/plans";
import { startOfTodayBR } from "@/lib/period";
import { db } from "./client";
import { workspaces, surveys, responses, memberships, events } from "@/db/schema";

export type WorkspaceRow = typeof workspaces.$inferSelect;

/** Dados completos do workspace (para a aba de Configurações). */
export async function getWorkspace(workspaceId: string): Promise<WorkspaceRow | null> {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  return ws ?? null;
}

/** Atualiza campos editáveis do workspace. */
export async function updateWorkspace(
  workspaceId: string,
  patch: Partial<Pick<WorkspaceRow, "name" | "slug" | "timezone" | "logoUrl">>
) {
  await db.update(workspaces).set(patch).where(eq(workspaces.id, workspaceId));
}

export interface WorkspaceUsage {
  plan: PlanId;
  planLabel: string;
  /** uso do mês do calendário atual (respostas) e atual (pesquisas ativas, membros) */
  /** events = tipos de evento rastreados pelo SDK (catálogo), somando os projetos */
  usage: { responses: number; activeSurveys: number; members: number; events: number };
  limits: { responses: number; activeSurveys: number; members: number; events: number };
}

/**
 * Eventos rastreados NO MÊS: ocorrências reais (cada clique/ação por tela) registradas pelo
 * Analytics nos projetos da workspace. O catálogo de tipos de evento tem teto e para de crescer
 * (era o número "fixo" do painel); sem a tabela do Analytics, cai para o tamanho do catálogo.
 *
 * Somar `cardinality(events)` exige ler do heap TODAS as telas do mês (a coluna não está em
 * índice nenhum) — e isto roda a cada carregamento do app e a cada atualização do medidor. No
 * fim do mês eram milhões de linhas por consulta, o que mantinha a compute do Neon escalada.
 * Os dias já encerrados não mudam mais, então a soma deles fica em cache até o dia virar;
 * só o dia de hoje é relido.
 */
const closedDaysCache = new Map<string, number>();

async function sumTrackedEvents(workspaceId: string, from: Date, to?: Date): Promise<number> {
  const r = (await db.execute(sql`
    select coalesce(sum(cardinality(p.events)), 0)::bigint n
      from analytics_pageviews p join projects pr on pr.id = p.project_id
     where pr.workspace_id = ${workspaceId} and p.created_at >= ${from.toISOString()}::timestamptz
       ${to ? sql`and p.created_at < ${to.toISOString()}::timestamptz` : sql``}`)) as unknown as { rows?: { n: string }[] };
  return Number((r.rows ?? (r as unknown as { n: string }[]))[0]?.n) || 0;
}

async function trackedEventsThisMonth(workspaceId: string, since: Date): Promise<number> {
  try {
    const today = startOfTodayBR();
    if (today <= since) return await sumTrackedEvents(workspaceId, since);
    const key = `${workspaceId}|${since.toISOString()}|${today.toISOString()}`;
    let closed = closedDaysCache.get(key);
    if (closed === undefined) {
      closed = await sumTrackedEvents(workspaceId, since, today);
      // uma entrada por workspace e dia: as de dias anteriores já não servem
      for (const k of closedDaysCache.keys()) if (k.startsWith(`${workspaceId}|`)) closedDaysCache.delete(k);
      closedDaysCache.set(key, closed);
    }
    return closed + (await sumTrackedEvents(workspaceId, today));
  } catch {
    const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(events).where(eq(events.workspaceId, workspaceId));
    return Number(n) || 0;
  }
}

/**
 * Plano do workspace + uso real vs. limites do catálogo (lib/plans.ts). Respostas contam o
 * MÊS ATUAL — os planos são "por mês"; antes somava todo o histórico. As 4 consultas rodam
 * em paralelo.
 */
export async function getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
  const since = monthStart();
  const [[ws], [{ nResponses } = { nResponses: 0 }], [{ nActive } = { nActive: 0 }], [{ nMembers } = { nMembers: 0 }], nEvents] =
    await Promise.all([
      db.select({ plan: workspaces.plan }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
      db
        .select({ nResponses: count() })
        .from(responses)
        .innerJoin(surveys, eq(responses.surveyId, surveys.id))
        .where(and(eq(surveys.workspaceId, workspaceId), gte(responses.createdAt, since))),
      db
        .select({ nActive: count() })
        .from(surveys)
        .where(and(eq(surveys.workspaceId, workspaceId), eq(surveys.status, "ativa"))),
      db.select({ nMembers: count() }).from(memberships).where(eq(memberships.workspaceId, workspaceId)),
      trackedEventsThisMonth(workspaceId, since),
    ]);

  const plan = planOf(ws?.plan);
  return {
    plan: plan.id,
    planLabel: plan.name,
    usage: {
      responses: Number(nResponses) || 0,
      activeSurveys: Number(nActive) || 0,
      members: Number(nMembers) || 0,
      events: nEvents,
    },
    limits: { responses: plan.limits.responses, activeSurveys: plan.limits.activeSurveys, members: plan.limits.members, events: Infinity },
  };
}

/*
  Memória por instância compartilhada entre o layout do app (todo carregamento de página) e
  GET /api/usage (o medidor recarrega ao navegar e a cada 5 min): várias abas e pessoas da
  mesma workspace não refazem as contagens. 60s é o atraso máximo de um medidor de uso mensal.
*/
const USAGE_TTL_MS = 60_000;
const usageMemo = new Map<string, { v: WorkspaceUsage; exp: number }>();

export async function getWorkspaceUsageCached(workspaceId: string): Promise<WorkspaceUsage> {
  const hit = usageMemo.get(workspaceId);
  if (hit && hit.exp > Date.now()) return hit.v;
  const v = await getWorkspaceUsage(workspaceId);
  usageMemo.set(workspaceId, { v, exp: Date.now() + USAGE_TTL_MS });
  return v;
}
