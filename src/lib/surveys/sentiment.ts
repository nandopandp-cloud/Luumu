// min/max default por bloco de nota, usado quando a pergunta não informa config.min/max explícito
const SCORE_RANGE_DEFAULTS: Record<string, { min: number; max: number }> = {
  nps: { min: 0, max: 10 },
  rating: { min: 1, max: 5 },
  stars: { min: 1, max: 5 },
  csat: { min: 1, max: 5 },
  ces: { min: 1, max: 7 },
  scale: { min: 1, max: 5 },
};

type Sentiment = "positivo" | "neutro" | "negativo";

// Cortes fixos por tipo de pesquisa, na convenção real de cada modelo — não uma
// proporção genérica da escala. Cada função recebe a nota já dentro do range da
// pergunta e devolve a classificação.
const FIXED_RULES: Record<string, (score: number) => Sentiment> = {
  // NPS 0-10: padrão de mercado promotor (9-10) / passivo (7-8) / detrator (0-6).
  nps: (score) => (score >= 9 ? "positivo" : score >= 7 ? "neutro" : "negativo"),
  // CSAT/rating/stars/scale 0-5 (ou 1-5): 4-5 satisfeito, 3 neutro, 0-2 insatisfeito.
  csat: (score) => (score >= 4 ? "positivo" : score === 3 ? "neutro" : "negativo"),
  rating: (score) => (score >= 4 ? "positivo" : score === 3 ? "neutro" : "negativo"),
  stars: (score) => (score >= 4 ? "positivo" : score === 3 ? "neutro" : "negativo"),
  scale: (score) => (score >= 4 ? "positivo" : score === 3 ? "neutro" : "negativo"),
  // CES 1-7: mede esforço, então invertido — menos esforço (nota baixa) é melhor.
  ces: (score) => (score <= 3 ? "positivo" : score <= 5 ? "neutro" : "negativo"),
};

/**
 * Deriva sentimento a partir de uma nota, usando a regra fixa do tipo de pergunta
 * (blockId) quando reconhecido — cada modelo de pesquisa tem sua própria convenção de
 * corte (NPS 9-10/7-8/0-6, CSAT 4-5/3/0-2, CES invertido), não uma proporção genérica
 * da escala. Cai para um cálculo proporcional só quando o blockId não é reconhecido ou
 * a escala configurada foge do padrão esperado do tipo.
 */
export function deriveSentiment(
  score: number | null,
  range?: { blockId?: string | null; min?: number | null; max?: number | null }
): Sentiment | null {
  if (score == null) return null;

  const blockId = range?.blockId ?? undefined;
  const defaults = blockId ? SCORE_RANGE_DEFAULTS[blockId] : undefined;
  const min = range?.min ?? defaults?.min ?? 0;
  const max = range?.max ?? defaults?.max ?? 10;
  if (max <= min) return null;

  // regra fixa do tipo, só quando a escala configurada bate com o range esperado dele
  // (se alguém customizar min/max fora do padrão, essa regra fixa não faria sentido)
  const rule = blockId ? FIXED_RULES[blockId] : undefined;
  if (rule && defaults && min === defaults.min && max === defaults.max) {
    return rule(score);
  }

  // fallback proporcional (escalas customizadas ou blockId não mapeado)
  const pct = (score - min) / (max - min);
  if (pct >= 0.8) return "positivo";
  if (pct >= 0.5) return "neutro";
  return "negativo";
}
