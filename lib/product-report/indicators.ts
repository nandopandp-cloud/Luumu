/**
 * Catálogo de indicadores do Report Quinzenal e a fórmula da North Star, exatamente como na
 * planilha "North Star" do time de Produto:
 *
 *   - por plataforma: CSAT (%), Aderência (%) e Tempo de uso (min). GenieX não tem CSAT.
 *   - consolidado de cada componente = média simples das plataformas que o medem
 *     (Aderência e Tempo: as 3; CSAT: Educadores e Exploradores).
 *   - normalizado = consolidado ÷ meta; resultado = normalizado × peso (pesos 30/40/30).
 *   - North Star = soma dos 3 resultados. Sem teto: passar da meta num componente compensa
 *     outro (a planilha não limita, ex.: aderência 57,6% com meta 50% vale 46,05 de 40).
 *
 * Puro (sem banco): usado pela tela, pela exportação e pelos testes.
 */

export const METRICS = ["csat", "adherence", "usage"] as const;
export type Metric = (typeof METRICS)[number];

export const METRIC_META: Record<Metric, { label: string; unit: "%" | "min"; source: string }> = {
  csat: { label: "CSAT", unit: "%", source: "Luumu · pesquisas CSAT do projeto (% top-box, igual ao painel)" },
  adherence: { label: "Aderência", unit: "%", source: "Luumu · Analytics (DAU médio ÷ MAU)" },
  usage: { label: "Tempo de uso", unit: "min", source: "Luumu · Analytics (tempo médio por sessão)" },
};

export const PLATFORMS = [
  { key: "geniex", label: "GenieX", metrics: ["adherence", "usage"] },
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

export const isGoalKey = (k: string): k is GoalKey => (GOAL_KEYS as string[]).includes(k);
export const isPlatformIndicatorKey = (k: string): k is PlatformIndicatorKey => PLATFORM_INDICATORS.some((i) => i.key === k);

export const platformLabel = (k: PlatformKey) => PLATFORMS.find((p) => p.key === k)!.label;

/** Plataformas que entram no consolidado de um componente. */
export const platformsFor = (m: Metric): PlatformKey[] =>
  PLATFORMS.filter((p) => (p.metrics as readonly Metric[]).includes(m)).map((p) => p.key);

export type Weights = Record<Metric, number>;
/** Pesos da planilha (somam 100: North Star "na meta" = 100). */
export const DEFAULT_WEIGHTS: Weights = { csat: 30, adherence: 40, usage: 30 };

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
}

const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Média só com todas as plataformas presentes: média parcial mudaria o significado do número
 * (ex.: CSAT só de Exploradores) sem ninguém perceber. Faltando uma, o consolidado fica vazio.
 */
export function consolidate(values: PlatformValues, metric: Metric): { value: number | null; missing: PlatformKey[]; platforms: NorthStarComponent["platforms"] } {
  const platforms = platformsFor(metric).map((platform) => ({ platform, value: values[`${platform}.${metric}`] ?? null }));
  const missing = platforms.filter((p) => !num(p.value)).map((p) => p.platform);
  const value = missing.length ? null : platforms.reduce((a, p) => a + (p.value as number), 0) / platforms.length;
  return { value, missing, platforms };
}

export function computeNorthStar(values: PlatformValues, targets: Targets, weights: Weights = DEFAULT_WEIGHTS): NorthStarResult {
  const components = METRICS.map((metric): NorthStarComponent => {
    const c = consolidate(values, metric);
    const target = targets[`ns.${metric}`] ?? null;
    const normalized = num(c.value) && num(target) && target > 0 ? c.value / target : null;
    return {
      metric,
      weight: weights[metric],
      target,
      value: c.value,
      normalized,
      result: normalized === null ? null : normalized * weights[metric],
      platforms: c.platforms,
      missing: c.missing,
    };
  });
  const value = components.every((c) => c.result !== null) ? components.reduce((a, c) => a + (c.result as number), 0) : null;
  return { value, components };
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
