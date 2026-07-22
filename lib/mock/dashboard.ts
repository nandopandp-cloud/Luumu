export const csatTrend = [
  { date: "01/05", csat: 4.2 },
  { date: "08/05", csat: 4.3 },
  { date: "15/05", csat: 4.1 },
  { date: "22/05", csat: 4.4 },
  { date: "29/05", csat: 4.5 },
  { date: "05/06", csat: 4.4 },
  { date: "12/06", csat: 4.6 },
  { date: "19/06", csat: 4.7 },
];

export const channelSplit = [
  { name: "E-mail", value: 62, color: "var(--luumu-roxo)" },
  { name: "Link", value: 23, color: "var(--luumu-roxo-claro)" },
  { name: "WhatsApp", value: 10, color: "var(--luumu-verde)" },
  { name: "Outros", value: 5, color: "var(--sec-ciano)" },
];

export const npsTrend = [
  { date: "Jan", nps: 41 },
  { date: "Fev", nps: 44 },
  { date: "Mar", nps: 48 },
  { date: "Abr", nps: 52 },
  { date: "Mai", nps: 55 },
  { date: "Jun", nps: 58 },
];

export const recentSurveys = [
  { name: "Onboarding de clientes", status: "ativa", responses: 312, rate: 24, csat: 4.8 },
  { name: "Satisfação · Produto", status: "ativa", responses: 640, rate: 31, csat: 4.5 },
  { name: "Suporte & Atendimento", status: "pausada", responses: 281, rate: 28, csat: 4.2 },
  { name: "Churn Survey · Q2", status: "encerrada", responses: 96, rate: 18, csat: 3.9 },
] as const;
