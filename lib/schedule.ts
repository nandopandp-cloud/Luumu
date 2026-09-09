/**
 * Vigência de uma pesquisa (client-safe).
 *
 * `startsAt`/`endsAt` são datas civis no formato "YYYY-MM-DD" (sem hora e sem fuso) —
 * é o que o <input type="date"> produz. A janela é INCLUSIVA nas duas pontas: uma
 * pesquisa com fim "2026-09-09" ainda responde durante todo o dia 09.
 *
 * A comparação é feita em texto (YYYY-MM-DD ordena lexicograficamente igual a
 * cronologicamente) contra o "hoje" civil do fuso do workspace. Comparar como Date
 * levaria o horário do servidor (UTC na Vercel) para dentro da conta e faria a
 * pesquisa virar de vigência algumas horas antes/depois da meia-noite do cliente.
 */

/** Fuso padrão dos workspaces (mesmo default de `workspaces.timezone` no schema). */
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** Data civil de hoje ("YYYY-MM-DD") no fuso informado. */
export function today(timeZone: string = DEFAULT_TIMEZONE): string {
  // en-CA formata como YYYY-MM-DD, que é exatamente o formato do <input type="date">
  return new Date().toLocaleDateString("en-CA", { timeZone });
}

/** Soma dias a uma data civil "YYYY-MM-DD", devolvendo outra data civil. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`); // meio-dia UTC: imune a horário de verão
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-09-09" → "09/09/2026". Devolve "" para valor vazio. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

export type ScheduleState = "agendada" | "vigente" | "expirada";

/** Onde a data de referência cai em relação à janela de vigência. */
export function scheduleState(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  ref: string = today()
): ScheduleState {
  if (startsAt && ref < startsAt) return "agendada";
  if (endsAt && ref > endsAt) return "expirada";
  return "vigente";
}

/** A pesquisa está dentro da vigência (ou sem vigência definida)? */
export function isWithinSchedule(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  ref: string = today()
): boolean {
  return scheduleState(startsAt, endsAt, ref) === "vigente";
}

/** Rótulo legível da vigência, para exibir no diálogo e nas configurações. */
export function scheduleLabel(startsAt: string | null | undefined, endsAt: string | null | undefined): string {
  if (startsAt && endsAt) return `${formatDate(startsAt)} a ${formatDate(endsAt)}`;
  if (startsAt) return `A partir de ${formatDate(startsAt)}`;
  if (endsAt) return `Até ${formatDate(endsAt)}`;
  return "Sem data definida (vale por tempo indeterminado)";
}

/** Aceita apenas "YYYY-MM-DD"; qualquer outra coisa (inclusive "") vira null. */
export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}
