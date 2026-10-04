import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import { and, count, countDistinct, desc, eq, gte, lt, lte, sql, type SQL } from "drizzle-orm";
import { db } from "./client";
import { heatmapPageviews, heatmapSettings, heatmapSnapshots, workspaces } from "@/db/schema";
import { heatmapPageviewId, heatmapSnapshotId } from "./ids";
import { monthStart, planAllowsHeatmaps, planOf } from "@/lib/plans";
import { clickPathKey, SNAPSHOT_TTL_DAYS, type HeatmapDevice, type PageviewPayload } from "@/lib/heatmaps/core";

/*
  Heatmaps no banco. A coleta grava UMA linha por visita a uma página; o painel agrega no
  próprio Postgres (jsonb_array_elements / jsonb_each), devolvendo só as contagens — nunca as
  linhas cruas, que seriam pesadas demais para trafegar.
*/

/* ---------- liga/desliga por projeto ---------- */

const enabledCache = new Map<string, { v: boolean; exp: number }>();

/** Coleta ativa? Cache de 60s por instância: é consultado em todo GET /config. */
export async function isHeatmapsEnabled(projectId: string): Promise<boolean> {
  const hit = enabledCache.get(projectId);
  if (hit && hit.exp > Date.now()) return hit.v;
  const [row] = await db.select({ enabled: heatmapSettings.enabled }).from(heatmapSettings).where(eq(heatmapSettings.projectId, projectId)).limit(1);
  const v = !!row?.enabled;
  enabledCache.set(projectId, { v, exp: Date.now() + 60_000 });
  return v;
}

export async function setHeatmapsEnabled(projectId: string, enabled: boolean, userId: string) {
  await db
    .insert(heatmapSettings)
    .values({ projectId, enabled, updatedBy: userId })
    .onConflictDoUpdate({ target: heatmapSettings.projectId, set: { enabled, updatedBy: userId, updatedAt: new Date() } });
  enabledCache.delete(projectId);
}

/* ---------- cota do plano (sessões analisadas no mês) ---------- */

const quotaCache = new Map<string, { used: number; limit: number; allowed: boolean; exp: number }>();

/** Sessões analisadas no mês vs. o plano. Cache de 5 min por instância (uma contagem, não uma por visita). */
export async function heatmapQuota(workspaceId: string, fresh = false) {
  const hit = quotaCache.get(workspaceId);
  if (!fresh && hit && hit.exp > Date.now()) return hit;
  const [[ws], [{ n } = { n: 0 }]] = await Promise.all([
    db.select({ plan: workspaces.plan }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
    db
      .select({ n: countDistinct(heatmapPageviews.sessionId) })
      .from(heatmapPageviews)
      .where(and(eq(heatmapPageviews.workspaceId, workspaceId), gte(heatmapPageviews.createdAt, monthStart()))),
  ]);
  const plan = planOf(ws?.plan);
  // plano sem heatmaps (Free) = limite zero: nada é gravado
  const v = { used: Number(n) || 0, limit: planAllowsHeatmaps(plan) ? plan.limits.sessions : 0, allowed: planAllowsHeatmaps(plan), exp: Date.now() + 5 * 60_000 };
  quotaCache.set(workspaceId, v);
  return v;
}

/* ---------- ingestão ---------- */

export async function recordPageview(workspaceId: string, projectId: string, host: string, p: PageviewPayload) {
  await db.insert(heatmapPageviews).values({
    id: heatmapPageviewId(),
    workspaceId,
    projectId,
    host,
    path: p.path,
    device: p.device,
    sessionId: p.sid,
    viewportW: p.vw,
    viewportH: p.vh,
    docH: p.dh,
    durationMs: p.dur,
    maxScroll: p.sd,
    maxMove: p.md,
    clicks: p.c.map(([s, x, y]) => ({ s, x, y })),
    moves: p.m,
    hovers: p.h,
    labels: p.l,
    clickPath: clickPathKey(p.p),
  });
}

const snapshotFreshSince = () => new Date(Date.now() - SNAPSHOT_TTL_DAYS * 86_400_000);

/** Já existe cópia recente desta página neste dispositivo? (o SDK pergunta antes de enviar) */
export async function hasFreshSnapshot(projectId: string, host: string, path: string, device: HeatmapDevice) {
  const [row] = await db
    .select({ id: heatmapSnapshots.id })
    .from(heatmapSnapshots)
    .where(
      and(
        eq(heatmapSnapshots.projectId, projectId),
        eq(heatmapSnapshots.host, host),
        eq(heatmapSnapshots.path, path),
        eq(heatmapSnapshots.device, device),
        gte(heatmapSnapshots.createdAt, snapshotFreshSince())
      )
    )
    .limit(1);
  return !!row;
}

export async function saveSnapshot(input: {
  projectId: string;
  host: string;
  path: string;
  device: HeatmapDevice;
  width: number;
  height: number;
  viewportH: number;
  html: string;
}) {
  const packed = gzipSync(Buffer.from(input.html, "utf8"), { level: 9 }).toString("base64");
  const values = {
    width: input.width,
    height: input.height,
    viewportH: input.viewportH,
    html: packed,
    bytes: Buffer.byteLength(input.html, "utf8"),
    createdAt: new Date(),
  };
  await db
    .insert(heatmapSnapshots)
    .values({ id: heatmapSnapshotId(), projectId: input.projectId, host: input.host, path: input.path, device: input.device, ...values })
    .onConflictDoUpdate({ target: [heatmapSnapshots.projectId, heatmapSnapshots.host, heatmapSnapshots.path, heatmapSnapshots.device], set: values });
}

/* ---------- leitura (painel) ---------- */

export interface HeatmapScope {
  projectId: string;
  host: string;
  path: string;
  device?: HeatmapDevice;
  from?: Date;
  to?: Date;
}

function where(s: HeatmapScope, opts: { device?: boolean } = {}): SQL | undefined {
  return and(
    eq(heatmapPageviews.projectId, s.projectId),
    eq(heatmapPageviews.host, s.host),
    eq(heatmapPageviews.path, s.path),
    opts.device !== false && s.device ? eq(heatmapPageviews.device, s.device) : undefined,
    s.from ? gte(heatmapPageviews.createdAt, s.from) : undefined,
    s.to ? lte(heatmapPageviews.createdAt, s.to) : undefined
  );
}

/** Páginas com visitas no período (para o seletor), das mais visitadas às menos. */
export async function listHeatmapPages(projectId: string, from?: Date, to?: Date) {
  const rows = await db
    .select({ host: heatmapPageviews.host, path: heatmapPageviews.path, n: count() })
    .from(heatmapPageviews)
    .where(
      and(
        eq(heatmapPageviews.projectId, projectId),
        from ? gte(heatmapPageviews.createdAt, from) : undefined,
        to ? lte(heatmapPageviews.createdAt, to) : undefined
      )
    )
    .groupBy(heatmapPageviews.host, heatmapPageviews.path)
    .orderBy(desc(count()))
    .limit(150);
  return rows.map((r) => ({ host: r.host, path: r.path, n: Number(r.n) }));
}

/** Existe alguma visita coletada neste projeto (em qualquer período)? */
export async function hasAnyPageview(projectId: string) {
  const [row] = await db.select({ id: heatmapPageviews.id }).from(heatmapPageviews).where(eq(heatmapPageviews.projectId, projectId)).limit(1);
  return !!row;
}

/** Dispositivos que têm cópia desta página. */
export async function snapshotDevices(projectId: string, host: string, path: string): Promise<HeatmapDevice[]> {
  const rows = await db
    .select({ device: heatmapSnapshots.device })
    .from(heatmapSnapshots)
    .where(and(eq(heatmapSnapshots.projectId, projectId), eq(heatmapSnapshots.host, host), eq(heatmapSnapshots.path, path)));
  return rows.map((r) => r.device as HeatmapDevice);
}

/** Cópia da página para o dispositivo pedido (ou a mais recente de qualquer dispositivo). */
export async function getSnapshot(projectId: string, host: string, path: string, device?: HeatmapDevice) {
  const rows = await db
    .select()
    .from(heatmapSnapshots)
    .where(and(eq(heatmapSnapshots.projectId, projectId), eq(heatmapSnapshots.host, host), eq(heatmapSnapshots.path, path)))
    .orderBy(desc(heatmapSnapshots.createdAt));
  const pick = rows.find((r) => r.device === (device ?? "desktop")) ?? rows.find((r) => r.device === "desktop") ?? rows[0];
  if (!pick) return null;
  let html = "";
  try {
    html = gunzipSync(Buffer.from(pick.html, "base64")).toString("utf8");
  } catch {
    return null;
  }
  return { html, device: pick.device as HeatmapDevice, width: pick.width, height: pick.height, viewportH: pick.viewportH, capturedAt: pick.createdAt.toISOString() };
}

const num = (v: unknown) => Number(v) || 0;
const ratio = (r?: { n: number; sessions: number }) => (r && num(r.sessions) ? num(r.n) / num(r.sessions) : 0);

/**
 * Tudo que o painel precisa de uma página num período, agregado no banco. As consultas rodam
 * em paralelo; o período anterior (mesma duração, logo antes) alimenta as comparações.
 */
export async function getHeatmapReport(s: HeatmapScope) {
  const pv = heatmapPageviews;
  const span = s.from ? (s.to ?? new Date()).getTime() - s.from.getTime() : 0;
  const prev: HeatmapScope | null = s.from ? { ...s, from: new Date(s.from.getTime() - span), to: new Date(s.from.getTime() - 1) } : null;
  const W = where(s);
  // páginas por sessão: o projeto todo (uma sessão passa por várias páginas)
  const perSession = (from?: Date, to?: Date) =>
    db
      .select({ n: count(), sessions: countDistinct(pv.sessionId) })
      .from(pv)
      .where(and(eq(pv.projectId, s.projectId), from ? gte(pv.createdAt, from) : undefined, to ? lt(pv.createdAt, to) : undefined));

  const [
    clickBins,
    elements,
    labels,
    moveBins,
    hovers,
    paths,
    scrollHist,
    moveHist,
    devices,
    totals,
    daily,
    prevTotals,
    sessionsProject,
    prevElements,
  ] = await Promise.all([
    // cliques por elemento e célula (20×20 dentro do elemento)
    db.execute(sql`
      select c->>'s' as s, ((c->>'x')::int / 50) as bx, ((c->>'y')::int / 50) as by, count(*)::int as n
        from ${pv}, jsonb_array_elements(${pv.clicks}) c
       where ${W}
       group by 1, 2, 3 order by 4 desc limit 4000`),
    // total por elemento (+ visitas distintas)
    db.execute(sql`
      select c->>'s' as s, count(*)::int as n, count(distinct ${pv.id})::int as v
        from ${pv}, jsonb_array_elements(${pv.clicks}) c
       where ${W}
       group by 1 order by 2 desc limit 60`),
    db.execute(sql`
      select l.key as s, max(l.value) as label
        from ${pv}, jsonb_each_text(${pv.labels}) l
       where ${W}
       group by 1 limit 1500`),
    db.execute(sql`
      select m.key as k, sum(m.value::int)::int as n
        from ${pv}, jsonb_each_text(${pv.moves}) m
       where ${W}
       group by 1 order by 2 desc limit 4000`),
    db.execute(sql`
      select h.key as s, sum(h.value::int)::bigint as ms, count(*)::int as v
        from ${pv}, jsonb_each_text(${pv.hovers}) h
       where ${W}
       group by 1 order by 3 desc, 2 desc limit 30`),
    db
      .select({ path: pv.clickPath, n: count() })
      .from(pv)
      .where(and(W, sql`${pv.clickPath} is not null`))
      .groupBy(pv.clickPath)
      .orderBy(desc(count()))
      .limit(8),
    db.select({ depth: pv.maxScroll, n: count() }).from(pv).where(W).groupBy(pv.maxScroll),
    db.select({ depth: pv.maxMove, n: count() }).from(pv).where(W).groupBy(pv.maxMove),
    // dispositivos: ignora o filtro de dispositivo (é a divisão do total)
    db.select({ device: pv.device, n: count() }).from(pv).where(where(s, { device: false })).groupBy(pv.device),
    db
      .select({
        n: count(),
        sessions: countDistinct(pv.sessionId),
        avgMs: sql<number>`coalesce(avg(${pv.durationMs}), 0)`,
        avgVh: sql<number>`coalesce(avg(nullif(${pv.viewportH}, 0)), 0)`,
        avgDh: sql<number>`coalesce(avg(nullif(${pv.docH}, 0)), 0)`,
        scroll75: sql<number>`coalesce(avg(case when ${pv.maxScroll} >= 75 then 1 else 0 end), 0)`,
      })
      .from(pv)
      .where(W),
    db.execute(sql`
      select to_char(date_trunc('day', ${pv.createdAt} at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as date,
             avg(${pv.durationMs})::int as ms, count(*)::int as n
        from ${pv}
       where ${W}
       group by 1 order by 1`),
    prev
      ? db
          .select({
            n: count(),
            avgMs: sql<number>`coalesce(avg(${pv.durationMs}), 0)`,
            scroll75: sql<number>`coalesce(avg(case when ${pv.maxScroll} >= 75 then 1 else 0 end), 0)`,
          })
          .from(pv)
          .where(where(prev))
      : Promise.resolve([]),
    Promise.all([perSession(s.from, s.to ? new Date(s.to.getTime() + 1) : undefined), prev ? perSession(prev.from, s.from) : Promise.resolve([])]),
    prev
      ? db.execute(sql`
          select c->>'s' as s, count(*)::int as n
            from ${pv}, jsonb_array_elements(${pv.clicks}) c
           where ${where(prev)}
           group by 1 order by 2 desc limit 60`)
      : Promise.resolve({ rows: [] }),
  ]);

  const rows = <T,>(r: unknown) => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];
  const t = totals[0];
  const pt = (prevTotals as { n: number; avgMs: number; scroll75: number }[])[0];
  const labelBy = new Map(rows<{ s: string; label: string }>(labels).map((r) => [r.s, r.label]));
  const totalClicks = rows<{ n: number }>(elements).reduce((a, r) => a + num(r.n), 0);
  const prevClickRows = rows<{ s: string; n: number }>(prevElements);
  const prevTotalClicks = prevClickRows.reduce((a, r) => a + num(r.n), 0);
  const prevShare = new Map(prevClickRows.map((r) => [r.s, prevTotalClicks ? num(r.n) / prevTotalClicks : 0]));

  return {
    pageviews: num(t?.n),
    sessions: num(t?.sessions),
    avgDurationMs: num(t?.avgMs),
    avgViewportH: num(t?.avgVh),
    avgDocH: num(t?.avgDh),
    scroll75: num(t?.scroll75),
    prev: pt && num(pt.n) > 0 ? { pageviews: num(pt.n), avgDurationMs: num(pt.avgMs), scroll75: num(pt.scroll75) } : null,
    pagesPerSession: {
      cur: ratio(sessionsProject[0][0]),
      prev: ratio((sessionsProject[1] as { n: number; sessions: number }[])[0]) || null,
    },
    clickBins: rows<{ s: string; bx: number; by: number; n: number }>(clickBins).map((r) => ({ s: r.s, x: num(r.bx), y: num(r.by), n: num(r.n) })),
    totalClicks,
    elements: rows<{ s: string; n: number; v: number }>(elements).map((r) => ({
      s: r.s,
      label: labelBy.get(r.s) ?? "",
      clicks: num(r.n),
      visits: num(r.v),
      share: totalClicks ? num(r.n) / totalClicks : 0,
      prevShare: prev ? (prevShare.get(r.s) ?? 0) : null,
    })),
    moveBins: rows<{ k: string; n: number }>(moveBins).map((r) => {
      const [gy, gx, ...rest] = r.k.split("|").reverse();
      return { s: rest.reverse().join("|"), gx: num(gx), gy: num(gy), n: num(r.n) };
    }),
    hovers: rows<{ s: string; ms: number; v: number }>(hovers).map((r) => ({ s: r.s, label: labelBy.get(r.s) ?? "", ms: num(r.ms), visits: num(r.v) })),
    paths: paths.map((p) => ({ key: p.path as string, n: num(p.n) })),
    labels: Object.fromEntries(labelBy),
    scrollHist: scrollHist.map((r) => ({ depth: num(r.depth), n: num(r.n) })),
    moveHist: moveHist.map((r) => ({ depth: num(r.depth), n: num(r.n) })),
    devices: devices.map((d) => ({ device: d.device as HeatmapDevice, n: num(d.n) })),
    daily: rows<{ date: string; ms: number; n: number }>(daily).map((d) => ({ date: d.date, ms: num(d.ms), n: num(d.n) })),
  };
}

export type HeatmapReport = Awaited<ReturnType<typeof getHeatmapReport>>;
