export const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "all", label: "Todo o período" },
  { value: "custom", label: "Período específico…" },
] as const;

export type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

/**
 * Período das telas com filtro quando a URL não diz nada: "Hoje" em toda a plataforma. É o que
 * o seletor mostra e o que os dados usam (os dois precisam bater).
 */
export const DEFAULT_PERIOD = "today";

/** "90d" saiu do seletor, mas links, visões e relatórios salvos com ele continuam valendo. */
const LEGACY_LABELS: Record<string, string> = { "90d": "Últimos 90 dias" };

/** Meia-noite de hoje no horário de Brasília (UTC−3, sem horário de verão desde 2019). */
export function startOfTodayBR(now = new Date()): Date {
  const br = new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
  return new Date(`${br}T00:00:00-03:00`);
}

/**
 * Converte o valor do período em uma data de início (ou undefined para "todo o período").
 * Mantida por compatibilidade com quem só precisa do início (ex: séries temporais).
 * Para "custom", use periodToRange (precisa das datas from/to explícitas).
 */
export function periodToDateFrom(period: string | null | undefined): Date | undefined {
  if (period === "today") return startOfTodayBR();
  const days: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 };
  const n = period ? days[period] : undefined;
  if (!n) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Converte o período (incluindo "custom" com datas explícitas em formato YYYY-MM-DD)
 * em um range { from, to }. Usada por todas as páginas que filtram por período.
 */
export function periodToRange(
  period: string | null | undefined,
  customFrom?: string | null,
  customTo?: string | null
): { from?: Date; to?: Date } {
  if (period === "custom") {
    const from = customFrom ? new Date(`${customFrom}T00:00:00`) : undefined;
    const to = customTo ? new Date(`${customTo}T23:59:59.999`) : undefined;
    return { from, to };
  }
  return { from: periodToDateFrom(period || DEFAULT_PERIOD), to: undefined };
}

/** Rótulo legível do período, incluindo o range de datas quando "custom". */
export function periodLabel(period: string | null | undefined, customFrom?: string | null, customTo?: string | null): string {
  if (period === "custom" && customFrom && customTo) {
    const fmt = (s: string) => {
      const [y, m, d] = s.split("-");
      return `${d}/${m}/${y}`;
    };
    return `${fmt(customFrom)} a ${fmt(customTo)}`;
  }
  return PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? LEGACY_LABELS[period ?? ""] ?? "Hoje";
}

/** "28/09/2026" */
export function formatDayBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Completa uma série diária com zero nos dias sem dado, de `from` até `to` (ou hoje), para os
 * minigráficos terem uma linha contínua. Sem `from` (todo o período), começa no primeiro dia
 * com dado. Limitado aos últimos `maxDays` dias.
 */
export function fillDays<T extends { date: string }>(
  series: T[],
  empty: (date: string) => T,
  from?: Date,
  to?: Date,
  maxDays = 90
): T[] {
  const end = to ?? new Date();
  const first = from ?? (series[0] ? new Date(`${series[0].date}T00:00:00Z`) : end);
  const start = new Date(Math.max(first.getTime(), end.getTime() - (maxDays - 1) * 86_400_000));
  const byDay = new Map(series.map((p) => [p.date, p]));
  const out: T[] = [];
  for (let t = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()); t <= end.getTime(); t += 86_400_000) {
    const k = dayKey(new Date(t));
    out.push(byDay.get(k) ?? empty(k));
  }
  return out;
}
