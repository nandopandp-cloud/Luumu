import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "./client";
import { hostList } from "@/lib/platform/hosts";
import { SURVEY_EVENT } from "@/lib/analytics/core";
import { addDays, brDay, dayStart, fullDays, planRange, type RangePlan } from "@/lib/analytics/rollup-range";
import type { AnalyticsScope, AnalyticsSettings } from "./analytics";

/*
  Resumo diário das telas do Analytics (analytics_session_days, migração 0041).

  analytics_pageviews tem uma linha por tela vista: no maior projeto, 4 mi em 30 dias. As
  consultas de telas e eventos do painel liam essa tabela inteira a cada período (5 a 33 s). O
  resumo junta, por sessão e dia de Brasília, as telas e os eventos daquele dia em listas
  paralelas (nome · quantidade · tempo): ~12× menos linhas, e as contagens continuam EXATAS,
  porque a pessoa e a sessão estão na linha.

  Gravação: o cron diário refaz os últimos dias inteiros (rollupAnalyticsDays). A coleta do SDK
  não muda. Leitura: cada consulta junta os dias prontos do resumo com a ponta do período lida
  das telas, no mesmo formato (rollupPlan + source). Sem a migração, ou com ANALYTICS_ROLLUPS=off,
  rollupPlan devolve null e lib/db/analytics.ts usa as consultas sobre as telas.
*/

const TZ = sql.raw(`'America/Sao_Paulo'`);
const iso = (d: Date) => d.toISOString();
const rows = <T,>(r: unknown) => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];
const list = (xs: string[]) => sql.join(xs.map((x) => sql`${x}`), sql`, `);

const COLS = sql.raw(`project_id, day, session_id, anon_id, host, device, pages, duration_ms, paths, path_counts, path_ms, events, event_counts`);

/**
 * Telas (alias p, filtradas por `where`) agregadas no formato do resumo. É a mesma conta no cron
 * e nas pontas do período, então resumo e telas não divergem.
 *
 * Telas e eventos se juntam num único agrupamento (linhas de tela e de evento empilhadas), sem
 * JOIN: as telas de hoje ainda não estão nas estatísticas do Postgres, que estima 1 linha e
 * escolheria juntar as duas partes por laço aninhado (quadrático; >90 s no maior projeto).
 */
export function rawSessionDays(where: SQL): SQL {
  return sql`
    with pv as materialized (
      select p.project_id, (p.created_at at time zone ${TZ})::date d, p.session_id, p.anon_id, p.host, p.device, p.path, p.duration_ms, p.events
        from analytics_pageviews p where ${where}
    ), x as (
      select project_id, d, session_id, anon_id, host, device, path, null::text e, count(*)::int c, sum(duration_ms)::bigint ms
        from pv group by 1, 2, 3, 4, 5, 6, 7
      union all
      select project_id, d, session_id, anon_id, host, device, null, e, count(*)::int, null
        from pv, unnest(pv.events) e group by 1, 2, 3, 4, 5, 6, 8
    )
    select project_id, d "day", session_id, anon_id, host, device,
           sum(c) filter (where path is not null)::int pages, sum(ms)::bigint duration_ms,
           array_agg(path order by path) filter (where path is not null) paths,
           array_agg(c order by path) filter (where path is not null) path_counts,
           array_agg(ms order by path) filter (where path is not null) path_ms,
           coalesce(array_agg(e order by e) filter (where e is not null), '{}') events,
           coalesce(array_agg(c order by e) filter (where e is not null), '{}') event_counts
      from x group by 1, 2, 3, 4, 5, 6`;
}

/**
 * Telas (alias p) como linhas do resumo SEM agregar: uma por tela vista, com a tela e os eventos
 * dela. Toda consulta de leitura agrega por pessoa/sessão/tela, então o resultado é o mesmo, e as
 * pontas do período (o dia parcial do começo e hoje) custam só a leitura das telas.
 */
function rawRows(where: SQL): SQL {
  return sql`
    select p.project_id, (p.created_at at time zone ${TZ})::date "day", p.session_id, p.anon_id, p.host, p.device,
           1 pages, p.duration_ms::bigint duration_ms, array[p.path] paths, array[1] path_counts, array[p.duration_ms::bigint] path_ms,
           p.events, array_fill(1, array[cardinality(p.events)]) event_counts
      from analytics_pageviews p where ${where}`;
}

/* ---------- gravação (cron) ---------- */

/** Quantos dias inteiros o cron refaz: telas chegam quando a pessoa sai delas, às vezes horas depois. */
export const ROLLUP_REDO_DAYS = 3;

/** (Re)monta um dia inteiro, de todos os projetos, numa transação: apaga, regrava e marca pronto. */
export async function rollupDay(day: string) {
  const from = dayStart(day);
  const to = dayStart(addDays(day, 1));
  await db.batch([
    db.execute(sql`delete from analytics_session_days where day = ${day}::date`),
    db.execute(sql`insert into analytics_session_days (${COLS})
      ${rawSessionDays(sql`p.created_at >= ${iso(from)}::timestamptz and p.created_at < ${iso(to)}::timestamptz`)}`),
    db.execute(sql`insert into analytics_rollup_days (day, done_at) values (${day}::date, now())
      on conflict (day) do update set done_at = excluded.done_at`),
  ]);
}

/** Cron diário: refaz os últimos ROLLUP_REDO_DAYS dias inteiros (ontem incluído). */
export async function rollupAnalyticsDays(now = new Date()) {
  const today = brDay(now);
  const days: string[] = [];
  for (let i = ROLLUP_REDO_DAYS; i >= 1; i--) {
    const d = addDays(today, -i);
    await rollupDay(d);
    days.push(d);
  }
  return { days };
}

/* ---------- leitura ---------- */

export const rollupsEnabled = () => process.env.ANALYTICS_ROLLUPS !== "off";

const doneCache = new Map<string, { exp: number; days: Set<string> }>();
let missingWarned = false;

/** Dias prontos no intervalo (cache de 1 min por instância; tabela ausente = nenhum). */
async function doneDays(first: string, last: string): Promise<Set<string>> {
  const key = `${first}:${last}`;
  const hit = doneCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.days;
  let days = new Set<string>();
  try {
    const r = rows<{ d: string }>(
      await db.execute(sql`select to_char(day, 'YYYY-MM-DD') d from analytics_rollup_days where day between ${first}::date and ${last}::date`)
    );
    days = new Set(r.map((x) => x.d));
  } catch (e) {
    const why = (e as { cause?: { message?: string } })?.cause?.message ?? String(e);
    if (!missingWarned) console.warn(`[analytics] resumo diário indisponível (migração 0041?), lendo as telas: ${why}`);
    missingWarned = true;
  }
  if (doneCache.size > 500) doneCache.clear();
  doneCache.set(key, { exp: Date.now() + 60_000, days });
  return days;
}

/** Como ler [from, to): null = não há dia pronto no resumo (use as telas). */
export async function rollupPlan(from: Date, to: Date): Promise<RangePlan | null> {
  if (!rollupsEnabled()) return null;
  const span = fullDays(from, to);
  if (!span) return null;
  const done = await doneDays(span.first, span.last);
  const plan = planRange(from, to, (d) => done.has(d));
  return plan.rollup ? plan : null;
}

/** Filtro de plataforma e dispositivo sobre um alias. */
function scopeFilter(s: AnalyticsScope, alias: "p" | "r"): SQL {
  const a = sql.raw(alias);
  return sql`${s.host ? sql` and ${a}.host in (${list(hostList(s.host))})` : sql``}${s.device ? sql` and ${a}.device = ${s.device}` : sql``}`;
}

/**
 * As linhas do período no formato do resumo: dias prontos do resumo + pontas das telas.
 * `anonIds` restringe às pessoas pedidas (lista de usuários) também nas pontas.
 */
function source(s: AnalyticsScope, plan: RangePlan, anonIds?: string[]): SQL {
  const only = (a: "p" | "r") => (anonIds ? sql` and ${sql.raw(a)}.anon_id in (${list(anonIds)})` : sql``);
  const parts: SQL[] = [];
  if (plan.rollup) {
    parts.push(sql`select ${COLS} from analytics_session_days r
      where r.project_id = ${s.projectId} and r.day between ${plan.rollup.first}::date and ${plan.rollup.last}::date${scopeFilter(s, "r")}${only("r")}`);
  }
  for (const x of plan.raw) {
    parts.push(
      rawRows(sql`p.project_id = ${s.projectId} and p.created_at >= ${iso(x.from)}::timestamptz and p.created_at < ${iso(x.to)}::timestamptz${scopeFilter(s, "p")}${only("p")}`)
    );
  }
  return sql`(${sql.join(parts, sql` union all `)})`;
}

/*
  Consultas sobre o resumo. Devolvem as MESMAS colunas das consultas sobre as telas em
  lib/db/analytics.ts, que fazem a conversão. Agregam em etapas (pessoa, depois o total) em vez
  de count(distinct), que obriga o Postgres a ordenar milhões de pares.
*/
export const rollupQueries = {
  /** Telas mais vistas: visualizações, pessoas e tempo médio por tela. */
  pages: (s: AnalyticsScope, plan: RangePlan, limit: number) => sql`
    select host, path, sum(c)::int pv, count(*)::int users, coalesce((sum(ms)::numeric / nullif(sum(c), 0))::int, 0) ms from (
      select src.host, u.path, src.anon_id, sum(u.c) c, sum(u.ms) ms
        from ${source(s, plan)} src, unnest(src.paths, src.path_counts, src.path_ms) u(path, c, ms) group by 1, 2, 3
    ) t group by 1, 2 order by 3 desc limit ${limit}`,

  /**
   * Eventos: ocorrências, pessoas e sessões. Pessoas e sessões são contadas em ramos separados:
   * uma sessão pode ter mais de uma pessoa (a identidade muda no meio dela) e não pode contar duas
   * vezes; uma sessão que cruza a meia-noite também conta uma vez só.
   */
  events: (s: AnalyticsScope, plan: RangePlan, limit: number) => sql`
    select e, sum(total)::int total, sum(users)::int users, sum(sessions)::int sessions from (
      select e, sum(c) total, count(*) users, 0 sessions from (
        select u.e, src.anon_id, sum(u.c) c from ${source(s, plan)} src, unnest(src.events, src.event_counts) u(e, c) group by 1, 2
      ) a group by e
      union all
      select e, 0, 0, count(*) from (
        select u.e, src.session_id from ${source(s, plan)} src, unnest(src.events) u(e) group by 1, 2
      ) b group by e
    ) t group by e order by users desc, total desc limit ${limit}`,

  /** Pessoas por dia de cada evento (só série diária: a por hora lê as telas). */
  eventTrend: (s: AnalyticsScope, plan: RangePlan, names: string[]) => sql`
    select u.e, to_char(src.day, 'YYYY-MM-DD') d, count(distinct src.anon_id)::int users
      from ${source(s, plan)} src, unnest(src.events) u(e)
     where src.events && array[${list(names)}]::text[] and u.e in (${list(names)})
     group by 1, 2 order by 2`,

  /** Pessoas ativas e pessoas que fizeram cada evento configurado, no período e no anterior. */
  configured: (s: AnalyticsScope, cur: RangePlan, p: AnalyticsScope, prev: RangePlan, st: AnalyticsSettings) => {
    const ev = (name: string | null, col: string) =>
      name
        ? sql`, count(distinct anon_id) filter (where cur and ${name} = any(events))::int ${sql.raw(col)},
               count(distinct anon_id) filter (where not cur and ${name} = any(events))::int ${sql.raw(col + "_prev")}`
        : sql``;
    return sql`
      select count(distinct anon_id) filter (where cur)::int active,
             count(distinct anon_id) filter (where not cur)::int active_prev,
             count(distinct anon_id) filter (where cur and cardinality(events) > 0)::int any_event,
             count(distinct anon_id) filter (where cur and ${SURVEY_EVENT} = any(events))::int surveyed
             ${ev(st.northStarEvent, "ns")} ${ev(st.taskStartEvent, "ts")} ${ev(st.taskDoneEvent, "td")} ${ev(st.activationEvent, "act")}
        from (select true cur, a.anon_id, a.events from ${source(s, cur)} a
              union all select false, b.anon_id, b.events from ${source(p, prev)} b) src`;
  },

  /**
   * Funil: por pessoa, se passou de cada etapa e o primeiro dia; a volta em até 7 dias vem das
   * sessões. As sessões entram por uma junção só (as que podem cair em [1º dia, último dia + 7]),
   * não por uma busca por pessoa: com dezenas de milhares de pessoas, a busca levava 25 s.
   */
  funnel: (s: AnalyticsScope, plan: RangePlan, st: AnalyticsSettings) => {
    const step2 = st.taskStartEvent ? sql`bool_or(${st.taskStartEvent} = any(src.events))` : sql`sum(src.pages) >= 2`;
    const step3 = st.taskDoneEvent ? sql`bool_or(${st.taskDoneEvent} = any(src.events))` : sql`bool_or(cardinality(src.events) > 0)`;
    const back = { from: new Date(s.from.getTime() - 86_400_000), to: new Date(s.to.getTime() + 9 * 86_400_000) };
    return sql`
      with u as materialized (
        select src.anon_id, ${step2} s2, ${step3} s3, min(src.day) d0 from ${source(s, plan)} src group by src.anon_id
      ), sx as (
        select s2x.anon_id, (s2x.started_at at time zone ${TZ})::date sd from analytics_sessions s2x
         where s2x.project_id = ${s.projectId} and s2x.started_at >= ${iso(back.from)}::timestamptz and s2x.started_at < ${iso(back.to)}::timestamptz
      ), back as (
        select distinct u.anon_id from u join sx on sx.anon_id = u.anon_id and sx.sd > u.d0 and sx.sd <= u.d0 + 7
      )
      select count(*)::int a, count(*) filter (where s2)::int b, count(*) filter (where s2 and s3)::int c,
             (select count(*) from back)::int d
        from u`;
  },

  /** Eventos no período de cada pessoa da página da lista de usuários. */
  userEvents: (s: AnalyticsScope, plan: RangePlan, anonIds: string[]) => sql`
    select src.anon_id, coalesce(sum((select sum(c) from unnest(src.event_counts) c)), 0)::int n
      from ${source(s, plan, anonIds)} src group by 1`,
};
