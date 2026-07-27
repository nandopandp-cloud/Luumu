export const PERIOD_OPTIONS = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "all", label: "Todo o período" },
] as const;

export type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

/** Converte o valor do período em uma data de início (ou undefined para "todo o período"). */
export function periodToDateFrom(period: string | null | undefined): Date | undefined {
  const days: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 };
  const n = period ? days[period] : undefined;
  if (!n) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
