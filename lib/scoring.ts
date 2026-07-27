/**
 * Cálculo do score agregado de uma pesquisa, respeitando a metodologia real de cada
 * modelo — não uma média simples aplicada indiscriminadamente. Cada instrumento (NPS,
 * CSAT, CES...) tem sua própria fórmula, faixa de saída e direção, definidas pela
 * literatura padrão de UX/CX research (Nielsen Norman Group, MeasuringU):
 *
 *  - NPS: %promotores (9-10) − %detratores (0-6), resultado de -100 a +100.
 *    NÃO é a média das notas — uma média das notas 0-10 não corresponde a nenhum
 *    valor reconhecido como "NPS" no mercado.
 *  - CSAT: % de respostas nas notas mais altas da escala ("top-box"), 0% a 100%.
 *  - CES: média simples é aceitável (ao contrário do NPS), mas a direção importa —
 *    mede esforço, então nota mais baixa é melhor.
 *  - Demais tipos de pergunta de nota (rating/stars/scale genéricos): tratados como
 *    CSAT (top-box), convenção mais comum para escalas de satisfação.
 */

export type ScoreMethodology = "nps" | "csat" | "ces" | "generic";

export interface ScoreResult {
  methodology: ScoreMethodology;
  /** Valor pronto para exibir: NPS inteiro com sinal, CSAT/genérico em %, CES na escala original. */
  value: number | null;
  /** Rótulo curto do que o número representa, para o card não induzir a leitura errada. */
  label: string;
  /** Explicação da fórmula, para tooltip/hint — combate a leitura de "nota de 0 a 10". */
  formula: string;
  /** Faixa de exibição esperada, para o card escolher a escala visual certa. */
  range: { min: number; max: number };
  /** true quando nota BAIXA é o resultado desejado (CES) — inverte a leitura de cor/tendência. */
  lowerIsBetter: boolean;
}

const BLOCK_METHODOLOGY: Record<string, ScoreMethodology> = {
  nps: "nps",
  csat: "csat",
  rating: "generic",
  stars: "generic",
  scale: "generic",
  ces: "ces",
};

const SCALE_DEFAULTS: Record<string, { min: number; max: number }> = {
  nps: { min: 0, max: 10 },
  csat: { min: 1, max: 5 },
  rating: { min: 1, max: 5 },
  stars: { min: 1, max: 5 },
  scale: { min: 1, max: 5 },
  ces: { min: 1, max: 7 },
};

/** blockIds reconhecidos como pergunta de "nota" (têm metodologia de score associada). */
export const SCORE_BLOCK_IDS = Object.keys(SCALE_DEFAULTS);

/** Metodologia aplicável a um blockId de pergunta de nota (ou "generic" se não reconhecido). */
export function methodologyForBlock(blockId: string | null | undefined): ScoreMethodology {
  return (blockId && BLOCK_METHODOLOGY[blockId]) || "generic";
}

/** Escala padrão (min/max) esperada para um blockId, usada quando a pergunta não customiza. */
export function defaultScaleForBlock(blockId: string | null | undefined): { min: number; max: number } {
  return (blockId && SCALE_DEFAULTS[blockId]) || { min: 0, max: 10 };
}

/**
 * Calcula o score agregado de um conjunto de notas, na metodologia correta.
 * `scores` deve conter só notas não-nulas da pergunta principal de score da pesquisa.
 */
export function computeScore(
  scores: number[],
  methodology: ScoreMethodology,
  scale: { min: number; max: number }
): ScoreResult {
  const base = { methodology, range: scale };

  if (scores.length === 0) {
    return {
      ...base,
      value: null,
      label: labelFor(methodology),
      formula: formulaFor(methodology),
      lowerIsBetter: methodology === "ces",
    };
  }

  if (methodology === "nps") {
    const promoters = scores.filter((s) => s >= 9).length;
    const detractors = scores.filter((s) => s <= 6).length;
    const nps = Math.round(((promoters - detractors) / scores.length) * 100);
    return {
      ...base,
      value: nps,
      label: "NPS",
      formula: "% promotores (9-10) − % detratores (0-6)",
      range: { min: -100, max: 100 },
      lowerIsBetter: false,
    };
  }

  if (methodology === "ces") {
    const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
    return {
      ...base,
      value: Math.round(avg * 10) / 10,
      label: "CES (esforço médio)",
      formula: "média das notas — quanto menor, menos esforço",
      lowerIsBetter: true,
    };
  }

  // csat + generic: top-box (topo da escala = "satisfeito"). Em escalas de 5 pontos,
  // top-2-box (4 e 5); em outras faixas, as 2 notas mais altas proporcionalmente.
  const { min, max } = scale;
  const span = max - min;
  const topBoxFrom = span <= 4 ? max - 1 : Math.round(max - span * 0.2);
  const satisfied = scores.filter((s) => s >= topBoxFrom).length;
  const pct = Math.round((satisfied / scores.length) * 100);
  return {
    ...base,
    value: pct,
    label: methodology === "csat" ? "CSAT" : "Satisfação",
    formula: `% de respostas ${topBoxFrom}-${max} (as notas mais altas da escala)`,
    range: { min: 0, max: 100 },
    lowerIsBetter: false,
  };
}

function labelFor(m: ScoreMethodology): string {
  if (m === "nps") return "NPS";
  if (m === "ces") return "CES (esforço médio)";
  if (m === "csat") return "CSAT";
  return "Satisfação";
}

function formulaFor(m: ScoreMethodology): string {
  if (m === "nps") return "% promotores (9-10) − % detratores (0-6)";
  if (m === "ces") return "média das notas — quanto menor, menos esforço";
  return "% de respostas nas notas mais altas da escala";
}

/** Formata o value de um ScoreResult para exibição (com sinal no NPS, % nos demais). */
export function formatScore(r: ScoreResult): string {
  if (r.value == null) return "—";
  if (r.methodology === "nps") return r.value > 0 ? `+${r.value}` : String(r.value);
  if (r.methodology === "ces") return String(r.value);
  return `${r.value}%`;
}
