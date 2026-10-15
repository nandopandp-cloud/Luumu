/**
 * Quinzenas do Report de Produto: 1ª = dias 1 a 15, 2ª = dia 16 ao fim do mês (as abas Q1/Q2 da
 * planilha North Star). Id "AAAA-MM-1" | "AAAA-MM-2". Datas no horário de Brasília (UTC−3, sem
 * horário de verão desde 2019), como o resto da plataforma (lib/period.ts).
 */

export type PeriodId = string;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export interface ParsedPeriod {
  year: number;
  month: number; // 1-12
  half: 1 | 2;
}

export function parsePeriod(id: string | null | undefined): ParsedPeriod | null {
  const m = /^(\d{4})-(\d{2})-([12])$/.exec(id ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month, half: Number(m[3]) as 1 | 2 };
}

const pad = (n: number) => String(n).padStart(2, "0");
const toId = (p: ParsedPeriod): PeriodId => `${p.year}-${pad(p.month)}-${p.half}`;
const brMidnight = (y: number, m: number, d: number) => new Date(`${y}-${pad(m)}-${pad(d)}T00:00:00-03:00`);

/** [from, to): início da quinzena e início da seguinte (fim exclusivo). */
export function periodRange(id: PeriodId): { from: Date; to: Date } {
  const p = parsePeriod(id);
  if (!p) throw new Error(`Quinzena inválida: ${id}`);
  if (p.half === 1) return { from: brMidnight(p.year, p.month, 1), to: brMidnight(p.year, p.month, 16) };
  const next = p.month === 12 ? { y: p.year + 1, m: 1 } : { y: p.year, m: p.month + 1 };
  return { from: brMidnight(p.year, p.month, 16), to: brMidnight(next.y, next.m, 1) };
}

/** Quinzena `n` posições à frente (negativo = para trás). */
export function shiftPeriod(id: PeriodId, n: number): PeriodId {
  const p = parsePeriod(id);
  if (!p) throw new Error(`Quinzena inválida: ${id}`);
  const idx = p.year * 24 + (p.month - 1) * 2 + (p.half - 1) + n;
  return toId({ year: Math.floor(idx / 24), month: Math.floor((idx % 24) / 2) + 1, half: ((idx % 2) + 1) as 1 | 2 });
}

/** Quinzena que contém o instante dado (no horário de Brasília). */
export function periodOf(date: Date): PeriodId {
  const br = new Date(date.getTime() - 3 * 3_600_000);
  return toId({ year: br.getUTCFullYear(), month: br.getUTCMonth() + 1, half: br.getUTCDate() <= 15 ? 1 : 2 });
}

/** Última quinzena já encerrada: é a que o relatório cobre por padrão. */
export function lastClosedPeriod(now = new Date()): PeriodId {
  return shiftPeriod(periodOf(now), -1);
}

export function isClosed(id: PeriodId, now = new Date()): boolean {
  return periodRange(id).to.getTime() <= now.getTime();
}

/** "1ª quinzena de outubro/2026" */
export function periodLabel(id: PeriodId): string {
  const p = parsePeriod(id);
  if (!p) return id;
  return `${p.half}ª quinzena de ${MONTHS_LONG[p.month - 1]}/${p.year}`;
}

/** "Q1 out/26" (eixo dos gráficos, mesma notação das abas da planilha) */
export function periodShortLabel(id: PeriodId): string {
  const p = parsePeriod(id);
  if (!p) return id;
  return `Q${p.half} ${MONTHS[p.month - 1]}/${String(p.year).slice(2)}`;
}

/** "16/10/2026 a 31/10/2026" */
export function periodDates(id: PeriodId): string {
  const { from, to } = periodRange(id);
  const last = new Date(to.getTime() - 1);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return `${fmt(from)} a ${fmt(last)}`;
}

/** "Q2/09" (notação do report de referência) */
export function periodCode(id: PeriodId): string {
  const p = parsePeriod(id);
  return p ? `Q${p.half}/${pad(p.month)}` : id;
}

/** "Q2 Setembro" (títulos dos gráficos) */
export function periodTitle(id: PeriodId): string {
  const p = parsePeriod(id);
  if (!p) return id;
  const m = MONTHS_LONG[p.month - 1];
  return `Q${p.half} ${m[0].toUpperCase()}${m.slice(1)}`;
}

/** "16/Jun": início da quinzena, eixo X dos gráficos */
export function periodTick(id: PeriodId): string {
  const p = parsePeriod(id);
  if (!p) return id;
  const m = MONTHS[p.month - 1];
  return `${p.half === 1 ? "01" : "16"}/${m[0].toUpperCase()}${m.slice(1)}`;
}

/** "16/09 a 30/09" */
export function periodDatesShort(id: PeriodId): string {
  const { from, to } = periodRange(id);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  return `${fmt(from)} a ${fmt(new Date(to.getTime() - 1))}`;
}

/** Quinzenas do ano de `last`, de 1ª de janeiro até `last` (média anual da North Star). */
export function yearPeriodsUntil(last: PeriodId): PeriodId[] {
  const p = parsePeriod(last);
  if (!p) return [];
  return periodsUntil(last, (p.month - 1) * 2 + p.half);
}

/** As `count` quinzenas que terminam em `last` (inclusive), da mais antiga para a mais nova. */
export function periodsUntil(last: PeriodId, count: number): PeriodId[] {
  return Array.from({ length: count }, (_, i) => shiftPeriod(last, i - count + 1));
}
