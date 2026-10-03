/*
  Contrato da área Insights IA. A interface (components/insights/*) consome SÓ estes tipos.

    UI  →  getInsights() (lib/insights/service.ts)  →  dados do Luumu + análise (lib/insights/analyze.ts)

  Hoje a análise de temas é determinística (dicionário de temas em lib/insights/themes.ts).
  Quando existir um motor de IA, ele devolve este mesmo formato e a UI não muda.
  PURO: sem DOM, sem banco.
*/

export const SENTIMENT_LEVELS = ["very_positive", "positive", "neutral", "negative", "very_negative"] as const;
export type SentimentLevel = (typeof SENTIMENT_LEVELS)[number];

export interface SentimentCategory {
  level: SentimentLevel;
  label: string; // "Muito positivo"
  pct: number; // 0–100 no período
  count: number;
}

/** Um ponto da evolução: % de respostas em cada nível de sentimento naquela semana/dia. */
export interface SentimentPoint {
  key: string; // início do balde (YYYY-MM-DD)
  label: string; // "28/09"
  total: number;
  /** % (0–100) de cada nível; null = semana sem resposta (lacuna no gráfico, não 0%) */
  levels: Record<SentimentLevel, number> | null;
}

export interface SatisfactionMetric {
  label: string; // "CSAT", "NPS"...
  value: string; // "75%"
  /** variação vs. período anterior (p.p. para %, pts para NPS/CES); null = sem base */
  delta: { value: number; unit: "p.p." | "pts"; inverted: boolean } | null;
  trend: number[]; // série para o minigráfico
  formula: string;
}

export interface FeedbackComment {
  id: string;
  text: string;
  sentiment: "positivo" | "neutro" | "negativo" | null;
  score: number | null;
  themes: string[]; // rótulos dos temas
  when: string; // "Há 3 dias"
  createdAt: string; // ISO
}

export interface TopicInsight {
  id: string;
  label: string;
  pct: number; // % dos comentários classificados que mencionam o tema
  count: number;
  positive: number;
  negative: number;
  neutral: number;
  /** palavras do tema mais frequentes nos comentários (ex.: "trava", "carrega") */
  keywords: { word: string; count: number }[];
  samples: FeedbackComment[];
}

export interface ChangeInsight {
  id: string; // tema
  label: string;
  description: string;
  change: number; // variação % (sinal = direção do volume)
  /** a mudança é boa para o produto? (mais elogio / menos crítica) */
  good: boolean;
}

export interface Evidence {
  analyzed: number; // comentários analisados para a recomendação
  facts: { label: string; count: number }[]; // "43 mencionam carregamento"
  comments: FeedbackComment[];
}

export interface Recommendation {
  id: string;
  kind: "attention" | "opportunity";
  title: string;
  description: string;
  themeId: string;
  evidence: Evidence;
}

export interface InsightSummary {
  headline: string; // frase principal
  detail: string; // "A Luumu identificou..."
  positives: { count: number; items: string[] };
  attention: { count: number; items: string[] };
  opportunities: { count: number; items: string[] };
}

export interface InsightsData {
  periodLabel: string; // "últimos 30 dias"
  totalResponses: number;
  totalComments: number;
  /** comentários com algum tema reconhecido (base dos percentuais de temas) */
  classifiedComments: number;
  hasPrevious: boolean;
  summary: InsightSummary;
  satisfaction: SatisfactionMetric | null;
  /** evolução de sentimento já agrupada nas duas granularidades do seletor */
  sentimentEvolution: Record<"week" | "day", SentimentPoint[]>;
  sentimentDistribution: SentimentCategory[];
  topics: TopicInsight[];
  changes: ChangeInsight[];
  recommendations: Recommendation[];
  featuredComments: FeedbackComment[];
}

/** Resposta do "Pergunte algo sobre seus dados". */
export interface InsightAnswer {
  question: string;
  /** false = pergunta fora do que os dados desta tela respondem (não inventamos resposta) */
  answered: boolean;
  text: string;
  bullets: string[];
  /** seção da página que aprofunda a resposta */
  anchor?: "summary" | "evolution" | "topics" | "changes" | "recommendations" | "comments";
}

export const LEVEL_LABEL: Record<SentimentLevel, string> = {
  very_positive: "Muito positivo",
  positive: "Positivo",
  neutral: "Neutro",
  negative: "Negativo",
  very_negative: "Muito negativo",
};
