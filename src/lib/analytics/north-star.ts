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
 * A partir da Q1 de novembro/2026 o Report Quinzenal usa a mesma regra (PLATFORM_NORTH_STAR_FROM).
 * Puro: usado pelos cards, pela exportação e pelos testes.
 */
import { csatFromSurveys, csatSurveysFor, type SurveyCsat } from "@/lib/product-report/csat";
import type { PlatformKey, PlatformNorthStar } from "@/lib/product-report/indicators";

// a regra mora no catálogo do Report Quinzenal (fonte única para os dois)
export {
  averageNorthStar,
  NORTH_STAR_TARGETS,
  northStarTargets,
  platformNorthStar,
  USAGE_TARGET_BY_PLATFORM,
  type NorthStarInputs,
  type NorthStarTargets,
  type PlatformNorthStar,
} from "@/lib/product-report/indicators";
import { averageNorthStar } from "@/lib/product-report/indicators";

/**
 * CSAT de um período: a mesma regra do Report Quinzenal (lib/product-report/csat.ts). As pesquisas
 * CSAT são semanais, então vale a média das N pesquisas mais recentes com respostas no período,
 * N = semanas do período (2 numa quinzena, 4 em 30 dias, 1 em 7 dias ou menos).
 */
export function periodCsat(surveys: SurveyCsat[], days: number): number | null {
  return csatFromSurveys(surveys, csatSurveysFor(days)).value;
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

/** (North Star GenieX + Exploradores + Educadores) ÷ 3, cada uma com as metas da própria plataforma. */
export function buildGlobalNorthStar(platforms: PlatformNorthStarView[]): GlobalNorthStar {
  return {
    value: averageNorthStar(platforms.map((p) => p.now?.value ?? null)),
    prev: averageNorthStar(platforms.map((p) => p.prev)),
    platforms,
  };
}
