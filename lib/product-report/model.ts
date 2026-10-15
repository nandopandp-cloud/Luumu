/**
 * Monta o Report Quinzenal (o que a tela, o HTML e o PDF mostram) a partir do que está salvo:
 * sincronizações com a Luumu, valores informados à mão, metas e observações. Puro e serializável.
 *
 * Origem de cada número, nesta ordem:
 *   1. a última sincronização da quinzena com a Luumu (dado real);
 *   2. um valor informado (planilha histórica ou digitado), só quando a Luumu não tem o dado.
 * Sem nenhum dos dois o indicador fica vazio e vira alerta: nada é estimado ou preenchido.
 */
import {
  computeNorthStar,
  goalStatus,
  indicatorLabel,
  METRIC_META,
  METRICS,
  NORTH_STAR,
  PLATFORM_INDICATORS,
  PLATFORMS,
  platformLabel,
  unitOf,
  type GoalKey,
  type GoalStatus,
  type NorthStarComponent,
  type PlatformIndicatorKey,
  type PlatformKey,
  type PlatformValues,
  type Targets,
  type Weights,
} from "./indicators";
import {
  isClosed,
  periodCode,
  periodDates,
  periodDatesShort,
  periodLabel,
  periodRange,
  periodShortLabel,
  periodsUntil,
  periodTick,
  periodTitle,
  shiftPeriod,
  yearPeriodsUntil,
  type PeriodId,
} from "./period";

export type ManualSource = "manual" | "planilha";

export interface ManualValue {
  value: number;
  source: ManualSource;
}

/** Linha de product_report_periods. */
export interface StoredPeriod {
  period: PeriodId;
  goals: Targets;
  manual: Partial<Record<PlatformIndicatorKey, ManualValue>>;
  /** mensagem de abertura do report (ex.: "Fala pessoal, boa tarde. Segue o report…") */
  intro: string;
  notes: string;
  updatedAt: string | null;
}

export interface CollectedValue {
  value: number | null;
  /** ex.: nome da pesquisa CSAT usada, nº de respostas */
  detail?: string;
  warnings?: string[];
}

/** Dados de uma sincronização (product_report_runs.kind = "sync"). */
export interface SyncSnapshot {
  createdAt: string;
  status: "ok" | "partial" | "error";
  error: string | null;
  values: Partial<Record<PlatformIndicatorKey, CollectedValue>>;
  projects: Partial<Record<PlatformKey, { id: string; name: string } | null>>;
}

export interface ResolvedValue {
  value: number | null;
  source: string | null;
  updatedAt: string | null;
  detail?: string;
  warnings: string[];
}

export interface IndicatorRow {
  key: GoalKey;
  label: string;
  unit: "%" | "min" | "pts";
  value: number | null;
  target: number | null;
  /** quinzena de onde a meta foi herdada (null = definida nesta) */
  targetFrom: PeriodId | null;
  nextTarget: number | null;
  nextTargetFrom: PeriodId | null;
  prev: number | null;
  delta: number | null;
  status: GoalStatus;
  source: string | null;
  updatedAt: string | null;
  detail?: string;
  warnings: string[];
}

export interface HistoryPoint {
  period: PeriodId;
  label: string;
  /** "16/Jun": eixo X dos gráficos */
  tick: string;
  values: Partial<Record<GoalKey, number | null>>;
  targets: Partial<Record<GoalKey, number | null>>;
}

export interface Alert {
  tone: "info" | "warn" | "error";
  text: string;
}

export interface ReportModel {
  period: PeriodId;
  label: string;
  /** "Q2/09" */
  code: string;
  /** "Q2 Setembro" */
  title: string;
  dates: string;
  /** "16/09 a 30/09" */
  datesShort: string;
  closed: boolean;
  builtAt: string;
  sync: { at: string | null; status: SyncSnapshot["status"] | null; error: string | null };
  weights: Weights;
  northStar: IndicatorRow;
  components: (NorthStarComponent & { row: IndicatorRow })[];
  groups: { key: "produto" | PlatformKey; title: string; rows: IndicatorRow[] }[];
  history: HistoryPoint[];
  /** média da North Star nas quinzenas do ano até esta (as que têm valor) */
  yearAverage: number | null;
  alerts: Alert[];
  intro: string;
  notes: string;
  /** última edição de metas/textos da quinzena */
  editedAt: string | null;
  /** quem assina a mensagem de abertura (preenchido por quem carrega o modelo) */
  author: { name: string; avatarUrl: string | null } | null;
  manual: StoredPeriod["manual"];
  projects: SyncSnapshot["projects"];
}

const SOURCE_LABEL: Record<ManualSource, string> = { manual: "Informado manualmente", planilha: "Planilha North Star (histórico)" };

/** Valores das plataformas numa quinzena, com a origem de cada um. */
export function resolveValues(sync: SyncSnapshot | undefined, stored: StoredPeriod | undefined): Record<PlatformIndicatorKey, ResolvedValue> {
  const out = {} as Record<PlatformIndicatorKey, ResolvedValue>;
  for (const { key, metric } of PLATFORM_INDICATORS) {
    const c = sync?.status !== "error" ? sync?.values[key] : undefined;
    const m = stored?.manual[key];
    if (c && typeof c.value === "number") {
      out[key] = { value: c.value, source: METRIC_META[metric].source, updatedAt: sync!.createdAt, detail: c.detail, warnings: c.warnings ?? [] };
    } else if (m) {
      // o aviso da coleta explica por que a Luumu não tinha o dado; o valor informado o substitui
      out[key] = { value: m.value, source: SOURCE_LABEL[m.source], updatedAt: stored!.updatedAt, warnings: [] };
    } else {
      out[key] = { value: null, source: null, updatedAt: sync?.createdAt ?? null, warnings: c?.warnings ?? [] };
    }
  }
  return out;
}

/**
 * Meta vigente numa quinzena: a definida nela ou, se não houver, a última definida antes
 * (a planilha mantém a meta até alguém mudá-la).
 */
export function goalFor(key: GoalKey, period: PeriodId, byPeriod: Map<PeriodId, StoredPeriod>): { value: number | null; from: PeriodId | null } {
  const own = byPeriod.get(period)?.goals[key];
  if (typeof own === "number") return { value: own, from: null };
  const earlier = [...byPeriod.keys()].filter((p) => p < period).sort().reverse();
  for (const p of earlier) {
    const v = byPeriod.get(p)!.goals[key];
    if (typeof v === "number") return { value: v, from: p };
  }
  return { value: null, from: null };
}

function pointFor(period: PeriodId, sync: SyncSnapshot | undefined, byPeriod: Map<PeriodId, StoredPeriod>, weights: Weights) {
  const resolved = resolveValues(sync, byPeriod.get(period));
  const platformValues: PlatformValues = Object.fromEntries(Object.entries(resolved).map(([k, v]) => [k, v.value]));
  const targets: Targets = {};
  for (const k of [NORTH_STAR, ...METRICS.map((m) => `ns.${m}` as const), ...PLATFORM_INDICATORS.map((i) => i.key)] as GoalKey[]) {
    targets[k] = goalFor(k, period, byPeriod).value;
  }
  const ns = computeNorthStar(platformValues, targets, weights);
  const values: HistoryPoint["values"] = { ...platformValues, [NORTH_STAR]: ns.value };
  for (const c of ns.components) values[`ns.${c.metric}`] = c.value;
  return { resolved, ns, values, targets };
}

export function buildReportModel(input: {
  period: PeriodId;
  stored: StoredPeriod[];
  /** última sincronização (não-erro, se houver) de cada quinzena */
  syncs: Partial<Record<PeriodId, SyncSnapshot>>;
  /** última tentativa de sincronização da quinzena do relatório, mesmo com erro */
  lastAttempt?: SyncSnapshot;
  weights: Weights;
  now?: Date;
  historySize?: number;
  author?: ReportModel["author"];
}): ReportModel {
  const { period, weights } = input;
  const now = input.now ?? new Date();
  const byPeriod = new Map(input.stored.map((s) => [s.period, s]));
  const sync = input.syncs[period];
  const prevPeriod = shiftPeriod(period, -1);
  const nextPeriod = shiftPeriod(period, 1);

  const cur = pointFor(period, sync, byPeriod, weights);
  const prev = pointFor(prevPeriod, input.syncs[prevPeriod], byPeriod, weights);

  const row = (key: GoalKey, value: number | null, extra: Partial<IndicatorRow> = {}): IndicatorRow => {
    const t = goalFor(key, period, byPeriod);
    const n = goalFor(key, nextPeriod, byPeriod);
    const p = prev.values[key] ?? null;
    return {
      key,
      label: indicatorLabel(key),
      unit: unitOf(key),
      value,
      target: t.value,
      targetFrom: t.from,
      nextTarget: n.value,
      nextTargetFrom: n.from,
      prev: p,
      delta: value !== null && p !== null ? value - p : null,
      status: goalStatus(value, t.value),
      source: null,
      updatedAt: null,
      warnings: [],
      ...extra,
    };
  };

  const platformRow = (key: PlatformIndicatorKey) => {
    const r = cur.resolved[key];
    return row(key, r.value, { source: r.source, updatedAt: r.updatedAt, detail: r.detail, warnings: r.warnings });
  };

  const derivedSource = "Calculado: fórmula da planilha North Star";
  const components = cur.ns.components.map((c) => ({
    ...c,
    row: row(`ns.${c.metric}`, c.value, { label: `${METRIC_META[c.metric].label} (média das plataformas)`, source: derivedSource, updatedAt: sync?.createdAt ?? null }),
  }));
  const northStar = row(NORTH_STAR, cur.ns.value, { source: derivedSource, updatedAt: sync?.createdAt ?? null });

  const groups: ReportModel["groups"] = [
    { key: "produto", title: "Gestão de Produto", rows: [northStar, ...components.map((c) => c.row)] },
    ...PLATFORMS.map((p) => ({
      key: p.key,
      title: p.label,
      rows: PLATFORM_INDICATORS.filter((i) => i.platform === p.key).map((i) => platformRow(i.key)),
    })),
  ];

  const history: HistoryPoint[] = periodsUntil(period, input.historySize ?? 8).map((p) => {
    const pt = p === period ? cur : p === prevPeriod ? prev : pointFor(p, input.syncs[p], byPeriod, weights);
    return { period: p, label: periodShortLabel(p), tick: periodTick(p), values: pt.values, targets: pt.targets };
  });

  // média anual (aba "Meta Geral" da planilha): quinzenas do ano com North Star calculável
  const yearValues = yearPeriodsUntil(period)
    .map((p) => (p === period ? cur.ns.value : pointFor(p, input.syncs[p], byPeriod, weights).ns.value))
    .filter((v): v is number => v !== null);
  const yearAverage = yearValues.length ? yearValues.reduce((a, v) => a + v, 0) / yearValues.length : null;

  return {
    period,
    label: periodLabel(period),
    code: periodCode(period),
    title: periodTitle(period),
    dates: periodDates(period),
    datesShort: periodDatesShort(period),
    closed: isClosed(period, now),
    builtAt: now.toISOString(),
    sync: { at: sync?.createdAt ?? null, status: sync?.status ?? null, error: sync?.error ?? null },
    weights,
    northStar,
    components,
    groups,
    history,
    yearAverage,
    alerts: buildAlerts({ period, now, sync, lastAttempt: input.lastAttempt, resolved: cur.resolved, components }),
    intro: byPeriod.get(period)?.intro ?? "",
    notes: byPeriod.get(period)?.notes ?? "",
    editedAt: byPeriod.get(period)?.updatedAt ?? null,
    author: input.author ?? null,
    manual: byPeriod.get(period)?.manual ?? {},
    projects: sync?.projects ?? {},
  };
}

const fmtTs = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function buildAlerts(a: {
  period: PeriodId;
  now: Date;
  sync: SyncSnapshot | undefined;
  lastAttempt: SyncSnapshot | undefined;
  resolved: Record<PlatformIndicatorKey, ResolvedValue>;
  components: (NorthStarComponent & { row: IndicatorRow })[];
}): Alert[] {
  const out: Alert[] = [];
  const end = periodRange(a.period).to;
  const closed = end.getTime() <= a.now.getTime();

  if (!closed) out.push({ tone: "info", text: "Quinzena em andamento: os resultados ainda são parciais." });

  if (a.lastAttempt?.status === "error" && (!a.sync || a.lastAttempt.createdAt > a.sync.createdAt)) {
    out.push({ tone: "error", text: `A última atualização falhou (${fmtTs(a.lastAttempt.createdAt)}): ${a.lastAttempt.error ?? "erro desconhecido"}. Tente de novo.` });
  }

  if (!a.sync) {
    // quinzena histórica toda coberta pela planilha/valores informados: só registra a origem
    const allInformed = PLATFORM_INDICATORS.every(({ key }) => a.resolved[key].value !== null);
    out.push(
      allInformed
        ? { tone: "info", text: "Todos os números desta quinzena vêm de valores informados (planilha ou manual), não da Luumu." }
        : { tone: "warn", text: "Os indicadores desta quinzena ainda não foram buscados na Luumu. Use \"Atualizar indicadores\"." }
    );
  } else if (closed && new Date(a.sync.createdAt) < end) {
    out.push({ tone: "warn", text: `A última atualização (${fmtTs(a.sync.createdAt)}) foi antes do fim da quinzena. Atualize para fechar os números.` });
  } else if (!closed && a.now.getTime() - new Date(a.sync.createdAt).getTime() > 24 * 3_600_000) {
    out.push({ tone: "warn", text: `Dados desatualizados: última atualização em ${fmtTs(a.sync.createdAt)}.` });
  }

  for (const p of PLATFORMS) {
    if (a.sync && a.sync.projects[p.key] === null) out.push({ tone: "warn", text: `${p.label}: nenhum projeto da Luumu vinculado. Configure em "Fontes de dados".` });
  }

  for (const { key, platform, metric } of PLATFORM_INDICATORS) {
    const r = a.resolved[key];
    const name = `${platformLabel(platform)} · ${METRIC_META[metric].label}`;
    for (const w of r.warnings) out.push({ tone: "warn", text: `${name}: ${w}` });
    if (r.value === null && a.sync) out.push({ tone: "warn", text: `${name}: sem dado nesta quinzena.` });
  }

  for (const c of a.components) {
    if (c.value !== null && c.target === null) out.push({ tone: "warn", text: `${METRIC_META[c.metric].label}: sem meta definida, a North Star não pode ser calculada.` });
  }
  return out;
}
