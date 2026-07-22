export const funnel = [
  { step: "Visitou", value: 12400, pct: 100 },
  { step: "Criou conta", value: 6820, pct: 55 },
  { step: "Concluiu onboarding", value: 4380, pct: 35 },
  { step: "Criou 1ª pesquisa", value: 2610, pct: 21 },
  { step: "Ativou (converteu)", value: 1490, pct: 12 },
];

export const retention = [
  { day: "D0", value: 100 },
  { day: "D1", value: 62 },
  { day: "D3", value: 48 },
  { day: "D7", value: 39 },
  { day: "D14", value: 33 },
  { day: "D30", value: 28 },
];

export const engagement = [
  { date: "Jun 01", dau: 820, wau: 3200, mau: 8600 },
  { date: "Jun 08", dau: 910, wau: 3400, mau: 8720 },
  { date: "Jun 15", dau: 870, wau: 3550, mau: 8810 },
  { date: "Jun 22", dau: 980, wau: 3700, mau: 8900 },
  { date: "Jun 29", dau: 1040, wau: 3820, mau: 9020 },
];

// Cohort retention grid (semana × período)
export const cohorts = [
  { cohort: "Sem 1", size: 420, values: [100, 68, 52, 44, 38, 34] },
  { cohort: "Sem 2", size: 510, values: [100, 71, 55, 47, 40, null] },
  { cohort: "Sem 3", size: 480, values: [100, 66, 51, 43, null, null] },
  { cohort: "Sem 4", size: 550, values: [100, 73, 58, null, null, null] },
  { cohort: "Sem 5", size: 610, values: [100, 70, null, null, null, null] },
  { cohort: "Sem 6", size: 590, values: [100, null, null, null, null, null] },
];

export const topPages = [
  { page: "/dashboard", views: 24800, avg: "2m 10s" },
  { page: "/surveys", views: 18200, avg: "3m 40s" },
  { page: "/surveys/new", views: 9400, avg: "4m 02s" },
  { page: "/heatmaps", views: 7100, avg: "5m 18s" },
  { page: "/insights", views: 5600, avg: "3m 55s" },
];
