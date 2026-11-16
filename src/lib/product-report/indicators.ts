/**
 * Catálogo de indicadores do Report Quinzenal e a fórmula da North Star, exatamente como na
 * planilha "North Star" do time de Produto:
 *
 *   - por plataforma: CSAT (%), Aderência (%) e Tempo de uso (min).
 *   - consolidado de cada componente = média simples das plataformas que o medem: as 3. O CSAT da
 *     GenieX entra a partir de GENIEX_CSAT_FROM; antes disso, o CSAT consolidado era a média de
 *     Educadores e Exploradores (o histórico continua assim).
 *   - normalizado = consolidado ÷ meta; resultado = normalizado × peso (pesos 30/40/30).
 *   - North Star = soma dos 3 resultados. Sem teto: passar da meta num componente compensa
 *     outro (a planilha não limita, ex.: aderência 57,6% com meta 50% vale 46,05 de 40).
 *
 * A partir de PLATFORM_NORTH_STAR_FROM a regra é outra, a mesma do Analytics (bloco "North Star
 * Jovens Gênios"): a North Star de CADA plataforma = soma de (realizado ÷ meta da plataforma ×
 * peso), com as metas de NORTH_STAR_TARGETS (Tempo de uso 8 min no Exploradores); a North Star
 * do report = média simples das 3. As quinzenas anteriores continuam como na planilha.
 *
 * Puro (sem banco): usado pela tela, pela exportação e pelos testes.
 */

import type { PeriodId } from "./period";

export const METRICS = ["csat", "adherence", "usage"] as const;
export type Metric = (typeof METRICS)[number];

export const METRIC_META: Record<Metric, { label: string; unit: "%" | "min"; source: string }> = {
  csat: { label: "CSAT", unit: "%", source: "Luumu · média das 2 últimas pesquisas CSAT da quinzena (% top-box, igual ao painel)" },
  adherence: { label: "Aderência", unit: "%", source: "Luumu · Analytics (WAU médio ÷ MAU)" },
  usage: { label: "Tempo de uso", unit: "min", source: "Luumu · Analytics (tempo médio por sessão)" },
};

/**
 * Regra de cálculo da Aderência gravada em cada atualização. Atualizações sem ela (ou com outra)
 * foram feitas com a regra antiga (DAU médio ÷ MAU) e a Aderência delas não é usada.
 */
export const ADHERENCE_FORMULA = "wau_mau" as const;

export const PLATFORMS = [
  { key: "geniex", label: "GenieX", metrics: ["csat", "adherence", "usage"] },
  { key: "exploradores", label: "Exploradores", metrics: ["csat", "adherence", "usage"] },
  { key: "educadores", label: "Educadores", metrics: ["csat", "adherence", "usage"] },
] as const satisfies readonly { key: string; label: string; metrics: readonly Metric[] }[];

export type PlatformKey = (typeof PLATFORMS)[number]["key"];
export const PLATFORM_KEYS = PLATFORMS.map((p) => p.key) as PlatformKey[];

export type PlatformIndicatorKey = `${PlatformKey}.${Metric}`;
export type ComponentKey = `ns.${Metric}`;
export const NORTH_STAR = "northstar" as const;
/** Tudo que pode ter meta. */
export type GoalKey = PlatformIndicatorKey | ComponentKey | typeof NORTH_STAR;

/** Indicadores medidos por plataforma (a ordem é a das tabelas). */
export const PLATFORM_INDICATORS: { key: PlatformIndicatorKey; platform: PlatformKey; metric: Metric }[] = PLATFORMS.flatMap((p) =>
  METRICS.filter((m) => (p.metrics as readonly Metric[]).includes(m)).map((metric) => ({
    key: `${p.key}.${metric}` as PlatformIndicatorKey,
    platform: p.key,
    metric,
  }))
);

export const GOAL_KEYS: GoalKey[] = [NORTH_STAR, ...METRICS.map((m) => `ns.${m}` as ComponentKey), ...PLATFORM_INDICATORS.map((i) => i.key)];

/**
 * Quinzena em que o CSAT da GenieX passou a entrar no report (Q2 de outubro/2026, a primeira sem
 * versão final quando a mudança foi feita). Antes dela a GenieX não tem linha de CSAT e o CSAT
 * consolidado é (Educadores + Exploradores) ÷ 2, como na planilha; a partir dela,
 * (Educadores + Exploradores + GenieX) ÷ 3.
 */
export const GENIEX_CSAT_FROM: PeriodId = "2026-10-2";

const MEASURED_FROM: Partial<Record<PlatformIndicatorKey, PeriodId>> = { "geniex.csat": GENIEX_CSAT_FROM };

/** O indicador existe no report desta quinzena? (sem quinzena: todos) */
export const measuredIn = (key: PlatformIndicatorKey, period?: PeriodId) => !period || !MEASURED_FROM[key] || period >= MEASURED_FROM[key]!;

/** Indicadores das plataformas numa quinzena, na ordem das tabelas. */
export const platformIndicatorsFor = (period?: PeriodId) => PLATFORM_INDICATORS.filter((i) => measuredIn(i.key, period));

export const isGoalKey = (k: string): k is GoalKey => (GOAL_KEYS as string[]).includes(k);
export const isPlatformIndicatorKey = (k: string): k is PlatformIndicatorKey => PLATFORM_INDICATORS.some((i) => i.key === k);

export const platformLabel = (k: PlatformKey) => PLATFORMS.find((p) => p.key === k)!.label;

/** Plataformas que entram no consolidado de um componente (na quinzena, se informada). */
export const platformsFor = (m: Metric, period?: PeriodId): PlatformKey[] =>
  PLATFORMS.filter((p) => (p.metrics as readonly Metric[]).includes(m) && measuredIn(`${p.key}.${m}`, period)).map((p) => p.key);

export type Weights = Record<Metric, number>;
/** Pesos da planilha (somam 100: North Star "na meta" = 100). */
export const DEFAULT_WEIGHTS: Weights = { csat: 30, adherence: 40, usage: 30 };

/* ---------- North Star por plataforma (Analytics e report desde PLATFORM_NORTH_STAR_FROM) ---------- */

export type NorthStarTargets = Record<Metric, number>;
/** Metas da North Star de cada plataforma: CSAT 90% e Aderência (WAU/MAU) 50% em todas; Tempo de uso 15 min. */
export const NORTH_STAR_TARGETS: NorthStarTargets = { csat: 90, adherence: 50, usage: 15 };
/** Metas de tempo de uso (min) que mudam por plataforma. */
export const USAGE_TARGET_BY_PLATFORM: Partial<Record<PlatformKey, number>> = { exploradores: 8 };

export function northStarTargets(platform: PlatformKey | null): NorthStarTargets {
  const usage = (platform && USAGE_TARGET_BY_PLATFORM[platform]) ?? NORTH_STAR_TARGETS.usage;
  return { ...NORTH_STAR_TARGETS, usage };
}

/** Primeira quinzena em que a North Star do report é a média das North Stars das plataformas. */
export const PLATFORM_NORTH_STAR_FROM: PeriodId = "2026-11-1";
export const northStarByPlatform = (period?: PeriodId) => !!period && period >= PLATFORM_NORTH_STAR_FROM;

/** CSAT e Aderência em %, Tempo de uso em minutos. */
export type NorthStarInputs = Record<Metric, number | null>;

export interface PlatformNorthStar {
  /** pontos (100 = na meta); null se faltar alguma das três métricas */
  value: number | null;
  components: { metric: Metric; value: number | null; target: number; weight: number; result: number | null }[];
  missing: Metric[];
}

export function platformNorthStar(v: NorthStarInputs, targets: NorthStarTargets, weights: Weights = DEFAULT_WEIGHTS): PlatformNorthStar {
  const components = METRICS.map((metric) => {
    const value = v[metric];
    const target = targets[metric];
    return { metric, value, target, weight: weights[metric], result: num(value) && target > 0 ? (value / target) * weights[metric] : null };
  });
  const missing = components.filter((c) => c.result === null).map((c) => c.metric);
  return { value: missing.length ? null : components.reduce((a, c) => a + (c.result as number), 0), components, missing };
}

/** Média simples, só com todas presentes: média parcial mudaria o significado do número. */
export function averageNorthStar(values: (number | null)[]): number | null {
  if (!values.length || !values.every(num)) return null;
  return (values as number[]).reduce((a, x) => a + x, 0) / values.length;
}

/** Explicação da North Star da quinzena (rodapé do HTML/PDF). */
export function northStarRuleText(period: PeriodId, w: Weights): string {
  return northStarByPlatform(period)
    ? `NorthStar = média da NorthStar de GenieX, Exploradores e Educadores; cada uma = soma de (realizado ÷ meta × peso) de CSAT (meta ${NORTH_STAR_TARGETS.csat}%, peso ${w.csat}), Aderência (meta ${NORTH_STAR_TARGETS.adherence}%, peso ${w.adherence}) e Tempo de uso (meta ${NORTH_STAR_TARGETS.usage} min, ${USAGE_TARGET_BY_PLATFORM.exploradores} min no Exploradores; peso ${w.usage}).`
    : `NorthStar = soma de (realizado ÷ meta × peso) de CSAT (${w.csat}), Aderência (${w.adherence}) e Tempo de uso (${w.usage}), com a média das plataformas.`;
}

export type PlatformValues = Partial<Record<PlatformIndicatorKey, number | null>>;
export type Targets = Partial<Record<GoalKey, number | null>>;

export interface NorthStarComponent {
  metric: Metric;
  weight: number;
  target: number | null;
  /** consolidado (média das plataformas); null se alguma plataforma estiver sem dado */
  value: number | null;
  normalized: number | null;
  result: number | null;
  platforms: { platform: PlatformKey; value: number | null }[];
  missing: PlatformKey[];
}

export interface NorthStarResult {
  value: number | null;
  components: NorthStarComponent[];
  /** regra da quinzena: média das plataformas por componente (planilha) ou média das North Stars das plataformas */
  rule: "consolidated" | "platforms";
  /** North Star de cada plataforma (só na regra "platforms") */
  platforms: { platform: PlatformKey; value: number | null; missing: Metric[] }[];
}

function num(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Média só com todas as plataformas presentes: média parcial mudaria o significado do número
 * (ex.: CSAT só de Exploradores) sem ninguém perceber. Faltando uma, o consolidado fica vazio.
 */
export function consolidate(
  values: PlatformValues,
  metric: Metric,
  period?: PeriodId
): { value: number | null; missing: PlatformKey[]; platforms: NorthStarComponent["platforms"] } {
  const platforms = platformsFor(metric, period).map((platform) => ({ platform, value: values[`${platform}.${metric}`] ?? null }));
  const missing = platforms.filter((p) => !num(p.value)).map((p) => p.platform);
  const value = missing.length ? null : platforms.reduce((a, p) => a + (p.value as number), 0) / platforms.length;
  return { value, missing, platforms };
}

/** Ajustes manuais acima das plataformas: o consolidado de um componente ou a própria North Star. */
export type NorthStarOverrides = Partial<Record<ComponentKey | typeof NORTH_STAR, number>>;

export function computeNorthStar(
  values: PlatformValues,
  targets: Targets,
  weights: Weights = DEFAULT_WEIGHTS,
  overrides: NorthStarOverrides = {},
  /** quinzena: decide quais plataformas entram em cada consolidado (ver GENIEX_CSAT_FROM) */
  period?: PeriodId
): NorthStarResult {
  const components = METRICS.map((metric): NorthStarComponent => {
    const c = consolidate(values, metric, period);
    // consolidado ajustado à mão substitui a média (e entra na North Star como tal)
    const value = num(overrides[`ns.${metric}`]) ? (overrides[`ns.${metric}`] as number) : c.value;
    const target = targets[`ns.${metric}`] ?? null;
    const normalized = num(value) && num(target) && target > 0 ? value / target : null;
    return {
      metric,
      weight: weights[metric],
      target,
      value,
      normalized,
      result: normalized === null ? null : normalized * weights[metric],
      platforms: c.platforms,
      missing: c.missing,
    };
  });
  if (northStarByPlatform(period)) {
    // mesma conta do Analytics: North Star de cada plataforma com as metas dela, depois a média
    const platforms = PLATFORMS.map((p) => {
      const r = platformNorthStar(Object.fromEntries(METRICS.map((m) => [m, values[`${p.key}.${m}`] ?? null])) as NorthStarInputs, northStarTargets(p.key), weights);
      return { platform: p.key as PlatformKey, value: r.value, missing: r.missing };
    });
    const computed = averageNorthStar(platforms.map((p) => p.value));
    return { value: num(overrides[NORTH_STAR]) ? (overrides[NORTH_STAR] as number) : computed, components, rule: "platforms", platforms };
  }
  const computed = components.every((c) => c.result !== null) ? components.reduce((a, c) => a + (c.result as number), 0) : null;
  const value = num(overrides[NORTH_STAR]) ? (overrides[NORTH_STAR] as number) : computed;
  return { value, components, rule: "consolidated", platforms: [] };
}

export type GoalStatus = "met" | "missed" | "no_target" | "no_data";

/** Todos os indicadores do report são "quanto maior, melhor". */
export function goalStatus(value: number | null, target: number | null): GoalStatus {
  if (!num(value)) return "no_data";
  if (!num(target)) return "no_target";
  return value >= target ? "met" : "missed";
}

/* ---------- formatação (pt-BR) ---------- */

const dec = (v: number, digits: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** A North Star é exibida em % (100% = todos os componentes exatamente na meta), como no report. */
export function unitOf(key: GoalKey): "%" | "min" | "pts" {
  if (key === NORTH_STAR) return "%";
  return METRIC_META[key.split(".")[1] as Metric].unit;
}

/** "64,0%", "13,3 min", "98,8" */
export function formatValue(v: number | null | undefined, unit: "%" | "min" | "pts"): string {
  if (!num(v)) return "—";
  if (unit === "%") return `${dec(v, 1)}%`;
  if (unit === "min") return `${dec(v, 1)} min`;
  return dec(v, 1);
}

/** Forma curta do report: "50%", "43,7%", "22 min", "98,8%" (sem ",0" à toa). */
export function formatCompact(v: number | null | undefined, unit: "%" | "min" | "pts"): string {
  if (!num(v)) return "—";
  const s = v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return unit === "min" ? `${s} min` : unit === "%" ? `${s}%` : s;
}

/** Variação absoluta com sinal: "+3,2 p.p.", "−1,0 min", "+4,1 pts" */
export function formatDelta(d: number | null | undefined, unit: "%" | "min" | "pts"): string {
  if (!num(d)) return "—";
  const sign = d > 0 ? "+" : d < 0 ? "−" : "";
  const u = unit === "%" ? " p.p." : unit === "min" ? " min" : " pts";
  return `${sign}${dec(Math.abs(d), 1)}${u}`;
}

export function indicatorLabel(key: GoalKey): string {
  if (key === NORTH_STAR) return "North Star";
  const [scope, metric] = key.split(".") as [string, Metric];
  const m = METRIC_META[metric].label;
  return scope === "ns" ? `${m} (consolidado)` : `${m} · ${platformLabel(scope as PlatformKey)}`;
}
