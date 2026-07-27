// min/max default por bloco de nota, usado quando a pergunta não informa config.min/max explícito
const SCORE_RANGE_DEFAULTS: Record<string, { min: number; max: number }> = {
  nps: { min: 0, max: 10 },
  rating: { min: 1, max: 5 },
  stars: { min: 1, max: 5 },
  csat: { min: 1, max: 5 },
  ces: { min: 1, max: 7 },
  scale: { min: 1, max: 5 },
};

/**
 * Deriva sentimento a partir de uma nota, normalizando pela escala real da pergunta
 * (min/max) — sem isso, o mesmo número (ex: 5) significa coisas opostas em escalas
 * diferentes (NPS 0-10 vs CSAT 1-5), o que gerava classificação errada.
 * Usa a mesma proporção do NPS: top ~30% = positivo, próximos ~20% = neutro, resto = negativo.
 */
export function deriveSentiment(
  score: number | null,
  range?: { blockId?: string | null; min?: number | null; max?: number | null }
): "positivo" | "neutro" | "negativo" | null {
  if (score == null) return null;

  const defaults = range?.blockId ? SCORE_RANGE_DEFAULTS[range.blockId] : undefined;
  const min = range?.min ?? defaults?.min ?? 0;
  const max = range?.max ?? defaults?.max ?? 10;
  if (max <= min) return null;

  // posição da nota na escala, de 0 (mínimo) a 1 (máximo)
  const pct = (score - min) / (max - min);
  if (pct >= 0.8) return "positivo"; // ex.: NPS 9-10, CSAT 5/5
  if (pct >= 0.5) return "neutro"; // ex.: NPS 5-8, CSAT 3/5
  return "negativo";
}
