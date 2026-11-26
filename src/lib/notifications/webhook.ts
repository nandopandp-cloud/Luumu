/**
 * Webhook de atividades (POST /api/v1/notifications/webhook): o que o back-end do cliente manda e
 * como cada evento é lido. Puro (sem banco): a rota valida aqui e grava em
 * lib/db/notification-activities.ts. Contrato completo em docs/notifications/INTEGRACAO.md.
 *
 * Três eventos, sempre com a FOTOGRAFIA atual da atividade (não um "diff"):
 *   activity.assigned  liberada para uma ou mais turmas
 *   activity.updated   mudou título, prazo, link ou turmas (substitui tudo o que a Luumu tinha)
 *   activity.canceled  cancelada ou removida: some do sino
 * A ordem vale pelo `occurredAt`: um evento mais antigo que chegue depois não desfaz um mais novo.
 */
import { ACTIVITY_LIMITS, classKey, isActivityType, type ActivityType } from "./activities";
import { validUrl } from "./model";

export const WEBHOOK_EVENTS = ["activity.assigned", "activity.updated", "activity.canceled"] as const;
export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number];

/** Até 100 eventos por requisição (carga inicial, reenvio de fila). */
export const MAX_EVENTS_PER_REQUEST = 100;
/** Corpo maior que isso é recusado (413). */
export const MAX_BODY_BYTES = 512 * 1024;

export interface ActivitySnapshot {
  id: string;
  type: ActivityType;
  title: string;
  subject: string | null;
  url: string;
  assignedAt: Date;
  dueAt: Date | null;
  classIds: string[];
}

export type ParsedEvent =
  | { ok: true; id: string; event: "activity.assigned" | "activity.updated"; occurredAt: Date; activity: ActivitySnapshot }
  | { ok: true; id: string; event: "activity.canceled"; occurredAt: Date; activity: { id: string } }
  | { ok: false; id: string | null; event: string | null; activityId: string | null; error: string };

// ISO 8601 com fuso explícito: "2026-11-26T10:00:00-03:00" ou "...Z" (sem fuso o horário é ambíguo)
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;

function isoDate(v: unknown): Date | null {
  if (typeof v !== "string" || !ISO.test(v)) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t) : null;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");

/** Um evento → evento válido, ou o primeiro problema dele (em português, vai na resposta). */
export function parseEvent(raw: unknown, now = Date.now()): ParsedEvent {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const id = str(o.id);
  const event = typeof o.event === "string" ? o.event : null;
  const act = (o.activity && typeof o.activity === "object" ? o.activity : {}) as Record<string, unknown>;
  const activityId = str(act.id);
  const fail = (error: string): ParsedEvent => ({ ok: false, id: id || null, event, activityId: activityId || null, error });

  if (!id) return fail('"id" (identificador único do evento) é obrigatório.');
  if (id.length > ACTIVITY_LIMITS.id) return fail(`"id" passa de ${ACTIVITY_LIMITS.id} caracteres.`);
  if (!event || !(WEBHOOK_EVENTS as readonly string[]).includes(event)) return fail(`"event" precisa ser ${WEBHOOK_EVENTS.join(", ")}.`);
  const occurredAt = isoDate(o.occurredAt);
  if (!occurredAt) return fail('"occurredAt" precisa ser uma data ISO 8601 com fuso (ex.: 2026-11-26T10:00:00-03:00).');
  if (occurredAt.getTime() > now + 24 * 3600_000) return fail('"occurredAt" está mais de 1 dia no futuro: confira o relógio do servidor.');
  if (!activityId) return fail('"activity.id" é obrigatório.');
  if (activityId.length > ACTIVITY_LIMITS.id) return fail(`"activity.id" passa de ${ACTIVITY_LIMITS.id} caracteres.`);

  if (event === "activity.canceled") return { ok: true, id, event, occurredAt, activity: { id: activityId } };

  if (!isActivityType(act.type)) return fail('"activity.type" precisa ser "tarefa" ou "prova_genial".');
  const title = str(act.title);
  if (!title) return fail('"activity.title" é obrigatório.');
  if (title.length > ACTIVITY_LIMITS.title) return fail(`"activity.title" passa de ${ACTIVITY_LIMITS.title} caracteres.`);
  const subject = str(act.subject);
  if (subject.length > ACTIVITY_LIMITS.subject) return fail(`"activity.subject" passa de ${ACTIVITY_LIMITS.subject} caracteres.`);
  const url = str(act.url);
  if (!url || !validUrl(url)) return fail('"activity.url" precisa ser um caminho do produto começando com "/" (ou um endereço https).');

  let assignedAt = occurredAt;
  if (act.assignedAt !== undefined && act.assignedAt !== null) {
    const d = isoDate(act.assignedAt);
    if (!d) return fail('"activity.assignedAt" precisa ser uma data ISO 8601 com fuso.');
    assignedAt = d;
  }
  let dueAt: Date | null = null;
  if (act.dueAt !== undefined && act.dueAt !== null) {
    dueAt = isoDate(act.dueAt);
    if (!dueAt) return fail('"activity.dueAt" precisa ser uma data ISO 8601 com fuso, ou null.');
  }

  if (!Array.isArray(o.classIds)) return fail('"classIds" (lista das turmas que recebem a atividade) é obrigatório.');
  if (o.classIds.length > ACTIVITY_LIMITS.classes) return fail(`"classIds" passa de ${ACTIVITY_LIMITS.classes} turmas.`);
  const classIds = [...new Set(o.classIds.map(classKey))];
  if (classIds.includes("")) return fail(`Cada turma em "classIds" precisa ser um texto de até ${ACTIVITY_LIMITS.classId} caracteres.`);
  // sem turma nenhuma, ninguém vê: para tirar do ar use activity.canceled
  if (event === "activity.assigned" && !classIds.length) return fail('"classIds" não pode ser vazio em activity.assigned.');

  return {
    ok: true,
    id,
    event: event as "activity.assigned" | "activity.updated",
    occurredAt,
    activity: { id: activityId, type: act.type, title, subject: subject || null, url, assignedAt, dueAt, classIds },
  };
}

/** O corpo: um evento sozinho, ou { events: [...] } com até 100. null = formato irreconhecível. */
export function eventsOf(body: unknown): unknown[] | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (Array.isArray(o.events)) return o.events.length >= 1 && o.events.length <= MAX_EVENTS_PER_REQUEST ? o.events : null;
  return "event" in o ? [o] : null;
}

/** Resultado de cada evento na resposta do webhook. */
export type EventOutcome = "applied" | "stale" | "duplicate" | "invalid";

export const OUTCOME_LABEL: Record<EventOutcome | "unauthorized", string> = {
  applied: "Aplicado",
  stale: "Ignorado (mais antigo)",
  duplicate: "Repetido",
  invalid: "Recusado",
  unauthorized: "Assinatura inválida",
};
