export const sentiment = { positivo: 72, neutro: 18, negativo: 10 };

export const clusters = [
  { theme: "Facilidade de uso", count: 342, sentiment: "positivo", trend: "+12%" },
  { theme: "Exportação de dados", count: 198, sentiment: "negativo", trend: "+8%" },
  { theme: "Qualidade dos insights", count: 176, sentiment: "positivo", trend: "+21%" },
  { theme: "Performance dos heatmaps", count: 143, sentiment: "negativo", trend: "-4%" },
  { theme: "Onboarding", count: 121, sentiment: "neutro", trend: "+3%" },
  { theme: "Preço", count: 98, sentiment: "neutro", trend: "-2%" },
];

export const pains = [
  "Configurar disparo por evento é confuso para novos usuários",
  "Exportação limitada — falta Excel nativo e agendamento",
  "Heatmaps demoram a carregar em páginas longas",
];

export const praises = [
  "Interface intuitiva e agradável — o mascote encanta",
  "Insights de IA economizam horas de análise manual",
  "Dashboards claros e prontos para apresentar",
];

export const recommendations = [
  { title: "Simplifique o disparo por evento", impact: "Alto", effort: "Médio" },
  { title: "Adicione exportação para Excel", impact: "Alto", effort: "Baixo" },
  { title: "Otimize renderização dos heatmaps", impact: "Médio", effort: "Alto" },
];

export const churnRisk = [
  { account: "Acme Corp", score: 82, reason: "Queda de 40% no uso + CSAT 2.8" },
  { account: "Beta Labs", score: 67, reason: "Nenhuma pesquisa criada em 21 dias" },
  { account: "Nova SaaS", score: 54, reason: "2 tickets de suporte não resolvidos" },
];
