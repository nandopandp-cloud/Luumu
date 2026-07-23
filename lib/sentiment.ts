/** Deriva sentimento a partir de uma nota (client-safe, compartilhado entre action e API). */
export function deriveSentiment(score: number | null): "positivo" | "neutro" | "negativo" | null {
  if (score == null) return null;
  // normaliza faixas comuns: NPS 0-10, CSAT/escala 1-5, CES 1-7
  if (score >= 8 || (score <= 5 && score >= 4)) return "positivo";
  if (score >= 6 && score <= 7) return "neutro";
  if (score <= 3) return "negativo";
  return "neutro";
}
