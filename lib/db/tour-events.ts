import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { tours, tourEvents } from "@/db/schema";
import { tourEventId } from "./ids";
import { TOUR_EVENT_TYPES, type TourEventInput, type TourEventType } from "@/lib/tours/types";
import { normalizeRoute } from "@/lib/tours/normalize";

/*
  Eventos de execução dos tours e as métricas derivadas deles. Sem banco analítico: o volume
  é de eventos de tour (alguns por sessão que vê um tour), não de cliques, e as métricas são
  agregações simples por tour. Ver docs/tours/ARQUITETURA.md.
*/

const MAX_PER_BATCH = 50;
const short = (v: unknown, n: number) => (typeof v === "string" && v ? v.slice(0, n) : null);

function cleanMeta(v: unknown): Record<string, string | number | boolean | null> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 10)) {
    if (!/^[a-zA-Z0-9_]{1,40}$/.test(k)) continue;
    if (typeof val === "string") out[k] = val.slice(0, 200);
    else if (typeof val === "number" && Number.isFinite(val)) out[k] = val;
    else if (typeof val === "boolean" || val === null) out[k] = val;
  }
  return out;
}

/**
 * Grava um lote de eventos vindo do SDK. Só aceita tours do próprio projeto (a key decide o
 * projeto; um tourId de outro tenant é descartado em silêncio). Devolve quantos entraram.
 */
export async function recordTourEvents(
  workspaceId: string,
  projectId: string,
  host: string,
  raw: unknown[]
): Promise<number> {
  const events = raw.slice(0, MAX_PER_BATCH).filter((e): e is TourEventInput => {
    const o = e as TourEventInput;
    return !!o && typeof o.tourId === "string" && (TOUR_EVENT_TYPES as readonly string[]).includes(o.type);
  });
  if (!events.length) return 0;

  const ids = Array.from(new Set(events.map((e) => e.tourId))).slice(0, 10);
  const owned = new Set(
    (
      await db
        .select({ id: tours.id })
        .from(tours)
        .where(and(eq(tours.projectId, projectId), inArray(tours.id, ids)))
    ).map((t) => t.id)
  );
  const now = Date.now();
  const rows = events
    .filter((e) => owned.has(e.tourId))
    .map((e) => {
      // relógio do navegador só é aceito se plausível (até 1 dia atrás, sem futuro)
      const ts = typeof e.ts === "number" && e.ts <= now + 60_000 && e.ts > now - 86_400_000 ? e.ts : now;
      return {
        id: tourEventId(),
        workspaceId,
        projectId,
        tourId: e.tourId,
        versionId: short(e.versionId, 40),
        stepKey: short(e.stepKey, 40),
        type: e.type,
        userId: short(e.userId, 200),
        anonymousId: short(e.anonymousId, 64),
        sessionId: short(e.sessionId, 64),
        route: normalizeRoute(e.route),
        host: host || null,
        meta: cleanMeta(e.meta),
        createdAt: new Date(ts),
      };
    });
  if (!rows.length) return 0;
  await db.insert(tourEvents).values(rows);
  return rows.length;
}

export interface StepFunnelRow {
  stepKey: string;
  viewed: number;
  completed: number;
  skipped: number;
  notFound: number;
  abandonedHere: number;
  avgMs: number | null;
}

export interface TourAnalytics {
  started: number;
  completed: number;
  dismissed: number;
  completionRate: number; // 0–100
  abandonRate: number; // 0–100
  avgCompletionSec: number | null;
  notFound: number;
  errors: number;
  steps: StepFunnelRow[];
  daily: { date: string; started: number; completed: number }[];
}

/**
 * Métricas de um tour no período. Tudo contado por SESSÃO (a mesma pessoa vendo o passo duas
 * vezes na mesma sessão conta uma). O tour precisa pertencer ao projeto.
 */
export async function getTourAnalytics(tourId: string, projectId: string, days = 30): Promise<TourAnalytics | null> {
  const [owned] = await db
    .select({ id: tours.id })
    .from(tours)
    .where(and(eq(tours.id, tourId), eq(tours.projectId, projectId)))
    .limit(1);
  if (!owned) return null;

  const since = new Date(Date.now() - days * 86_400_000);
  const scope = and(eq(tourEvents.tourId, tourId), gte(tourEvents.createdAt, since));
  const session = sql`coalesce(${tourEvents.sessionId}, ${tourEvents.id})`;

  const [totals, perStep, abandoned, durations, daily] = await Promise.all([
    db
      .select({ type: tourEvents.type, n: sql<number>`count(distinct ${session})::int` })
      .from(tourEvents)
      .where(scope)
      .groupBy(tourEvents.type),
    db
      .select({
        stepKey: tourEvents.stepKey,
        type: tourEvents.type,
        n: sql<number>`count(distinct ${session})::int`,
        avgMs: sql<number | null>`avg(nullif((${tourEvents.meta}->>'durationMs'), '')::float)`,
      })
      .from(tourEvents)
      .where(and(scope, sql`${tourEvents.stepKey} is not null`))
      .groupBy(tourEvents.stepKey, tourEvents.type),
    // último passo visto por cada sessão que iniciou e não concluiu = onde abandonou
    db.execute<{ step_key: string; n: number }>(sql`
      select step_key, count(*)::int as n from (
        select distinct on (session_id) session_id, step_key
          from ${tourEvents}
         where tour_id = ${tourId} and created_at >= ${since} and type = 'tour_step_viewed' and session_id is not null
           and session_id not in (
             select session_id from ${tourEvents}
              where tour_id = ${tourId} and type = 'tour_completed' and session_id is not null
           )
         order by session_id, created_at desc
      ) last group by step_key
    `),
    db.execute<{ avg_sec: number | null }>(sql`
      select avg(extract(epoch from (c.at - s.at)))::float as avg_sec from
        (select session_id, min(created_at) at from ${tourEvents}
          where tour_id = ${tourId} and created_at >= ${since} and type = 'tour_started' group by session_id) s
        join
        (select session_id, max(created_at) at from ${tourEvents}
          where tour_id = ${tourId} and created_at >= ${since} and type = 'tour_completed' group by session_id) c
        using (session_id)
       where c.at >= s.at
    `),
    db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${tourEvents.createdAt}), 'YYYY-MM-DD')`,
        type: tourEvents.type,
        n: sql<number>`count(distinct ${session})::int`,
      })
      .from(tourEvents)
      .where(and(scope, inArray(tourEvents.type, ["tour_started", "tour_completed"])))
      .groupBy(sql`1`, tourEvents.type),
  ]);

  const total = (t: TourEventType) => Number(totals.find((r) => r.type === t)?.n ?? 0);
  const started = total("tour_started");
  const completed = total("tour_completed");
  const abandonedRows = (abandoned.rows ?? []) as { step_key: string; n: number }[];

  const keys = Array.from(new Set(perStep.map((r) => r.stepKey).filter((k): k is string => !!k)));
  const steps: StepFunnelRow[] = keys.map((k) => {
    const of = (t: TourEventType) => perStep.find((r) => r.stepKey === k && r.type === t);
    return {
      stepKey: k,
      viewed: Number(of("tour_step_viewed")?.n ?? 0),
      completed: Number(of("tour_step_completed")?.n ?? 0),
      skipped: Number(of("tour_step_skipped")?.n ?? 0),
      notFound: Number(of("tour_target_not_found")?.n ?? 0),
      abandonedHere: Number(abandonedRows.find((a) => a.step_key === k)?.n ?? 0),
      avgMs: of("tour_step_completed")?.avgMs != null ? Number(of("tour_step_completed")!.avgMs) : null,
    };
  });

  const byDay = new Map<string, { started: number; completed: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    byDay.set(d, { started: 0, completed: 0 });
  }
  for (const r of daily) {
    const cur = byDay.get(r.date);
    if (!cur) continue;
    if (r.type === "tour_started") cur.started = Number(r.n);
    else cur.completed = Number(r.n);
  }

  const avgSec = ((durations.rows ?? [])[0] as { avg_sec: number | null } | undefined)?.avg_sec;
  return {
    started,
    completed,
    dismissed: total("tour_dismissed"),
    completionRate: started ? Math.round((completed / started) * 1000) / 10 : 0,
    abandonRate: started ? Math.round(((started - Math.min(completed, started)) / started) * 1000) / 10 : 0,
    avgCompletionSec: avgSec != null ? Math.round(Number(avgSec)) : null,
    notFound: total("tour_target_not_found"),
    errors: total("tour_error"),
    steps,
    daily: Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v })),
  };
}
