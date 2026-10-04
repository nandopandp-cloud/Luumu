import "server-only";
import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { db } from "./client";
import { analyticsPageviews, analyticsSessions, analyticsSettings, analyticsUsers, analyticsViews } from "@/db/schema";
import { analyticsViewId } from "./ids";
import {
  classifyChannel,
  frequencyOf,
  SURVEY_EVENT,
  type AnalyticsPayload,
  type Channel,
  type Frequency,
  type ViewConfig,
  parseViewConfig,
} from "@/lib/analytics/core";

/*
  Analytics de produto no banco.

  Gravação: um envio do SDK (um carregamento de página, com as telas visitadas nele) faz três
  escritas numa única ida ao banco (batch): o usuário (primeira visita e origem), a sessão
  (contadores somados) e as telas.

  Leitura: cada bloco da tela é um "dataset" calculado no Postgres; a página pede só os
  datasets da aba (ou dos blocos da visão personalizada). Datas em São Paulo.
*/

const TZ = sql.raw(`'America/Sao_Paulo'`);

/* ---------- configuração ---------- */

export interface AnalyticsSettings {
  enabled: boolean;
  northStarEvent: string | null;
  activationEvent: string | null;
  taskStartEvent: string | null;
  taskDoneEvent: string | null;
}

const settingsCache = new Map<string, { v: AnalyticsSettings; exp: number }>();
const EMPTY: AnalyticsSettings = { enabled: false, northStarEvent: null, activationEvent: null, taskStartEvent: null, taskDoneEvent: null };

export async function getAnalyticsSettings(projectId: string, fresh = false): Promise<AnalyticsSettings> {
  const hit = settingsCache.get(projectId);
  if (!fresh && hit && hit.exp > Date.now()) return hit.v;
  const [row] = await db.select().from(analyticsSettings).where(eq(analyticsSettings.projectId, projectId)).limit(1);
  const v: AnalyticsSettings = row
    ? { enabled: row.enabled, northStarEvent: row.northStarEvent, activationEvent: row.activationEvent, taskStartEvent: row.taskStartEvent, taskDoneEvent: row.taskDoneEvent }
    : EMPTY;
  settingsCache.set(projectId, { v, exp: Date.now() + 60_000 });
  return v;
}

export async function saveAnalyticsSettings(projectId: string, userId: string, patch: Partial<AnalyticsSettings>) {
  const cur = await getAnalyticsSettings(projectId, true);
  const next = { ...cur, ...patch };
  await db
    .insert(analyticsSettings)
    .values({ projectId, ...next, updatedBy: userId })
    .onConflictDoUpdate({ target: analyticsSettings.projectId, set: { ...next, updatedBy: userId, updatedAt: new Date() } });
  settingsCache.delete(projectId);
}

/* ---------- gravação ---------- */

/*
  A coluna do avatar chegou na migração 0022. Se o deploy for ao ar antes dela, o upsert do
  usuário (que o Drizzle monta com TODAS as colunas da tabela) falharia e a visita inteira se
  perderia: nesse caso a instância passa a gravar o usuário sem o avatar.
*/
let avatarColumn = true;
const missingColumn = (e: unknown) => {
  for (let x = e as { code?: string; cause?: unknown } | undefined, i = 0; x && i < 4; x = x.cause as typeof x, i++) if (x.code === "42703") return true;
  return /column .* does not exist/i.test(String((e as Error)?.message ?? ""));
};

export async function recordAnalytics(workspaceId: string, projectId: string, host: string, p: AnalyticsPayload) {
  void workspaceId;
  const channel = classifyChannel({ ref: p.ref, host, utmSource: p.utm.source, utmMedium: p.utm.medium });
  const first = new Date(Math.min(p.st, ...p.pages.map((x) => x.t)));
  const last = new Date(Math.max(...p.pages.map((x) => x.t + x.dur)));
  const sessionId = `${projectId}:${p.sid}`;
  // continuação (aba que voltou) soma tempo/eventos na mesma tela: não é visualização nova
  const pv = p.pages.filter((x) => !x.c).length;
  const dur = p.pages.reduce((a, x) => a + x.dur, 0);
  const exit = p.pages[p.pages.length - 1].path;

  const user = (withAvatar: boolean) =>
    withAvatar
      ? db
          .insert(analyticsUsers)
          .values({
            projectId,
            anonId: p.aid,
            userId: p.uid,
            userEmail: p.email,
            userName: p.name,
            userAvatar: p.avatar,
            firstSeenAt: first,
            lastSeenAt: last,
            firstChannel: channel,
            firstSource: p.utm.source || p.ref,
            firstCampaign: p.utm.campaign,
            firstLanding: p.landing,
            firstHost: host,
            firstDevice: p.device,
          })
          .onConflictDoUpdate({
            target: [analyticsUsers.projectId, analyticsUsers.anonId],
            set: {
              lastSeenAt: sql`greatest(${analyticsUsers.lastSeenAt}, excluded.last_seen_at)`,
              userId: sql`coalesce(excluded.user_id, ${analyticsUsers.userId})`,
              userEmail: sql`coalesce(excluded.user_email, ${analyticsUsers.userEmail})`,
              userName: sql`coalesce(excluded.user_name, ${analyticsUsers.userName})`,
              userAvatar: sql`coalesce(excluded.user_avatar, ${analyticsUsers.userAvatar})`,
            },
          })
      : db.execute(sql`
          insert into analytics_users (project_id, anon_id, user_id, user_email, user_name, first_seen_at, last_seen_at,
                                       first_channel, first_source, first_campaign, first_landing, first_host, first_device)
          values (${projectId}, ${p.aid}, ${p.uid}, ${p.email}, ${p.name}, ${iso(first)}::timestamptz, ${iso(last)}::timestamptz,
                  ${channel}, ${p.utm.source || p.ref}, ${p.utm.campaign}, ${p.landing}, ${host}, ${p.device})
          on conflict (project_id, anon_id) do update set
            last_seen_at = greatest(analytics_users.last_seen_at, excluded.last_seen_at),
            user_id = coalesce(excluded.user_id, analytics_users.user_id),
            user_email = coalesce(excluded.user_email, analytics_users.user_email),
            user_name = coalesce(excluded.user_name, analytics_users.user_name)`);

  const write = (withAvatar: boolean) =>
    db.batch([
      user(withAvatar),
      db
        .insert(analyticsSessions)
        .values({
          id: sessionId,
          projectId,
          anonId: p.aid,
          userId: p.uid,
          host,
          device: p.device,
          os: p.os,
          browser: p.browser,
          viewportW: p.vw,
          startedAt: new Date(p.st),
          lastSeenAt: last,
          pageviews: pv,
          durationMs: dur,
          landingPath: p.landing,
          exitPath: exit,
          channel,
          referrer: p.ref,
          utmSource: p.utm.source,
          utmMedium: p.utm.medium,
          utmCampaign: p.utm.campaign,
        })
        .onConflictDoUpdate({
          target: analyticsSessions.id,
          set: {
            lastSeenAt: sql`greatest(${analyticsSessions.lastSeenAt}, excluded.last_seen_at)`,
            pageviews: sql`${analyticsSessions.pageviews} + excluded.pageviews`,
            durationMs: sql`least(${analyticsSessions.durationMs} + excluded.duration_ms, 86400000)`,
            exitPath: sql`excluded.exit_path`,
            userId: sql`coalesce(excluded.user_id, ${analyticsSessions.userId})`,
          },
        }),
      db.insert(analyticsPageviews).values(
        p.pages.map((x) => ({
          id: `pv_${p.sid}_${x.id}`,
          projectId,
          sessionId,
          anonId: p.aid,
          host,
          path: x.path,
          device: p.device,
          durationMs: x.dur,
          events: x.ev,
          createdAt: new Date(x.t),
        }))
      ).onConflictDoUpdate({
        target: analyticsPageviews.id,
        set: {
          durationMs: sql`least(${analyticsPageviews.durationMs} + excluded.duration_ms, 14400000)`,
          events: sql`array(select distinct unnest(${analyticsPageviews.events} || excluded.events))`,
        },
      }),
    ]);

  try {
    await write(avatarColumn);
  } catch (e) {
    if (!avatarColumn || !missingColumn(e)) throw e;
    avatarColumn = false;
    console.warn("[analytics] coluna user_avatar ausente: rode db/migrations/0022_analytics_users_avatar.sql");
    await write(false);
  }
}

/* ---------- leitura ---------- */

export interface AnalyticsScope {
  projectId: string;
  from: Date;
  to: Date;
  host?: string;
  device?: string;
}

const iso = (d: Date) => d.toISOString();
const n = (v: unknown) => Number(v) || 0;
const rows = <T,>(r: unknown) => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];

/** Período anterior de mesma duração. */
export function prevScope(s: AnalyticsScope): AnalyticsScope {
  const span = s.to.getTime() - s.from.getTime();
  return { ...s, from: new Date(s.from.getTime() - span), to: new Date(s.from.getTime()) };
}

const spanDays = (s: AnalyticsScope) => Math.max(1, Math.round((s.to.getTime() - s.from.getTime()) / 86_400_000));

/** Filtro de sessões (alias s) no intervalo. */
function sf(s: AnalyticsScope, from = s.from, to = s.to): SQL {
  return sql`s.project_id = ${s.projectId} and s.started_at >= ${iso(from)}::timestamptz and s.started_at < ${iso(to)}::timestamptz${
    s.host ? sql` and s.host = ${s.host}` : sql``
  }${s.device ? sql` and s.device = ${s.device}` : sql``}`;
}
/** Filtro de telas (alias p) no intervalo. */
function pf(s: AnalyticsScope, from = s.from, to = s.to): SQL {
  return sql`p.project_id = ${s.projectId} and p.created_at >= ${iso(from)}::timestamptz and p.created_at < ${iso(to)}::timestamptz${
    s.host ? sql` and p.host = ${s.host}` : sql``
  }${s.device ? sql` and p.device = ${s.device}` : sql``}`;
}
/** Filtro de usuários pela PRIMEIRA visita (alias u). */
function uf(s: AnalyticsScope, from = s.from, to = s.to): SQL {
  return sql`u.project_id = ${s.projectId} and u.first_seen_at >= ${iso(from)}::timestamptz and u.first_seen_at < ${iso(to)}::timestamptz${
    s.host ? sql` and u.first_host = ${s.host}` : sql``
  }${s.device ? sql` and u.first_device = ${s.device}` : sql``}`;
}
const day = (col: SQL) => sql`to_char((${col} at time zone ${TZ})::date, 'YYYY-MM-DD')`;
/** timestamp → ISO 8601 em UTC ("…T…Z"): o formato texto do Postgres ("2026-10-02 01:54:25+00") não é lido pelo Safari */
const isoTs = (col: SQL) => sql`to_char(${col} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/** Há algum dado coletado no projeto? */
export async function hasAnalyticsData(projectId: string) {
  const [r] = await db.select({ id: analyticsSessions.id }).from(analyticsSessions).where(eq(analyticsSessions.projectId, projectId)).limit(1);
  return !!r;
}

/** Desde quando há dados (para explicar "novos usuários" no começo da coleta). */
export async function collectingSince(projectId: string): Promise<string | null> {
  const r = rows<{ d: string | null }>(await db.execute(sql`select ${isoTs(sql`min(first_seen_at)`)} d from analytics_users where project_id = ${projectId}`));
  return r[0]?.d ?? null;
}

/** Nomes de eventos vistos no projeto (para configurar métricas). */
export async function listAnalyticsEvents(projectId: string): Promise<string[]> {
  const r = rows<{ e: string }>(
    await db.execute(sql`
      select e from (select unnest(events) e from analytics_pageviews where project_id = ${projectId} and created_at > now() - interval '14 days') t
      group by e order by count(*) desc limit 200`)
  );
  return r.map((x) => x.e);
}

/* ---- datasets ---- */

async function dailySessions(s: AnalyticsScope, p: AnalyticsScope) {
  const r = rows<{ d: string; users: number; sessions: number; ms: number; pv: number }>(
    await db.execute(sql`
      select ${day(sql`s.started_at`)} d, count(distinct s.anon_id)::int users, count(*)::int sessions,
             coalesce(avg(s.duration_ms), 0)::int ms, coalesce(sum(s.pageviews), 0)::int pv
        from analytics_sessions s where ${sf(s, p.from, s.to)} group by 1 order by 1`)
  );
  const curFrom = s.from.getTime();
  const split = (x: { d: string }) => new Date(`${x.d}T12:00:00-03:00`).getTime() >= curFrom;
  return { cur: r.filter(split).map((x) => ({ ...x, users: n(x.users), sessions: n(x.sessions), ms: n(x.ms), pv: n(x.pv) })), prev: r.filter((x) => !split(x)).map((x) => ({ ...x, users: n(x.users), sessions: n(x.sessions), ms: n(x.ms), pv: n(x.pv) })) };
}

async function totals(s: AnalyticsScope, p: AnalyticsScope) {
  const [r] = rows<Record<string, number>>(
    await db.execute(sql`
      select count(distinct s.anon_id) filter (where s.started_at >= ${iso(s.from)}::timestamptz)::int users,
             count(distinct s.anon_id) filter (where s.started_at < ${iso(s.from)}::timestamptz)::int users_prev,
             count(*) filter (where s.started_at >= ${iso(s.from)}::timestamptz)::int sessions,
             count(*) filter (where s.started_at < ${iso(s.from)}::timestamptz)::int sessions_prev,
             coalesce(avg(s.duration_ms) filter (where s.started_at >= ${iso(s.from)}::timestamptz), 0)::int ms,
             coalesce(avg(s.duration_ms) filter (where s.started_at < ${iso(s.from)}::timestamptz), 0)::int ms_prev,
             coalesce(sum(s.pageviews) filter (where s.started_at >= ${iso(s.from)}::timestamptz), 0)::int pv,
             coalesce(sum(s.pageviews) filter (where s.started_at < ${iso(s.from)}::timestamptz), 0)::int pv_prev,
             count(distinct s.anon_id) filter (where s.user_id is not null and s.started_at >= ${iso(s.from)}::timestamptz)::int identified
        from analytics_sessions s where ${sf(s, p.from, s.to)}`)
  );
  // MAU: 30 dias que terminam no fim do período (e no fim do período anterior)
  const d30 = 30 * 86_400_000;
  const [m] = rows<Record<string, number>>(
    await db.execute(sql`
      select count(distinct s.anon_id) filter (where s.started_at >= ${iso(new Date(s.to.getTime() - d30))}::timestamptz)::int mau,
             count(distinct s.anon_id) filter (where s.started_at < ${iso(p.to)}::timestamptz and s.started_at >= ${iso(new Date(p.to.getTime() - d30))}::timestamptz)::int mau_prev
        from analytics_sessions s where ${sf(s, new Date(p.to.getTime() - d30), s.to)}`)
  );
  const o = Object.fromEntries(Object.entries({ ...r, ...m }).map(([k, v]) => [k, n(v)]));
  return o as Record<"users" | "users_prev" | "sessions" | "sessions_prev" | "ms" | "ms_prev" | "pv" | "pv_prev" | "identified" | "mau" | "mau_prev", number>;
}

/** MAU móvel por dia (semanal em períodos longos, para não pesar). */
async function mauSeries(s: AnalyticsScope) {
  const step = spanDays(s) > 45 ? 7 : 1;
  const r = rows<{ d: string; mau: number }>(
    await db.execute(sql`
      with du as (
        select distinct (s.started_at at time zone ${TZ})::date d, s.anon_id
          from analytics_sessions s where ${sf(s, new Date(s.from.getTime() - 29 * 86_400_000), s.to)}
      ), days as (
        select generate_series((${iso(s.from)}::timestamptz at time zone ${TZ})::date, ((${iso(s.to)}::timestamptz - interval '1 second') at time zone ${TZ})::date, ${`${step} days`}::interval)::date d
      )
      select to_char(days.d, 'YYYY-MM-DD') d, (select count(distinct du.anon_id) from du where du.d between days.d - 29 and days.d)::int mau
        from days order by 1`)
  );
  return r.map((x) => ({ d: x.d, mau: n(x.mau) }));
}

/** Usuários que fizeram cada evento configurado (período e anterior). */
async function configured(s: AnalyticsScope, p: AnalyticsScope, st: AnalyticsSettings) {
  const ev = (name: string | null, col: string) =>
    name
      ? sql`, count(distinct p.anon_id) filter (where ${name} = any(p.events) and p.created_at >= ${iso(s.from)}::timestamptz)::int ${sql.raw(col)},
             count(distinct p.anon_id) filter (where ${name} = any(p.events) and p.created_at < ${iso(s.from)}::timestamptz)::int ${sql.raw(col + "_prev")}`
      : sql``;
  const [r] = rows<Record<string, number>>(
    await db.execute(sql`
      select count(distinct p.anon_id) filter (where p.created_at >= ${iso(s.from)}::timestamptz)::int active,
             count(distinct p.anon_id) filter (where p.created_at < ${iso(s.from)}::timestamptz)::int active_prev,
             count(distinct p.anon_id) filter (where cardinality(p.events) > 0 and p.created_at >= ${iso(s.from)}::timestamptz)::int any_event,
             count(distinct p.anon_id) filter (where ${SURVEY_EVENT} = any(p.events) and p.created_at >= ${iso(s.from)}::timestamptz)::int surveyed
             ${ev(st.northStarEvent, "ns")} ${ev(st.taskStartEvent, "ts")} ${ev(st.taskDoneEvent, "td")} ${ev(st.activationEvent, "act")}
        from analytics_pageviews p where ${pf(s, p.from, s.to)}`)
  );
  return Object.fromEntries(Object.entries(r ?? {}).map(([k, v]) => [k, n(v)])) as Record<string, number>;
}

/** Funil de engajamento: acessaram → (início de tarefa | 2+ telas) → (conclusão | alguma ação) → voltaram em 7 dias. */
async function engagementFunnel(s: AnalyticsScope, st: AnalyticsSettings) {
  const step2 = st.taskStartEvent ? sql`bool_or(${st.taskStartEvent} = any(p.events))` : sql`count(*) >= 2`;
  const step3 = st.taskDoneEvent ? sql`bool_or(${st.taskDoneEvent} = any(p.events))` : sql`bool_or(cardinality(p.events) > 0)`;
  const [r] = rows<Record<string, number>>(
    await db.execute(sql`
      with u as (
        select p.anon_id, ${step2} s2, ${step3} s3, min((p.created_at at time zone ${TZ})::date) d0
          from analytics_pageviews p where ${pf(s)} group by p.anon_id
      )
      select count(*)::int a, count(*) filter (where s2)::int b, count(*) filter (where s2 and s3)::int c,
             count(*) filter (where exists (
               select 1 from analytics_sessions s2x where s2x.project_id = ${s.projectId} and s2x.anon_id = u.anon_id
                  and (s2x.started_at at time zone ${TZ})::date > u.d0 and (s2x.started_at at time zone ${TZ})::date <= u.d0 + 7
             ))::int d
        from u`)
  );
  return {
    steps: [
      { label: "Acessaram o produto", n: n(r?.a) },
      { label: st.taskStartEvent ? "Iniciaram uma tarefa" : "Navegaram 2+ telas", n: n(r?.b) },
      { label: st.taskDoneEvent ? "Concluíram a tarefa" : "Realizaram uma ação", n: n(r?.c) },
      { label: "Voltaram em até 7 dias", n: n(r?.d) },
    ],
    configured: !!(st.taskStartEvent && st.taskDoneEvent),
  };
}

async function topPages(s: AnalyticsScope, limit = 10) {
  const r = rows<{ host: string; path: string; pv: number; users: number; ms: number }>(
    await db.execute(sql`
      select p.host, p.path, count(*)::int pv, count(distinct p.anon_id)::int users, coalesce(avg(p.duration_ms), 0)::int ms
        from analytics_pageviews p where ${pf(s)} group by 1, 2 order by 3 desc limit ${limit}`)
  );
  return r.map((x) => ({ host: x.host, path: x.path, pv: n(x.pv), users: n(x.users), ms: n(x.ms) }));
}

async function devices(s: AnalyticsScope) {
  const r = rows<{ device: string; users: number; sessions: number; ms: number }>(
    await db.execute(sql`
      select s.device, count(distinct s.anon_id)::int users, count(*)::int sessions, coalesce(avg(s.duration_ms), 0)::int ms
        from analytics_sessions s where ${sf(s)} group by 1 order by 2 desc`)
  );
  return r.map((x) => ({ device: x.device, users: n(x.users), sessions: n(x.sessions), ms: n(x.ms) }));
}

/** Cohorts semanais (8 semanas até o fim do período) + D1/D7/D30. */
async function retention(s: AnalyticsScope) {
  const start = new Date(s.to.getTime() - 8 * 7 * 86_400_000);
  const w = (col: SQL) => sql`date_trunc('week', ${col} at time zone ${TZ})::date`;
  const r = rows<{ cohort: string; k: number; users: number }>(
    await db.execute(sql`
      with c as (select u.anon_id, ${w(sql`u.first_seen_at`)} cw from analytics_users u where ${uf(s, start, s.to)}),
      a as (select distinct s.anon_id, ${w(sql`s.started_at`)} aw from analytics_sessions s where ${sf({ ...s, device: undefined }, start, s.to)})
      select to_char(c.cw, 'YYYY-MM-DD') cohort, ((a.aw - c.cw) / 7)::int k, count(distinct c.anon_id)::int users
        from c join a on a.anon_id = c.anon_id and a.aw >= c.cw group by 1, 2 order by 1, 2`)
  );
  const cohorts = new Map<string, number[]>();
  for (const x of r) {
    const arr = cohorts.get(x.cohort) ?? [];
    arr[n(x.k)] = n(x.users);
    cohorts.set(x.cohort, arr);
  }
  const list = [...cohorts.entries()].map(([cohort, arr]) => ({ cohort, size: arr[0] ?? 0, weeks: Array.from({ length: arr.length }, (_, i) => arr[i] ?? 0) }));

  // D1/D7/D30: dos usuários que já tinham N dias de casa, quantos voltaram depois de N dias
  const [d] = rows<Record<string, number>>(
    await db.execute(sql`
      with u as (select u.anon_id, u.first_seen_at f from analytics_users u where ${uf(s, new Date(s.to.getTime() - 90 * 86_400_000), s.to)})
      select ${sql.join(
        [1, 7, 30].map(
          (k) => sql`count(*) filter (where u.f <= ${iso(s.to)}::timestamptz - ${`${k} days`}::interval)::int ${sql.raw(`e${k}`)},
            count(*) filter (where u.f <= ${iso(s.to)}::timestamptz - ${`${k} days`}::interval and exists (
              select 1 from analytics_sessions sx where sx.project_id = ${s.projectId} and sx.anon_id = u.anon_id and sx.started_at >= u.f + ${`${k} days`}::interval
            ))::int ${sql.raw(`r${k}`)}`
        ),
        sql`, `
      )} from u`)
  );
  const rate = (k: number) => (n(d?.[`e${k}`]) ? n(d?.[`r${k}`]) / n(d?.[`e${k}`]) : null);
  return { cohorts: list, d1: rate(1), d7: rate(7), d30: rate(30) };
}

async function topEvents(s: AnalyticsScope, limit = 10) {
  const r = rows<{ e: string; total: number; users: number; sessions: number }>(
    await db.execute(sql`
      select e, count(*)::int total, count(distinct p.anon_id)::int users, count(distinct p.session_id)::int sessions
        from analytics_pageviews p, unnest(p.events) e where ${pf(s)} group by e order by users desc, total desc limit ${limit}`)
  );
  return r.map((x) => ({ name: x.e, total: n(x.total), users: n(x.users), sessions: n(x.sessions) }));
}

async function eventTrend(s: AnalyticsScope, names: string[]) {
  if (!names.length) return [];
  const r = rows<{ e: string; d: string; users: number }>(
    await db.execute(sql`
      select e, ${day(sql`p.created_at`)} d, count(distinct p.anon_id)::int users
        from analytics_pageviews p, unnest(p.events) e where ${pf(s)} and e in (${sql.join(names.map((x) => sql`${x}`), sql`, `)})
       group by 1, 2 order by 2`)
  );
  return r.map((x) => ({ name: x.e, d: x.d, users: n(x.users) }));
}

/** Novos usuários: por dia e canal, e os totais (período e anterior). */
async function newUsers(s: AnalyticsScope, p: AnalyticsScope) {
  const r = rows<{ d: string; ch: string; users: number }>(
    await db.execute(sql`select ${day(sql`u.first_seen_at`)} d, u.first_channel ch, count(*)::int users from analytics_users u where ${uf(s)} group by 1, 2 order by 1`)
  );
  const [t] = rows<{ cur: number; prev: number }>(
    await db.execute(sql`
      select count(*) filter (where u.first_seen_at >= ${iso(s.from)}::timestamptz)::int cur,
             count(*) filter (where u.first_seen_at < ${iso(s.from)}::timestamptz)::int prev
        from analytics_users u where ${uf(s, p.from, s.to)}`)
  );
  return { byDay: r.map((x) => ({ d: x.d, channel: x.ch as Channel, users: n(x.users) })), cur: n(t?.cur), prev: n(t?.prev) };
}

/** Ativação e pesquisa dos NOVOS usuários do período (por canal, entrada e campanha). */
async function newUserOutcomes(s: AnalyticsScope, st: AnalyticsSettings) {
  // ativação: o evento configurado; sem configuração, qualquer ação (evento) nos primeiros 7 dias
  const act = st.activationEvent ? sql`${st.activationEvent} = any(p.events)` : sql`cardinality(p.events) > 0`;
  const r = rows<{ ch: string; landing: string; campaign: string; users: number; activated: number; surveyed: number }>(
    await db.execute(sql`
      with nu as (select u.anon_id, u.first_seen_at f, u.first_channel ch, u.first_landing landing, u.first_campaign campaign from analytics_users u where ${uf(s)}),
      ev as (
        select p.anon_id, bool_or(${act}) act, bool_or(${SURVEY_EVENT} = any(p.events)) sv
          from analytics_pageviews p join nu on nu.anon_id = p.anon_id
         where p.project_id = ${s.projectId} and p.created_at >= nu.f and p.created_at < nu.f + interval '7 days'
         group by p.anon_id
      )
      select nu.ch, nu.landing, nu.campaign, count(*)::int users, count(*) filter (where ev.act)::int activated, count(*) filter (where ev.sv)::int surveyed
        from nu left join ev on ev.anon_id = nu.anon_id group by 1, 2, 3`)
  );
  return r.map((x) => ({ channel: x.ch as Channel, landing: x.landing, campaign: x.campaign, users: n(x.users), activated: n(x.activated), surveyed: n(x.surveyed) }));
}

async function channelSessions(s: AnalyticsScope) {
  const r = rows<{ ch: string; users: number; sessions: number; ms: number }>(
    await db.execute(sql`
      select s.channel ch, count(distinct s.anon_id)::int users, count(*)::int sessions, coalesce(avg(s.duration_ms), 0)::int ms
        from analytics_sessions s where ${sf(s)} group by 1`)
  );
  return r.map((x) => ({ channel: x.ch as Channel, users: n(x.users), sessions: n(x.sessions), ms: n(x.ms) }));
}

async function entryPages(s: AnalyticsScope) {
  const r = rows<{ path: string; sessions: number; users: number }>(
    await db.execute(sql`
      select s.landing_path path, count(*)::int sessions, count(distinct s.anon_id)::int users
        from analytics_sessions s where ${sf(s)} group by 1 order by 2 desc limit 15`)
  );
  return r.map((x) => ({ path: x.path, sessions: n(x.sessions), users: n(x.users) }));
}

async function exitPages(s: AnalyticsScope) {
  const r = rows<{ path: string; exits: number }>(
    await db.execute(sql`select s.exit_path path, count(*)::int exits from analytics_sessions s where ${sf(s)} group by 1 order by 2 desc limit 15`)
  );
  return r.map((x) => ({ path: x.path, exits: n(x.exits) }));
}

async function campaigns(s: AnalyticsScope) {
  const r = rows<{ campaign: string; ch: string; source: string; sessions: number; users: number }>(
    await db.execute(sql`
      select s.utm_campaign campaign, s.channel ch, max(s.utm_source) source, count(*)::int sessions, count(distinct s.anon_id)::int users
        from analytics_sessions s where ${sf(s)} and s.utm_campaign <> '' group by 1, 2 order by 5 desc limit 15`)
  );
  return r.map((x) => ({ campaign: x.campaign, channel: x.ch as Channel, source: x.source, sessions: n(x.sessions), users: n(x.users) }));
}

/** Recorrentes: ativos nos últimos 30 dias do período que usaram em 2+ dias. */
async function recurrent(s: AnalyticsScope, p: AnalyticsScope) {
  const q = async (to: Date) => {
    const [r] = rows<{ all: number; rec: number }>(
      await db.execute(sql`
        select count(*)::int "all", count(*) filter (where days >= 2)::int rec from (
          select s.anon_id, count(distinct (s.started_at at time zone ${TZ})::date) days
            from analytics_sessions s where ${sf(s, new Date(to.getTime() - 30 * 86_400_000), to)} group by 1) t`)
    );
    return n(r?.all) ? n(r?.rec) / n(r?.all) : null;
  };
  const [cur, prev] = await Promise.all([q(s.to), q(p.to)]);
  return { cur, prev };
}

async function frequency(s: AnalyticsScope) {
  const r = rows<{ days: number; users: number }>(
    await db.execute(sql`
      select days, count(*)::int users from (
        select s.anon_id, count(distinct (s.started_at at time zone ${TZ})::date)::int days from analytics_sessions s where ${sf(s)} group by 1
      ) t group by 1`)
  );
  const out: Record<Frequency, number> = { daily: 0, weekly: 0, monthly: 0, sporadic: 0 };
  for (const x of r) out[frequencyOf(n(x.days), spanDays(s))] += n(x.users);
  return out;
}

async function hours(s: AnalyticsScope) {
  const r = rows<{ dow: number; h: number; users: number }>(
    await db.execute(sql`
      select extract(isodow from s.started_at at time zone ${TZ})::int dow, extract(hour from s.started_at at time zone ${TZ})::int h, count(distinct s.anon_id)::int users
        from analytics_sessions s where ${sf(s)} group by 1, 2`)
  );
  return r.map((x) => ({ dow: n(x.dow), h: n(x.h), users: n(x.users) }));
}

async function techs(s: AnalyticsScope) {
  const q = async (col: "os" | "browser") =>
    rows<{ k: string; users: number }>(
      await db.execute(sql`select s.${sql.raw(col)} k, count(distinct s.anon_id)::int users from analytics_sessions s where ${sf(s)} group by 1 order by 2 desc limit 8`)
    ).map((x) => ({ name: x.k, users: n(x.users) }));
  const vw = rows<{ k: string; users: number }>(
    await db.execute(sql`
      select case when s.viewport_w < 480 then '< 480px' when s.viewport_w < 768 then '480–767px' when s.viewport_w < 1024 then '768–1023px'
                  when s.viewport_w < 1440 then '1024–1439px' else '≥ 1440px' end k, count(distinct s.anon_id)::int users
        from analytics_sessions s where ${sf(s)} and s.viewport_w > 0 group by 1 order by 2 desc`)
  ).map((x) => ({ name: x.k, users: n(x.users) }));
  const [os, browser] = await Promise.all([q("os"), q("browser")]);
  return { os, browser, viewport: vw };
}

async function deviceTrend(s: AnalyticsScope) {
  const r = rows<{ d: string; device: string; users: number }>(
    await db.execute(sql`select ${day(sql`s.started_at`)} d, s.device, count(distinct s.anon_id)::int users from analytics_sessions s where ${sf(s)} group by 1, 2 order by 1`)
  );
  return r.map((x) => ({ d: x.d, device: x.device, users: n(x.users) }));
}

/* ---- orquestração ---- */

export const DATASETS = [
  "daily",
  "totals",
  "mau",
  "configured",
  "funnel",
  "pages",
  "devices",
  "retention",
  "events",
  "eventTrend",
  "newUsers",
  "outcomes",
  "outcomesPrev",
  "channels",
  "entry",
  "exit",
  "campaigns",
  "recurrent",
  "frequency",
  "hours",
  "techs",
  "deviceTrend",
] as const;
export type Dataset = (typeof DATASETS)[number];

export interface AnalyticsData {
  daily?: Awaited<ReturnType<typeof dailySessions>>;
  totals?: Awaited<ReturnType<typeof totals>>;
  mau?: Awaited<ReturnType<typeof mauSeries>>;
  configured?: Awaited<ReturnType<typeof configured>>;
  funnel?: Awaited<ReturnType<typeof engagementFunnel>>;
  pages?: Awaited<ReturnType<typeof topPages>>;
  devices?: Awaited<ReturnType<typeof devices>>;
  retention?: Awaited<ReturnType<typeof retention>>;
  events?: Awaited<ReturnType<typeof topEvents>>;
  eventTrend?: Awaited<ReturnType<typeof eventTrend>>;
  newUsers?: Awaited<ReturnType<typeof newUsers>>;
  outcomes?: Awaited<ReturnType<typeof newUserOutcomes>>;
  outcomesPrev?: Awaited<ReturnType<typeof newUserOutcomes>>;
  channels?: Awaited<ReturnType<typeof channelSessions>>;
  entry?: Awaited<ReturnType<typeof entryPages>>;
  exit?: Awaited<ReturnType<typeof exitPages>>;
  campaigns?: Awaited<ReturnType<typeof campaigns>>;
  recurrent?: Awaited<ReturnType<typeof recurrent>>;
  frequency?: Awaited<ReturnType<typeof frequency>>;
  hours?: Awaited<ReturnType<typeof hours>>;
  techs?: Awaited<ReturnType<typeof techs>>;
  deviceTrend?: Awaited<ReturnType<typeof deviceTrend>>;
}

/** Busca só os datasets pedidos, em paralelo. */
export async function getAnalytics(s: AnalyticsScope, st: AnalyticsSettings, want: Set<Dataset>, opts: { pagesLimit?: number; eventsLimit?: number } = {}) {
  const p = prevScope(s);
  const tasks: Partial<Record<Dataset, Promise<unknown>>> = {};
  const add = <K extends Dataset>(k: K, f: () => Promise<unknown>) => {
    if (want.has(k)) tasks[k] = f();
  };
  add("daily", () => dailySessions(s, p));
  add("totals", () => totals(s, p));
  add("mau", () => mauSeries(s));
  add("configured", () => configured(s, p, st));
  add("funnel", () => engagementFunnel(s, st));
  add("pages", () => topPages(s, opts.pagesLimit ?? 10));
  add("devices", () => devices(s));
  add("retention", () => retention(s));
  add("newUsers", () => newUsers(s, p));
  add("outcomes", () => newUserOutcomes(s, st));
  add("outcomesPrev", () => newUserOutcomes(p, st));
  add("channels", () => channelSessions(s));
  add("entry", () => entryPages(s));
  add("exit", () => exitPages(s));
  add("campaigns", () => campaigns(s));
  add("recurrent", () => recurrent(s, p));
  add("frequency", () => frequency(s));
  add("hours", () => hours(s));
  add("techs", () => techs(s));
  add("deviceTrend", () => deviceTrend(s));
  // eventos + tendência dos principais (a tendência depende da lista)
  if (want.has("events") || want.has("eventTrend")) {
    tasks.events = topEvents(s, opts.eventsLimit ?? 10).then(async (ev) => {
      if (want.has("eventTrend")) out.eventTrend = await eventTrend(s, ev.slice(0, 6).map((e) => e.name));
      return ev;
    });
  }
  const out: AnalyticsData = {};
  const keys = Object.keys(tasks) as Dataset[];
  const vals = await Promise.all(keys.map((k) => tasks[k]));
  keys.forEach((k, i) => ((out as Record<string, unknown>)[k] = vals[i]));
  return out;
}

/* ---------- visões salvas ---------- */

export interface SavedView {
  id: string;
  name: string;
  goal: string;
  shared: boolean;
  mine: boolean;
  config: ViewConfig;
  updatedAt: string;
}

export async function listViews(projectId: string, userId: string): Promise<SavedView[]> {
  const r = await db
    .select()
    .from(analyticsViews)
    .where(and(eq(analyticsViews.projectId, projectId), or(eq(analyticsViews.userId, userId), eq(analyticsViews.shared, true))))
    .orderBy(desc(analyticsViews.updatedAt));
  return r.map((v) => ({
    id: v.id,
    name: v.name,
    goal: v.goal,
    shared: v.shared,
    mine: v.userId === userId,
    config: parseViewConfig(v.config),
    updatedAt: v.updatedAt.toISOString(),
  }));
}

export async function createView(projectId: string, userId: string, input: { name: string; goal: string; shared: boolean; config: ViewConfig }) {
  const id = analyticsViewId();
  await db.insert(analyticsViews).values({ id, projectId, userId, ...input });
  return id;
}

export async function updateView(projectId: string, userId: string, id: string, input: { name: string; goal: string; shared: boolean; config: ViewConfig }) {
  await db
    .update(analyticsViews)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(analyticsViews.id, id), eq(analyticsViews.projectId, projectId), eq(analyticsViews.userId, userId)));
}

export async function deleteView(projectId: string, userId: string, id: string) {
  await db.delete(analyticsViews).where(and(eq(analyticsViews.id, id), eq(analyticsViews.projectId, projectId), eq(analyticsViews.userId, userId)));
}

/* ---------- usuários ---------- */

export const USER_SEGMENTS = ["all", "identified", "anonymous", "new", "returning"] as const;
export type UserSegment = (typeof USER_SEGMENTS)[number];
export const USER_SORTS = ["recent", "sessions", "time", "pages", "days", "first", "name"] as const;
export type UserSort = (typeof USER_SORTS)[number];

export interface UserRow {
  anonId: string;
  userId: string | null;
  email: string | null;
  name: string | null;
  avatar: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  channel: Channel;
  landing: string;
  device: string;
  os: string;
  browser: string;
  sessions: number;
  pageviews: number;
  ms: number;
  days: number;
  events: number;
}

const PAGE_SIZE = 25;

/**
 * Usuários ativos no período (com sessão no recorte), com o que fizeram NELE. Busca por
 * nome, e-mail, ID do produto ou ID anônimo; segmentos e ordenação no banco; 25 por página.
 */
export async function listAnalyticsUsers(
  s: AnalyticsScope,
  opts: { q?: string; segment?: UserSegment; sort?: UserSort; dir?: "asc" | "desc"; page?: number }
): Promise<{ rows: UserRow[]; total: number; page: number; pages: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const q = (opts.q ?? "").trim().slice(0, 80).toLowerCase();
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const seg = opts.segment ?? "all";
  // coluna escolhida no sentido pedido; desempate pela atividade mais recente
  const dir = sql.raw(opts.dir === "asc" ? "asc" : "desc");
  const col = {
    recent: sql`act.last`,
    sessions: sql`act.sessions`,
    time: sql`act.ms`,
    pages: sql`act.pv`,
    days: sql`act.days`,
    first: sql`u.first_seen_at`,
    name: sql`lower(coalesce(u.user_name, u.user_email, u.user_id))`,
  }[opts.sort ?? "recent"];
  const order = sql`${col} ${dir} nulls last, act.last desc`;

  const r = rows<Record<string, unknown>>(
    await db.execute(sql`
      with act as (
        select s.anon_id, count(*)::int sessions, coalesce(sum(s.pageviews), 0)::int pv, coalesce(sum(s.duration_ms), 0)::bigint ms,
               count(distinct (s.started_at at time zone ${TZ})::date)::int days, max(s.last_seen_at) last,
               (array_agg(s.device order by s.started_at desc))[1] device, (array_agg(s.os order by s.started_at desc))[1] os,
               (array_agg(s.browser order by s.started_at desc))[1] browser
          from analytics_sessions s where ${sf(s)} group by s.anon_id
      )
      select u.anon_id, u.user_id, u.user_email, u.user_name, u.user_avatar, ${isoTs(sql`u.first_seen_at`)} first_seen, ${isoTs(sql`greatest(u.last_seen_at, act.last)`)} last_seen,
             u.first_channel, u.first_landing, act.device, act.os, act.browser, act.sessions, act.pv, act.ms, act.days,
             count(*) over ()::int total
        from act join analytics_users u on u.project_id = ${s.projectId} and u.anon_id = act.anon_id
       where true
         ${q ? sql`and (lower(coalesce(u.user_name, '')) like ${like} escape '\\' or lower(coalesce(u.user_email, '')) like ${like} escape '\\'
                    or lower(coalesce(u.user_id, '')) like ${like} escape '\\' or lower(u.anon_id) like ${like} escape '\\')` : sql``}
         ${seg === "identified" ? sql`and u.user_id is not null` : seg === "anonymous" ? sql`and u.user_id is null` : sql``}
         ${seg === "new" ? sql`and u.first_seen_at >= ${iso(s.from)}::timestamptz` : seg === "returning" ? sql`and u.first_seen_at < ${iso(s.from)}::timestamptz` : sql``}
       order by ${order}
       limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`)
  );

  // eventos no período só para as linhas desta página (barato)
  const ids = r.map((x) => String(x.anon_id));
  const ev = ids.length
    ? rows<{ anon_id: string; n: number }>(
        await db.execute(sql`
          select p.anon_id, coalesce(sum(cardinality(p.events)), 0)::int n from analytics_pageviews p
           where ${pf(s)} and p.anon_id in (${sql.join(ids.map((x) => sql`${x}`), sql`, `)}) group by 1`)
      )
    : [];
  const evBy = new Map(ev.map((x) => [x.anon_id, n(x.n)]));
  const total = n(r[0]?.total);
  return {
    rows: r.map((x) => ({
      anonId: String(x.anon_id),
      userId: (x.user_id as string) ?? null,
      email: (x.user_email as string) ?? null,
      name: (x.user_name as string) ?? null,
      avatar: (x.user_avatar as string) ?? null,
      firstSeenAt: String(x.first_seen),
      lastSeenAt: String(x.last_seen),
      channel: x.first_channel as Channel,
      landing: String(x.first_landing ?? ""),
      device: String(x.device ?? "desktop"),
      os: String(x.os ?? ""),
      browser: String(x.browser ?? ""),
      sessions: n(x.sessions),
      pageviews: n(x.pv),
      ms: n(x.ms),
      days: n(x.days),
      events: evBy.get(String(x.anon_id)) ?? 0,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Perfil de um usuário: quem é, linha do tempo de sessões, telas, ações e respostas de pesquisa. */
export async function getAnalyticsUserProfile(projectId: string, anonId: string) {
  const [u] = await db
    .select()
    .from(analyticsUsers)
    .where(and(eq(analyticsUsers.projectId, projectId), eq(analyticsUsers.anonId, anonId)))
    .limit(1);
  if (!u) return null;

  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [sessions, pages, events, totals, activity, surveys] = await Promise.all([
    db.execute(sql`
      select s.id, ${isoTs(sql`s.started_at`)} started, ${isoTs(sql`s.last_seen_at`)} last, s.device, s.os, s.browser, s.channel, s.referrer, s.utm_campaign,
             s.landing_path, s.exit_path, s.pageviews, s.duration_ms, s.host
        from analytics_sessions s where s.project_id = ${projectId} and s.anon_id = ${anonId}
       order by s.started_at desc limit 20`),
    db.execute(sql`
      select p.session_id, p.path, ${isoTs(sql`p.created_at`)} at, p.duration_ms, p.events
        from analytics_pageviews p where p.project_id = ${projectId} and p.anon_id = ${anonId}
       order by p.created_at desc limit 300`),
    db.execute(sql`
      select e, count(*)::int n from analytics_pageviews p, unnest(p.events) e
       where p.project_id = ${projectId} and p.anon_id = ${anonId} group by 1 order by 2 desc limit 12`),
    db.execute(sql`
      select count(*)::int sessions, coalesce(sum(pageviews), 0)::int pv, coalesce(sum(duration_ms), 0)::bigint ms,
             count(distinct (started_at at time zone ${TZ})::date)::int days
        from analytics_sessions where project_id = ${projectId} and anon_id = ${anonId}`),
    db.execute(sql`
      select ${day(sql`started_at`)} d, count(*)::int sessions, coalesce(sum(duration_ms), 0)::bigint ms
        from analytics_sessions where project_id = ${projectId} and anon_id = ${anonId} and started_at >= ${since}::timestamptz
       group by 1 order by 1`),
    // respostas de pesquisa da mesma pessoa (pelo ID do Luumu.identify)
    u.userId
      ? db.execute(sql`
          select r.id, r.score, r.sentiment, ${isoTs(sql`r.created_at`)} at, sv.name survey, sv.id survey_id
            from responses r join surveys sv on sv.id = r.survey_id
           where sv.project_id = ${projectId} and r.respondent = ${u.userId}
           order by r.created_at desc limit 10`)
      : Promise.resolve({ rows: [] }),
  ]);

  const pv = rows<{ session_id: string; path: string; at: string; duration_ms: number; events: string[] }>(pages);
  const bySession = new Map<string, { path: string; at: string; ms: number; events: string[] }[]>();
  for (const p of pv) {
    const list = bySession.get(p.session_id) ?? [];
    list.push({ path: p.path, at: p.at, ms: n(p.duration_ms), events: p.events ?? [] });
    bySession.set(p.session_id, list);
  }
  const t = rows<Record<string, number>>(totals)[0] ?? {};
  const pageCount = new Map<string, number>();
  for (const p of pv) pageCount.set(p.path, (pageCount.get(p.path) ?? 0) + 1);

  return {
    anonId: u.anonId,
    userId: u.userId,
    email: u.userEmail,
    name: u.userName,
    avatar: u.userAvatar,
    firstSeenAt: u.firstSeenAt.toISOString(),
    lastSeenAt: u.lastSeenAt.toISOString(),
    channel: u.firstChannel as Channel,
    source: u.firstSource,
    campaign: u.firstCampaign,
    landing: u.firstLanding,
    totals: { sessions: n(t.sessions), pageviews: n(t.pv), ms: n(t.ms), days: n(t.days) },
    activity: rows<{ d: string; sessions: number; ms: number }>(activity).map((a) => ({ d: a.d, sessions: n(a.sessions), ms: n(a.ms) })),
    sessions: rows<Record<string, unknown>>(sessions).map((x) => ({
      id: String(x.id),
      startedAt: String(x.started),
      lastSeenAt: String(x.last),
      device: String(x.device),
      os: String(x.os),
      browser: String(x.browser),
      channel: x.channel as Channel,
      referrer: String(x.referrer ?? ""),
      campaign: String(x.utm_campaign ?? ""),
      host: String(x.host ?? ""),
      pageviews: n(x.pageviews),
      ms: n(x.duration_ms),
      pages: (bySession.get(String(x.id)) ?? []).slice().reverse(),
    })),
    topEvents: rows<{ e: string; n: number }>(events).map((x) => ({ name: x.e, n: n(x.n) })),
    topPages: [...pageCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([path, c]) => ({ path, n: c })),
    responses: rows<{ id: string; score: number | null; sentiment: string | null; at: string; survey: string; survey_id: string }>(surveys).map((x) => ({
      id: x.id,
      score: x.score === null ? null : Number(x.score),
      sentiment: x.sentiment,
      at: x.at,
      survey: x.survey,
      surveyId: x.survey_id,
    })),
  };
}

export type AnalyticsUserProfile = NonNullable<Awaited<ReturnType<typeof getAnalyticsUserProfile>>>;
