import "server-only";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "./client";
import { scheduledReports, publicReports } from "@/db/schema";
import { scheduledReportId, publicReportId, publicReportToken } from "./ids";

export type ScheduledReportRow = typeof scheduledReports.$inferSelect;
export type PublicReportRow = typeof publicReports.$inferSelect;

export type Frequency = "daily" | "weekly" | "monthly";

/** Próxima data de envio a partir de agora, conforme a frequência. */
export function computeNextRun(frequency: Frequency, from = new Date()): Date {
  const d = new Date(from);
  // envia sempre por volta das 8h (horário do servidor) do próximo ciclo
  d.setHours(8, 0, 0, 0);
  if (d <= from) d.setDate(d.getDate() + 1); // se já passou das 8h hoje, começa amanhã
  if (frequency === "weekly") {
    // próxima segunda-feira
    const day = d.getDay(); // 0 = domingo
    const daysUntilMonday = (8 - day) % 7 || 7;
    d.setDate(d.getDate() + daysUntilMonday - 1);
  } else if (frequency === "monthly") {
    // dia 1 do próximo mês
    d.setMonth(d.getMonth() + 1, 1);
  }
  return d;
}

/* ---------------- Agendamentos ---------------- */

export async function listScheduledReports(projectId: string): Promise<ScheduledReportRow[]> {
  return db
    .select()
    .from(scheduledReports)
    .where(eq(scheduledReports.projectId, projectId))
    .orderBy(desc(scheduledReports.createdAt));
}

export async function createScheduledReport(input: {
  workspaceId: string;
  projectId: string;
  name: string;
  recipients: string[];
  frequency: Frequency;
  period: string;
  format: string;
  surveyIds: string[];
  createdBy: string;
}): Promise<string> {
  const id = scheduledReportId();
  await db.insert(scheduledReports).values({
    id,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    name: input.name,
    recipients: input.recipients,
    frequency: input.frequency,
    period: input.period,
    format: input.format,
    surveyIds: input.surveyIds,
    active: true,
    nextRunAt: computeNextRun(input.frequency),
    createdBy: input.createdBy,
  });
  return id;
}

export async function setScheduledReportActive(id: string, projectId: string, active: boolean) {
  await db
    .update(scheduledReports)
    .set({ active })
    .where(and(eq(scheduledReports.id, id), eq(scheduledReports.projectId, projectId)));
}

export async function deleteScheduledReport(id: string, projectId: string) {
  await db.delete(scheduledReports).where(and(eq(scheduledReports.id, id), eq(scheduledReports.projectId, projectId)));
}

/** Agendamentos ativos cujo próximo envio já venceu — usados pelo cron. Sem escopo de tenant. */
export async function listDueScheduledReports(now = new Date()): Promise<ScheduledReportRow[]> {
  return db
    .select()
    .from(scheduledReports)
    .where(and(eq(scheduledReports.active, true), lte(scheduledReports.nextRunAt, now)));
}

/** Marca um agendamento como enviado e agenda o próximo ciclo. */
export async function markScheduledReportRun(id: string, frequency: Frequency, now = new Date()) {
  await db
    .update(scheduledReports)
    .set({ lastRunAt: now, nextRunAt: computeNextRun(frequency, now) })
    .where(eq(scheduledReports.id, id));
}

/* ---------------- Links públicos ---------------- */

export async function listPublicReports(projectId: string): Promise<PublicReportRow[]> {
  return db
    .select()
    .from(publicReports)
    .where(eq(publicReports.projectId, projectId))
    .orderBy(desc(publicReports.createdAt));
}

export async function createPublicReport(input: {
  workspaceId: string;
  projectId: string;
  surveyId: string | null;
  period: string;
  createdBy: string;
}): Promise<PublicReportRow> {
  const [row] = await db
    .insert(publicReports)
    .values({
      id: publicReportId(),
      token: publicReportToken(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      surveyId: input.surveyId,
      period: input.period,
      createdBy: input.createdBy,
    })
    .returning();
  return row;
}

export async function setPublicReportActive(id: string, projectId: string, active: boolean) {
  await db
    .update(publicReports)
    .set({ active })
    .where(and(eq(publicReports.id, id), eq(publicReports.projectId, projectId)));
}

export async function deletePublicReport(id: string, projectId: string) {
  await db.delete(publicReports).where(and(eq(publicReports.id, id), eq(publicReports.projectId, projectId)));
}

/** Busca um link público ativo pelo token (usado na página pública, sem auth). */
export async function getPublicReportByToken(token: string): Promise<PublicReportRow | null> {
  const [row] = await db
    .select()
    .from(publicReports)
    .where(and(eq(publicReports.token, token), eq(publicReports.active, true)))
    .limit(1);
  return row ?? null;
}

/** Incrementa o contador de visualizações (best-effort, não bloqueia a renderização). */
export async function incrementPublicReportViews(id: string) {
  await db
    .update(publicReports)
    .set({ viewCount: sql`${publicReports.viewCount} + 1` })
    .where(eq(publicReports.id, id));
}
