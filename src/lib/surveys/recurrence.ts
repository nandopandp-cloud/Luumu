/**
 * Pesquisa recorrente (client-safe, puro).
 *
 * Criada no "Duplicar" da lista de pesquisas: a cópia vira a 1ª rodada e, a cada N semanas,
 * a Luumu cria a próxima rodada com o mesmo modelo e as mesmas configurações. Como o intervalo
 * é sempre um múltiplo de 7 dias e a duração da vigência é fixa, toda rodada começa e termina
 * nos mesmos dias da semana da primeira (ex.: segunda a domingo).
 *
 * Mantém sempre UMA rodada à frente: assim que a última rodada criada começa, a seguinte é
 * criada já agendada (ver dueForNext). Datas são civis "YYYY-MM-DD" (ver schedule.ts).
 */
import { addDays, formatDate } from "./schedule";

export const RECURRENCE_INTERVALS = [1, 2, 4] as const;
export type RecurrenceInterval = (typeof RECURRENCE_INTERVALS)[number];

export const INTERVAL_LABEL: Record<RecurrenceInterval, string> = {
  1: "Toda semana",
  2: "A cada 2 semanas",
  4: "A cada 4 semanas",
};

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

/** Dia da semana de uma data civil ("segunda", "terça"…). */
export function weekdayOf(date: string): string {
  return WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

/** Dias entre o início e o fim da vigência (0 = começa e termina no mesmo dia). */
export function durationDays(startsAt: string, endsAt: string): number {
  return Math.round((Date.parse(`${endsAt}T12:00:00Z`) - Date.parse(`${startsAt}T12:00:00Z`)) / 86_400_000);
}

/** O intervalo comporta a vigência sem uma rodada começar antes da anterior terminar? */
export function intervalFits(interval: number, duration: number): boolean {
  return interval * 7 > duration;
}

/** Menor intervalo que comporta a vigência; null se a vigência for longa demais (28 dias ou mais). */
export function defaultInterval(duration: number): RecurrenceInterval | null {
  return RECURRENCE_INTERVALS.find((w) => intervalFits(w, duration)) ?? null;
}

export function isRecurrenceInterval(n: unknown): n is RecurrenceInterval {
  return RECURRENCE_INTERVALS.includes(n as RecurrenceInterval);
}

/** A última rodada criada já começou: hora de criar a próxima (que nasce agendada). */
export function dueForNext(lastStartsAt: string, ref: string): boolean {
  return lastStartsAt <= ref;
}

/**
 * Vigência da próxima rodada: N semanas depois da última. Se o cron ficou dias sem rodar,
 * pula as rodadas que já terminaram (não cria pesquisa que nunca iria ao ar).
 */
export function nextOccurrence(
  lastStartsAt: string,
  interval: number,
  duration: number,
  ref: string
): { startsAt: string; endsAt: string } {
  let startsAt = addDays(lastStartsAt, interval * 7);
  while (addDays(startsAt, duration) < ref) startsAt = addDays(startsAt, interval * 7);
  return { startsAt, endsAt: addDays(startsAt, duration) };
}

/** "16/11/2026" → "16/11" (o ano fica implícito no nome da rodada). */
const dayMonth = (date: string) => formatDate(date).slice(0, 5);

/** Nome de cada rodada: o nome da recorrência + a vigência ("CSAT GenieX · 16/11 a 22/11"). */
export function occurrenceName(base: string, startsAt: string, endsAt: string): string {
  return `${base} · ${dayMonth(startsAt)} a ${dayMonth(endsAt)}`;
}

/** Tira o sufixo de vigência de um nome de rodada, para sugerir o nome-base ao duplicar. */
export function baseName(name: string): string {
  return name.replace(/\s·\s\d{2}\/\d{2} a \d{2}\/\d{2}$/, "").trim() || name;
}

/** "Toda semana, de segunda a domingo". */
export function recurrenceLabel(interval: number, startsAt: string, endsAt: string): string {
  const every = isRecurrenceInterval(interval) ? INTERVAL_LABEL[interval] : `A cada ${interval} semanas`;
  const from = weekdayOf(startsAt);
  const to = weekdayOf(endsAt);
  return from === to && startsAt === endsAt ? `${every}, ${from === "sábado" || from === "domingo" ? "no" : "na"} ${from}` : `${every}, de ${from} a ${to}`;
}
