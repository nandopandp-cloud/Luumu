/*
  Divide um período do painel entre o resumo diário (analytics_session_days) e as telas brutas.

  O resumo guarda dias inteiros de Brasília (UTC−3, sem horário de verão desde 2019, como
  startOfTodayBR). Um período como "últimos 7 dias" começa no meio de um dia e termina agora:
  os dias inteiros que já foram resumidos vêm do resumo; a ponta do começo, a de hoje e qualquer
  dia ainda não resumido vêm das telas. Assim o resultado é o mesmo das telas, só mais barato.

  PURO (sem banco): testado em tests/analytics/rollup-range.test.ts.
*/

const DAY_MS = 86_400_000;

/** Dia de Brasília ("2026-11-03") em que o instante cai. */
export const brDay = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);

/** Meia-noite (Brasília) do dia. */
export const dayStart = (day: string) => new Date(`${day}T00:00:00-03:00`);

/** O dia `n` dias depois (antes, se negativo). */
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Dias inteiros contidos em [from, to), ou null se não há nenhum. */
export function fullDays(from: Date, to: Date): { first: string; last: string } | null {
  const d0 = brDay(from);
  const first = dayStart(d0).getTime() === from.getTime() ? d0 : addDays(d0, 1);
  const last = addDays(brDay(to), -1);
  return first <= last ? { first, last } : null;
}

export interface RangePlan {
  /** dias lidos do resumo (inclusive) */
  rollup: { first: string; last: string } | null;
  /** trechos lidos das telas, [from, to) */
  raw: { from: Date; to: Date }[];
}

/**
 * Plano de leitura de [from, to): do resumo, os dias inteiros a partir do primeiro, enquanto
 * estiverem prontos (`done`); das telas, a ponta do começo e tudo depois do último dia pronto.
 */
export function planRange(from: Date, to: Date, done: (day: string) => boolean): RangePlan {
  const span = fullDays(from, to);
  if (!span || !done(span.first)) return { rollup: null, raw: [{ from, to }] };
  let last = span.first;
  while (last < span.last && done(addDays(last, 1))) last = addDays(last, 1);
  const raw: RangePlan["raw"] = [];
  const head = dayStart(span.first);
  const tail = dayStart(addDays(last, 1));
  if (from < head) raw.push({ from, to: head });
  if (tail < to) raw.push({ from: tail, to });
  return { rollup: { first: span.first, last }, raw };
}
