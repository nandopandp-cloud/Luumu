/*
  Dados de exemplo da área Insights (os mesmos da referência de design), tipados com o
  contrato real. Usados nos testes e como documentação do formato que a futura API
  (GET /api/insights) deve devolver. A tela NÃO usa estes dados: ela mostra a análise real
  das respostas do workspace (lib/insights/service.ts).
*/
import type { FeedbackComment, InsightsData } from "./types";

const comment = (id: string, text: string, sentiment: FeedbackComment["sentiment"], themes: string[], when: string): FeedbackComment => ({
  id,
  text,
  sentiment,
  score: sentiment === "positivo" ? 5 : sentiment === "negativo" ? 1 : 3,
  themes,
  when,
  createdAt: "2026-09-28T12:00:00.000Z",
});

const positive = comment("c1", "A plataforma é muito fácil de usar, consegui criar a pesquisa em poucos minutos. Parabéns!", "positivo", ["Facilidade de uso"], "Há 3 dias");
const negative = comment("c2", "O sistema está muito lento no checkout, demorou para carregar várias vezes.", "negativo", ["Performance", "Checkout"], "Há 5 dias");

export const insightsMock: InsightsData = {
  periodLabel: "últimos 30 dias",
  totalResponses: 458,
  totalComments: 312,
  classifiedComments: 290,
  hasPrevious: true,
  summary: {
    headline:
      "A satisfação geral permanece positiva, mas existem sinais de atenção relacionados à performance. O principal fator positivo continua sendo a facilidade de uso.",
    detail: "A Luumu identificou 3 temas que merecem investigação e 2 oportunidades recorrentes.",
    positives: { count: 3, items: ["Facilidade de uso", "Suporte", "Relatórios"] },
    attention: { count: 2, items: ["Performance", "Checkout"] },
    opportunities: { count: 2, items: ["Exportação de relatórios", "Mensagens de erro"] },
  },
  satisfaction: {
    label: "CSAT",
    value: "75%",
    delta: { value: 4, unit: "p.p.", inverted: false },
    trend: [62, 64, 63, 68, 70, 71, 75],
    formula: "% de respostas 4–5",
  },
  sentimentEvolution: { day: [], week: ["31/08", "07/09", "14/09", "21/09", "28/09"].map((label, i) => ({
    key: `2026-${label.slice(3)}-${label.slice(0, 2)}`,
    label,
    total: 90,
    levels: {
      very_positive: [65, 72, 78, 70, 62][i],
      positive: [22, 26, 30, 25, 22][i],
      neutral: [14, 17, 14, 12, 12][i],
      negative: [6, 8, 6, 6, 5][i],
      very_negative: [1, 1, 1, 1, 1][i],
    },
  })) },
  sentimentDistribution: [
    { level: "very_positive", label: "Muito positivo", pct: 57, count: 261 },
    { level: "positive", label: "Positivo", pct: 17, count: 78 },
    { level: "neutral", label: "Neutro", pct: 8, count: 37 },
    { level: "negative", label: "Negativo", pct: 2, count: 9 },
    { level: "very_negative", label: "Muito negativo", pct: 0, count: 0 },
  ],
  topics: [
    ["performance", "Performance", 27],
    ["usability", "Facilidade de uso", 21],
    ["checkout", "Checkout", 18],
    ["reports", "Relatórios", 14],
    ["support", "Suporte", 9],
    ["integrations", "Integrações", 6],
    ["other", "Outros", 5],
  ].map(([id, label, p]) => ({
    id: id as string,
    label: label as string,
    pct: p as number,
    count: Math.round(((p as number) / 100) * 290),
    positive: 10,
    negative: 10,
    neutral: 5,
    keywords: [{ word: "lentidão", count: 31 }],
    samples: [negative],
  })),
  changes: [
    { id: "usability", label: "Facilidade de uso", description: "Menções positivas aumentaram 18%.", change: 18, good: true },
    { id: "performance", label: "Performance", description: "Comentários sobre lentidão aumentaram 24%.", change: 24, good: false },
    { id: "support", label: "Atendimento", description: "O sentimento positivo relacionado ao suporte aumentou 11%.", change: 11, good: true },
    { id: "checkout", label: "Checkout", description: "Menções negativas aumentaram 16%.", change: 16, good: false },
  ],
  recommendations: [
    {
      id: "r1",
      kind: "attention",
      themeId: "performance",
      title: "Investigue a performance do checkout",
      description: "67% dos comentários relacionados à performance são negativos e 43% mencionam especificamente o checkout.",
      evidence: {
        analyzed: 87,
        facts: [
          { label: "mencionam checkout", count: 43 },
          { label: "mencionam lentidão", count: 31 },
          { label: "mencionam carregamento", count: 18 },
          { label: "mencionam erro", count: 12 },
        ],
        comments: [negative],
      },
    },
    {
      id: "r2",
      kind: "opportunity",
      themeId: "reports",
      title: "Simplifique a exportação de relatórios",
      description: "43 respostas mencionaram necessidade de exportar dados.",
      evidence: { analyzed: 43, facts: [{ label: "mencionam exportação", count: 43 }], comments: [] },
    },
    {
      id: "r3",
      kind: "opportunity",
      themeId: "bugs",
      title: "Melhore as mensagens de erro",
      description: "Comentários indicam confusão em mensagens de erro específicas.",
      evidence: { analyzed: 12, facts: [{ label: "mencionam erro", count: 12 }], comments: [] },
    },
  ],
  featuredComments: [positive, negative],
};
