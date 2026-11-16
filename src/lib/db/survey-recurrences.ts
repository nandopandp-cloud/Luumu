import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { surveyRecurrences, surveys, workspaces } from "@/lib/db/schema";
import { surveyRecurrenceId } from "./ids";
import { duplicateSurvey } from "./surveys";
import { DEFAULT_TIMEZONE, today } from "@/lib/surveys/schedule";
import { dueForNext, nextOccurrence, occurrenceName } from "@/lib/surveys/recurrence";

/*
  Pesquisas recorrentes (regra em lib/surveys/recurrence.ts). Cada recorrência guarda o modelo
  (a última rodada criada) e a data de início dela; advanceRecurrences cria a próxima rodada,
  já publicada e agendada, assim que a última começa. Roda no cron diário e ao abrir a lista
  de pesquisas.

  Excluir uma rodada agendada pula aquela rodada: a seguinte é criada a partir da anterior.
  Sem a migração 0047 as leituras devolvem null e a tela trata como "recorrência indisponível".
*/

export type RecurrenceRow = typeof surveyRecurrences.$inferSelect;

/** Recorrências do projeto; null = tabela ainda não existe (migração 0047). */
export async function listRecurrences(projectId: string): Promise<RecurrenceRow[] | null> {
  try {
    return await db.select().from(surveyRecurrences).where(eq(surveyRecurrences.projectId, projectId));
  } catch {
    return null;
  }
}

export async function createRecurrence(input: {
  workspaceId: string;
  projectId: string;
  name: string;
  intervalWeeks: number;
  durationDays: number;
  firstSurveyId: string;
  startsAt: string;
  createdBy: string | null;
}): Promise<string> {
  const id = surveyRecurrenceId();
  await db.insert(surveyRecurrences).values({
    id,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    name: input.name,
    intervalWeeks: input.intervalWeeks,
    durationDays: input.durationDays,
    lastSurveyId: input.firstSurveyId,
    lastStartsAt: input.startsAt,
    surveyIds: [input.firstSurveyId],
    createdBy: input.createdBy,
  });
  return id;
}

/** Para de criar rodadas. As já criadas (inclusive a agendada) continuam como estão. */
export async function stopRecurrence(id: string, projectId: string): Promise<boolean> {
  const r = await db
    .update(surveyRecurrences)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(surveyRecurrences.id, id), eq(surveyRecurrences.projectId, projectId)))
    .returning({ id: surveyRecurrences.id });
  return r.length > 0;
}

/** Modelo da próxima rodada: a última criada; se foi excluída, a mais recente que ainda existe. */
async function pickTemplate(r: RecurrenceRow): Promise<string | null> {
  const candidates = [r.lastSurveyId, ...[...((r.surveyIds as string[]) ?? [])].reverse()].filter((x): x is string => !!x);
  if (!candidates.length) return null;
  const rows = await db
    .select({ id: surveys.id })
    .from(surveys)
    .where(and(inArray(surveys.id, candidates), eq(surveys.projectId, r.projectId)));
  const existing = new Set(rows.map((x) => x.id));
  return candidates.find((c) => existing.has(c)) ?? null;
}

/** Cria a próxima rodada se for a hora. Devolve a recorrência atualizada (pode haver outra devida em seguida) ou null. */
async function advanceOne(r: RecurrenceRow, ref: string): Promise<RecurrenceRow | null> {
  if (!r.active || !dueForNext(r.lastStartsAt, ref)) return null;
  const next = nextOccurrence(r.lastStartsAt, r.intervalWeeks, r.durationDays, ref);

  // reserva a rodada antes de criar: o cron e a abertura da lista podem rodar juntos
  const claimed = await db
    .update(surveyRecurrences)
    .set({ lastStartsAt: next.startsAt, updatedAt: new Date() })
    .where(and(eq(surveyRecurrences.id, r.id), eq(surveyRecurrences.lastStartsAt, r.lastStartsAt), eq(surveyRecurrences.active, true)))
    .returning({ id: surveyRecurrences.id });
  if (!claimed.length) return null;

  const template = await pickTemplate(r);
  if (!template) {
    // todas as rodadas foram excluídas: não há de onde copiar
    await db.update(surveyRecurrences).set({ active: false, lastStartsAt: r.lastStartsAt, updatedAt: new Date() }).where(eq(surveyRecurrences.id, r.id));
    return null;
  }
  try {
    const newId = await duplicateSurvey(
      template,
      { projectId: r.projectId },
      { name: occurrenceName(r.name, next.startsAt, next.endsAt), startsAt: next.startsAt, endsAt: next.endsAt, publish: true },
      r.createdBy ?? undefined
    );
    await db
      .update(surveyRecurrences)
      .set({ lastSurveyId: newId, surveyIds: sql`${surveyRecurrences.surveyIds} || ${JSON.stringify([newId])}::jsonb`, updatedAt: new Date() })
      .where(eq(surveyRecurrences.id, r.id));
    return { ...r, lastSurveyId: newId, lastStartsAt: next.startsAt, surveyIds: [...((r.surveyIds as string[]) ?? []), newId] };
  } catch (e) {
    // devolve a reserva para tentar de novo na próxima rodada do cron
    await db.update(surveyRecurrences).set({ lastStartsAt: r.lastStartsAt }).where(eq(surveyRecurrences.id, r.id));
    throw e;
  }
}

/**
 * Cria as rodadas devidas (de um projeto ou de todos). Devolve quantas criou; null se a tabela
 * ainda não existe. Uma recorrência com erro não impede as outras.
 */
export async function advanceRecurrences(projectId?: string): Promise<number | null> {
  let rows: (RecurrenceRow & { timezone: string | null })[];
  try {
    rows = await db
      .select({ r: surveyRecurrences, timezone: workspaces.timezone })
      .from(surveyRecurrences)
      .innerJoin(workspaces, eq(workspaces.id, surveyRecurrences.workspaceId))
      .where(and(eq(surveyRecurrences.active, true), projectId ? eq(surveyRecurrences.projectId, projectId) : undefined))
      .then((xs) => xs.map((x) => ({ ...x.r, timezone: x.timezone })));
  } catch {
    return null;
  }
  let created = 0;
  for (const row of rows) {
    const ref = today(row.timezone || DEFAULT_TIMEZONE);
    try {
      // no máximo algumas por vez: se o cron parou, a atual e a próxima (nextOccurrence pula as vencidas)
      let r: RecurrenceRow | null = row;
      for (let i = 0; r && i < 3; i++) {
        r = await advanceOne(r, ref);
        if (r) created++;
      }
    } catch (e) {
      console.error(`[surveys] recorrência ${row.id}:`, e instanceof Error ? e.message.slice(0, 300) : e);
    }
  }
  return created;
}
