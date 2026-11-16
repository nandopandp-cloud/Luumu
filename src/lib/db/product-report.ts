import "server-only";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "./client";
import { productReportPeriods, productReportRuns, productReportSettings } from "@/lib/db/schema";
import { newId } from "./ids";
import { DEFAULT_WEIGHTS, isGoalKey, METRICS, PLATFORM_KEYS, PLATFORMS, type PlatformKey, type Weights } from "@/lib/product-report/indicators";
import { buildGlobalNorthStar, northStarTargets, type GlobalNorthStar, type PlatformNorthStarView } from "@/lib/analytics/north-star";
import { northStarKpi, type NorthStarCtx } from "@/lib/analytics/derive";
import { getAnalyticsSettings, type PeriodScope } from "./analytics";
import { getAnalyticsPanel } from "./analytics-panel";
import type { ManualValue, StoredPeriod, SyncSnapshot } from "@/lib/product-report/model";
import type { PeriodId } from "@/lib/product-report/period";

/*
  Persistência do Report Quinzenal. Tudo por workspace (o da sessão da conta autorizada);
  quem chama já passou pelo guard do módulo (lib/product-report/access.ts).
*/

export interface ProductReportSettings {
  platformProjects: Partial<Record<PlatformKey, string>>;
  weights: Weights;
  autoSync: boolean;
  updatedAt: string | null;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseSettings(row: typeof productReportSettings.$inferSelect | undefined): ProductReportSettings {
  const pp = (row?.platformProjects ?? {}) as Record<string, unknown>;
  const w = (row?.weights ?? {}) as Record<string, unknown>;
  return {
    platformProjects: Object.fromEntries(PLATFORM_KEYS.filter((k) => typeof pp[k] === "string" && pp[k]).map((k) => [k, pp[k] as string])),
    weights: Object.fromEntries(METRICS.map((m) => [m, isNum(w[m]) ? w[m] : DEFAULT_WEIGHTS[m]])) as Weights,
    autoSync: row?.autoSync ?? false,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  };
}

export async function getProductReportSettings(workspaceId: string): Promise<ProductReportSettings> {
  const [row] = await db.select().from(productReportSettings).where(eq(productReportSettings.workspaceId, workspaceId)).limit(1);
  return parseSettings(row);
}

const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Metas e pesos do card North Star do Analytics para um projeto: a plataforma é a que o Report
 * Quinzenal liga ao projeto; sem ligação, tenta pelo nome do projeto (ex.: "Exploradores"). Sem
 * plataforma, valem as metas padrão (Tempo de uso 15 min).
 */
export async function northStarContext(workspaceId: string, projectId: string, projectName = ""): Promise<NorthStarCtx> {
  let s: ProductReportSettings | null = null;
  try {
    s = await getProductReportSettings(workspaceId);
  } catch {
    // sem a tabela do report: metas padrão
  }
  const mapped = s ? PLATFORM_KEYS.find((k) => s!.platformProjects[k] === projectId) : undefined;
  const byName = PLATFORMS.find((p) => plain(projectName).includes(plain(p.label)))?.key;
  const key: PlatformKey | null = mapped ?? byName ?? null;
  return { targets: northStarTargets(key), weights: s?.weights ?? DEFAULT_WEIGHTS, platform: key ? PLATFORMS.find((p) => p.key === key)!.label : null };
}

/**
 * North Star Jovens Gênios do Analytics: a North Star de cada plataforma (mesmo cálculo do card
 * North Star, com as metas da plataforma) no período escolhido, e a média das três. O projeto de
 * cada plataforma é o ligado no Report Quinzenal ou, sem ligação, o projeto com o nome dela;
 * só entram projetos que quem vê pode acessar. Filtros de host e dispositivo não se aplicam (são
 * do projeto aberto). Os números vêm dos resultados prontos do painel; o que faltar é calculado
 * em segundo plano e a plataforma fica como "pending".
 */
export async function getGlobalNorthStar(
  workspaceId: string,
  period: Pick<PeriodScope, "period" | "from" | "to">,
  visible: { id: string; name: string }[]
): Promise<GlobalNorthStar> {
  let s: ProductReportSettings | null = null;
  try {
    s = await getProductReportSettings(workspaceId);
  } catch {
    // sem a tabela do report: só pelo nome
  }
  const weights = s?.weights ?? DEFAULT_WEIGHTS;
  const platforms = await Promise.all(
    PLATFORMS.map(async (p): Promise<PlatformNorthStarView> => {
      const mapped = s?.platformProjects[p.key];
      const project = visible.find((x) => x.id === mapped) ?? visible.find((x) => plain(x.name).includes(plain(p.label)));
      const base = { key: p.key, label: p.label, project: project?.name ?? null };
      if (!project) return { ...base, now: null, prev: null, pending: false };
      try {
        const st = await getAnalyticsSettings(project.id);
        const want = new Set(["totals", "wau", "csat"] as const);
        const { data } = await getAnalyticsPanel({ projectId: project.id, ...period }, st, want);
        if ([...want].some((k) => data[k] === undefined)) return { ...base, now: null, prev: null, pending: true };
        const r = northStarKpi(data, { targets: northStarTargets(p.key), weights, platform: p.label });
        return { ...base, now: r.now, prev: r.before.value, pending: false };
      } catch (e) {
        console.error(`[analytics] North Star global ${p.key}:`, e instanceof Error ? e.message.slice(0, 200) : e);
        return { ...base, now: null, prev: null, pending: false };
      }
    })
  );
  return buildGlobalNorthStar(platforms);
}

export async function saveProductReportSettings(
  workspaceId: string,
  userId: string,
  s: { platformProjects: Partial<Record<PlatformKey, string>>; weights: Weights; autoSync: boolean }
) {
  const values = { platformProjects: s.platformProjects, weights: s.weights, autoSync: s.autoSync, updatedBy: userId, updatedAt: new Date() };
  await db
    .insert(productReportSettings)
    .values({ workspaceId, ...values })
    .onConflictDoUpdate({ target: productReportSettings.workspaceId, set: values });
}

/** Workspaces com atualização automática ligada (cron). */
export async function listAutoSyncWorkspaces(): Promise<(ProductReportSettings & { workspaceId: string })[]> {
  const rows = await db.select().from(productReportSettings).where(eq(productReportSettings.autoSync, true));
  return rows.map((r) => ({ workspaceId: r.workspaceId, ...parseSettings(r) }));
}

/* ---------- quinzenas (metas, valores informados, observações) ---------- */

function parsePeriodRow(r: typeof productReportPeriods.$inferSelect): StoredPeriod {
  const goals = Object.fromEntries(Object.entries((r.goals ?? {}) as Record<string, unknown>).filter(([k, v]) => isGoalKey(k) && isNum(v)));
  const manual = Object.fromEntries(
    Object.entries((r.manual ?? {}) as Record<string, ManualValue>)
      .filter(([k, v]) => isGoalKey(k) && v && isNum(v.value) && (v.source === "manual" || v.source === "planilha"))
      .map(([k, v]) => [k, { value: v.value, source: v.source, ...(isNum(v.planilha) ? { planilha: v.planilha } : {}) }])
  );
  const h = (r.highlights ?? {}) as Partial<Record<"done" | "next", unknown>>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);
  const highlights = { done: list(h.done), next: list(h.next) };
  return { period: r.period, goals, manual, intro: r.intro, highlights, notes: r.notes, updatedAt: r.updatedAt.toISOString() };
}

/** Todas as quinzenas salvas (poucas: 24 por ano). As metas herdadas precisam do passado inteiro. */
export async function listStoredPeriods(workspaceId: string): Promise<StoredPeriod[]> {
  const rows = await db.select().from(productReportPeriods).where(eq(productReportPeriods.workspaceId, workspaceId));
  return rows.map(parsePeriodRow);
}

export async function saveStoredPeriod(
  workspaceId: string,
  userId: string,
  period: PeriodId,
  patch: Partial<Pick<StoredPeriod, "goals" | "manual" | "intro" | "highlights" | "notes">>
) {
  const [current] = await db
    .select()
    .from(productReportPeriods)
    .where(and(eq(productReportPeriods.workspaceId, workspaceId), eq(productReportPeriods.period, period)))
    .limit(1);
  const base = current ? parsePeriodRow(current) : { goals: {}, manual: {}, intro: "", highlights: { done: [], next: [] }, notes: "" };
  const values = {
    goals: patch.goals ?? base.goals,
    manual: patch.manual ?? base.manual,
    intro: patch.intro ?? base.intro,
    highlights: patch.highlights ?? base.highlights,
    notes: patch.notes ?? base.notes,
    updatedBy: userId,
    updatedAt: new Date(),
  };
  await db
    .insert(productReportPeriods)
    .values({ workspaceId, period, ...values })
    .onConflictDoUpdate({ target: [productReportPeriods.workspaceId, productReportPeriods.period], set: values });
}

/* ---------- execuções ---------- */

export type RunKind = "sync" | "report";

export async function insertRun(input: {
  workspaceId: string;
  period: PeriodId;
  kind: RunKind;
  status: SyncSnapshot["status"];
  trigger: "manual" | "cron";
  data: unknown;
  error?: string | null;
  createdBy?: string | null;
}) {
  const id = newId("prr");
  const createdAt = new Date();
  await db.insert(productReportRuns).values({
    id,
    workspaceId: input.workspaceId,
    period: input.period,
    kind: input.kind,
    status: input.status,
    trigger: input.trigger,
    data: input.data,
    error: input.error ?? null,
    createdBy: input.createdBy ?? null,
    createdAt,
  });
  return { id, createdAt };
}

function toSnapshot(r: { data: unknown; status: string; error: string | null; createdAt: Date }): SyncSnapshot {
  const d = (r.data ?? {}) as Partial<SyncSnapshot>;
  return {
    createdAt: r.createdAt.toISOString(),
    status: r.status as SyncSnapshot["status"],
    error: r.error,
    values: d.values ?? {},
    projects: d.projects ?? {},
    formulas: d.formulas,
  };
}

/**
 * Última sincronização útil (ok/parcial) de cada quinzena pedida, e a última tentativa de
 * `attemptOf` (inclusive com erro, para o alerta de falha). Duas consultas, qualquer janela.
 */
export async function latestSyncs(workspaceId: string, periods: PeriodId[], attemptOf?: PeriodId) {
  const where = and(eq(productReportRuns.workspaceId, workspaceId), eq(productReportRuns.kind, "sync"), inArray(productReportRuns.period, periods));
  const [good, attempt] = await Promise.all([
    periods.length
      ? db
          .selectDistinctOn([productReportRuns.period], { period: productReportRuns.period, data: productReportRuns.data, status: productReportRuns.status, error: productReportRuns.error, createdAt: productReportRuns.createdAt })
          .from(productReportRuns)
          .where(and(where, ne(productReportRuns.status, "error")))
          .orderBy(productReportRuns.period, desc(productReportRuns.createdAt))
      : Promise.resolve([]),
    attemptOf
      ? db
          .select({ data: productReportRuns.data, status: productReportRuns.status, error: productReportRuns.error, createdAt: productReportRuns.createdAt })
          .from(productReportRuns)
          .where(and(eq(productReportRuns.workspaceId, workspaceId), eq(productReportRuns.kind, "sync"), eq(productReportRuns.period, attemptOf)))
          .orderBy(desc(productReportRuns.createdAt))
          .limit(1)
      : Promise.resolve([]),
  ]);
  const syncs: Partial<Record<PeriodId, SyncSnapshot>> = Object.fromEntries(good.map((r) => [r.period, toSnapshot(r)]));
  return { syncs, lastAttempt: attempt[0] ? toSnapshot(attempt[0]) : undefined };
}

/** Situação da sincronização de uma quinzena para o cron: houve sucesso depois de `after`? quantas falhas? */
export async function syncStatusSince(workspaceId: string, period: PeriodId, after: Date) {
  const [r] = await db
    .select({
      ok: sql<number>`count(*) filter (where ${productReportRuns.status} <> 'error' and ${productReportRuns.createdAt} >= ${after.toISOString()}::timestamptz)::int`,
      failures: sql<number>`count(*) filter (where ${productReportRuns.status} = 'error' and ${productReportRuns.trigger} = 'cron')::int`,
    })
    .from(productReportRuns)
    .where(and(eq(productReportRuns.workspaceId, workspaceId), eq(productReportRuns.kind, "sync"), eq(productReportRuns.period, period)));
  return { done: Number(r?.ok ?? 0) > 0, cronFailures: Number(r?.failures ?? 0) };
}

export interface ReportListItem {
  id: string;
  period: PeriodId;
  createdAt: string;
  trigger: string;
}

/** Relatórios gerados (sem o conteúdo, que pode ser grande), do mais novo ao mais antigo. */
export async function listGeneratedReports(workspaceId: string, limit = 30): Promise<ReportListItem[]> {
  const rows = await db
    .select({ id: productReportRuns.id, period: productReportRuns.period, createdAt: productReportRuns.createdAt, trigger: productReportRuns.trigger })
    .from(productReportRuns)
    .where(and(eq(productReportRuns.workspaceId, workspaceId), eq(productReportRuns.kind, "report")))
    .orderBy(desc(productReportRuns.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** Um relatório gerado (com o conteúdo congelado). O workspace no filtro impede ler o de outro. */
export async function getGeneratedReport(workspaceId: string, id: string) {
  const [r] = await db
    .select()
    .from(productReportRuns)
    .where(and(eq(productReportRuns.workspaceId, workspaceId), eq(productReportRuns.id, id), eq(productReportRuns.kind, "report")))
    .limit(1);
  return r ?? null;
}
