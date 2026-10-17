import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./client";
import { workspaces } from "@/db/schema";
import { planOf } from "@/lib/plans";

/*
  Retenção dos dados de comportamento (rodada pelo cron diário). Sem isto as tabelas de
  heatmaps e analytics crescem para sempre: cada visita é uma linha.

   - heatmaps: a retenção do plano, com teto de 180 dias (são as linhas mais pesadas, com
     cliques e movimento; mapa de calor antigo descreve uma página que já mudou);
   - analytics: telas pela retenção do plano (teto de 2 anos); sessões e usuários seguem a
     mesma regra das telas (usuário só sai quando a última visita dele passou do corte).
  Apaga em lotes, com orçamento de tempo, para não segurar o banco numa transação longa.
*/

const BATCH = 5000;
const HEATMAP_MAX_DAYS = 180;
const ANALYTICS_MAX_DAYS = 730;

async function deleteInBatches(statement: (limit: number) => ReturnType<typeof sql>, deadline: number) {
  let total = 0;
  while (Date.now() < deadline) {
    const r = (await db.execute(statement(BATCH))) as unknown as { rowCount?: number; rows?: unknown[] };
    const n = r.rowCount ?? r.rows?.length ?? 0;
    total += n;
    if (n < BATCH) break;
  }
  return total;
}

export async function pruneBehaviorData(budgetMs = 45_000) {
  const deadline = Date.now() + budgetMs;
  const ws = await db.select({ id: workspaces.id, plan: workspaces.plan }).from(workspaces);
  const out = { heatmaps: 0, pageviews: 0, sessions: 0, users: 0 };
  for (const w of ws) {
    if (Date.now() > deadline) break;
    const days = planOf(w.plan).limits.retentionDays;
    const hmDays = Math.min(HEATMAP_MAX_DAYS, days === Infinity ? HEATMAP_MAX_DAYS : days);
    const anDays = Math.min(ANALYTICS_MAX_DAYS, days === Infinity ? ANALYTICS_MAX_DAYS : days);
    const hmCut = new Date(Date.now() - hmDays * 86_400_000).toISOString();
    const anCut = new Date(Date.now() - anDays * 86_400_000).toISOString();
    try {
      out.heatmaps += await deleteInBatches(
        (n) => sql`delete from heatmap_pageviews where id in (
          select id from heatmap_pageviews where workspace_id = ${w.id} and created_at < ${hmCut}::timestamptz limit ${n})`,
        deadline
      );
    } catch {}
    try {
      out.pageviews += await deleteInBatches(
        (n) => sql`delete from analytics_pageviews where id in (
          select p.id from analytics_pageviews p join projects pr on pr.id = p.project_id
           where pr.workspace_id = ${w.id} and p.created_at < ${anCut}::timestamptz limit ${n})`,
        deadline
      );
      out.sessions += await deleteInBatches(
        (n) => sql`delete from analytics_sessions where id in (
          select s.id from analytics_sessions s join projects pr on pr.id = s.project_id
           where pr.workspace_id = ${w.id} and s.started_at < ${anCut}::timestamptz
             and s.last_seen_at < ${anCut}::timestamptz limit ${n})`,
        deadline
      );
      // started_at/first_seen_at no filtro (redundante: começou antes de terminar) só para
      // usar os índices (project_id, started_at) e (project_id, first_seen_at) em vez de ler
      // a tabela inteira a cada lote
      out.users += await deleteInBatches(
        (n) => sql`delete from analytics_users where (project_id, anon_id) in (
          select u.project_id, u.anon_id from analytics_users u join projects pr on pr.id = u.project_id
           where pr.workspace_id = ${w.id} and u.first_seen_at < ${anCut}::timestamptz
             and u.last_seen_at < ${anCut}::timestamptz limit ${n})`,
        deadline
      );
    } catch {
      // migração do analytics ainda não aplicada: nada a limpar
    }
  }
  return out;
}
