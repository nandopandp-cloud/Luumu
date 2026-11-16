/**
 * North Star de UMA plataforma no Analytics: média ponderada de CSAT, Aderência e Tempo de uso,
 * cada um normalizado pela meta (valor ÷ meta), com a mesma fórmula do Report Quinzenal
 * (lib/product-report/indicators.ts → pesos 30/40/30, sem teto):
 *
 *   North Star = (CSAT ÷ meta) × 30 + (Aderência ÷ meta) × 40 + (Tempo de uso ÷ meta) × 30
 *
 * 100 = as três métricas exatamente na meta. Normalizar pela meta tira a unidade de cada uma
 * (% e minutos), por isso dá para somar. Metas: CSAT 90% e Aderência (WAU/MAU) 50% em todas as
 * plataformas; Tempo de uso 15 min, exceto Exploradores (8 min).
 *
 * Puro: usado pelos cards, pela exportação e pelos testes.
 */
import { DEFAULT_WEIGHTS, METRICS, type Metric, type PlatformKey, type Weights } from "@/lib/product-report/indicators";

export type NorthStarTargets = Record<Metric, number>;

export const NORTH_STAR_TARGETS: NorthStarTargets = { csat: 90, adherence: 50, usage: 15 };
/** Metas de tempo de uso (min) que mudam por plataforma. */
export const USAGE_TARGET_BY_PLATFORM: Partial<Record<PlatformKey, number>> = { exploradores: 8 };

export function northStarTargets(platform: PlatformKey | null): NorthStarTargets {
  const usage = (platform && USAGE_TARGET_BY_PLATFORM[platform]) ?? NORTH_STAR_TARGETS.usage;
  return { ...NORTH_STAR_TARGETS, usage };
}

/** CSAT e Aderência em %, Tempo de uso em minutos. */
export type NorthStarInputs = Record<Metric, number | null>;

export interface PlatformNorthStar {
  /** pontos (100 = na meta); null se faltar alguma das três métricas */
  value: number | null;
  components: { metric: Metric; value: number | null; target: number; weight: number; result: number | null }[];
  missing: Metric[];
}

const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export function platformNorthStar(v: NorthStarInputs, targets: NorthStarTargets, weights: Weights = DEFAULT_WEIGHTS): PlatformNorthStar {
  const components = METRICS.map((metric) => {
    const value = v[metric];
    const target = targets[metric];
    return { metric, value, target, weight: weights[metric], result: num(value) && target > 0 ? (value / target) * weights[metric] : null };
  });
  const missing = components.filter((c) => c.result === null).map((c) => c.metric);
  return { value: missing.length ? null : components.reduce((a, c) => a + (c.result as number), 0), components, missing };
}

/** CSAT de um período: média das notas (% top-box) das pesquisas CSAT com respostas nele. */
export function periodCsat(surveys: { value: number | null }[]): number | null {
  const vals = surveys.map((s) => s.value).filter(num);
  return vals.length ? vals.reduce((a, x) => a + x, 0) / vals.length : null;
}

/* ---------- North Star Jovens Gênios (média das 3 plataformas) ---------- */

export interface PlatformNorthStarView {
  key: PlatformKey;
  label: string;
  /** projeto da Luumu de onde vieram os dados; null = plataforma sem projeto encontrado */
  project: string | null;
  /** null enquanto o resultado está sendo calculado ou sem projeto */
  now: PlatformNorthStar | null;
  /** North Star do período anterior (pontos) */
  prev: number | null;
  pending: boolean;
}

export interface GlobalNorthStar {
  /** pontos (100 = as três plataformas na meta); null se faltar alguma plataforma */
  value: number | null;
  prev: number | null;
  platforms: PlatformNorthStarView[];
}

/** Média simples, só com todas presentes: média parcial mudaria o significado do número. */
export function averageNorthStar(values: (number | null)[]): number | null {
  if (!values.length || !values.every(num)) return null;
  return (values as number[]).reduce((a, x) => a + x, 0) / values.length;
}

/** (North Star GenieX + Exploradores + Educadores) ÷ 3, cada uma com as metas da própria plataforma. */
export function buildGlobalNorthStar(platforms: PlatformNorthStarView[]): GlobalNorthStar {
  return {
    value: averageNorthStar(platforms.map((p) => p.now?.value ?? null)),
    prev: averageNorthStar(platforms.map((p) => p.prev)),
    platforms,
  };
}
