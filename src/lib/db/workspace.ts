import "server-only";
import { and, count, eq, gte, lt, sql } from "drizzle-orm";
import { monthStart, planOf, type PlanId } from "@/lib/billing/plans";
import { startOfTodayBR } from "@/lib/utils/period";
import { db } from "./client";
import { sharedCache } from "./shared-cache";
import { workspaces, surveys, responses, memberships, events, workspaceDailyEvents } from "@/lib/db/schema";

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
 * Somar `cardinality(events)` exige ler do heap as telas (a coluna não está em índice nenhum), e
 * isto roda a cada carregamento do app e a cada atualização do medidor. Os dias encerrados ficam
 * em workspace_daily_events: cada dia é somado UMA vez, lendo só aquele dia (índice BRIN de
 * created_at, migração 0040; sem ele o Postgres lê a tabela inteira mesmo para um dia). Antes
 * a soma deles ficava no cache do Next, mas a chave do `unstable_cache` inclui o texto da função
 * compilada e muda a cada deploy: em 10/2026 a leitura do mês (varredura sequencial da tabela
 * inteira, ~1,7 GB) rodava ~12×/dia, e cada uma subia o working set e a compute do Neon por até
 * uma hora. A parte aberta (hoje, e ontem até 2 h depois da virada) fica 5 min no cache
 * compartilhado: o medidor é informativo (sem limite).
 */
async function sumTrackedEvents(workspaceId: string, from: string, to?: string): Promise<number> {
  const r = (await db.execute(sql`
    select coalesce(sum(cardinality(p.events)), 0)::bigint n
      from analytics_pageviews p join projects pr on pr.id = p.project_id
     where pr.workspace_id = ${workspaceId} and p.created_at >= ${from}::timestamptz
       ${to ? sql`and p.created_at < ${to}::timestamptz` : sql``}`)) as unknown as { rows?: { n: string }[] };
  return Number((r.rows ?? (r as unknown as { n: string }[]))[0]?.n) || 0;
}

const openTrackedEvents = sharedCache(sumTrackedEvents, "tracked-events-today", 300);

const DAY_MS = 86_400_000;
/** Telas chegam até algum tempo depois da virada (aba fechada depois da meia-noite): ontem só é guardado depois disto. */
const SETTLE_MS = 2 * 3_600_000;
/** Data (AAAA-MM-DD) de uma meia-noite de Brasília. */
const brDay = (midnight: Date) => new Date(midnight.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);

/** Eventos de [from, to), meias-noites de Brasília: soma dos dias guardados; os que faltam são lidos e guardados. */
async function closedDaysTrackedEvents(workspaceId: string, from: Date, to: Date): Promise<number> {
  const days: string[] = [];
  for (let t = from.getTime(); t < to.getTime(); t += DAY_MS) days.push(brDay(new Date(t)));
  if (!days.length) return 0;
  const saved = await db
    .select({ day: workspaceDailyEvents.day, events: workspaceDailyEvents.events })
    .from(workspaceDailyEvents)
    .where(and(eq(workspaceDailyEvents.workspaceId, workspaceId), gte(workspaceDailyEvents.day, days[0]), lt(workspaceDailyEvents.day, brDay(to))));
  const byDay = new Map(saved.map((r) => [r.day, r.events]));
  const missing = days.filter((d) => !byDay.has(d));
  if (missing.length) {
    // normalmente só ontem; o 1º uso lê o mês até aqui uma única vez
    const r = (await db.execute(sql`
      select to_char(p.created_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') d, sum(cardinality(p.events))::bigint n
        from analytics_pageviews p join projects pr on pr.id = p.project_id
       where pr.workspace_id = ${workspaceId}
         and p.created_at >= ${new Date(`${missing[0]}T00:00:00-03:00`).toISOString()}::timestamptz
         and p.created_at < ${to.toISOString()}::timestamptz
       group by 1`)) as unknown as { rows?: { d: string; n: string }[] };
    const read = new Map((r.rows ?? (r as unknown as { d: string; n: string }[])).map((x) => [x.d, Number(x.n) || 0]));
    // dia sem nenhuma tela também é guardado (zero), senão seria relido a cada vez
    const fresh = missing.map((day) => ({ workspaceId, day, events: read.get(day) ?? 0 }));
    await db.insert(workspaceDailyEvents).values(fresh).onConflictDoNothing();
    for (const x of fresh) byDay.set(x.day, x.events);
  }
  return days.reduce((a, d) => a + (byDay.get(d) ?? 0), 0);
}

async function trackedEventsThisMonth(workspaceId: string, since: Date): Promise<number> {
  try {
    const today = startOfTodayBR();
    const settled = Date.now() - today.getTime() >= SETTLE_MS ? today : new Date(today.getTime() - DAY_MS);
    const until = settled > since ? settled : since;
    const [closed, open] = await Promise.all([
      // sem a migração 0040 (tabela diária) soma direto, como antes
      closedDaysTrackedEvents(workspaceId, since, until).catch(() => sumTrackedEvents(workspaceId, since.toISOString(), until.toISOString())),
      openTrackedEvents(workspaceId, until.toISOString()),
    ]);
    return closed + open;
  } catch {
    const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(events).where(eq(events.workspaceId, workspaceId));
    return Number(n) || 0;
  }
}

/**
 * Plano do workspace + uso real vs. limites do catálogo (lib/billing/plans.ts). Respostas contam o
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
