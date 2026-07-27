"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createScheduledReport,
  setScheduledReportActive,
  deleteScheduledReport,
  createPublicReport,
  setPublicReportActive,
  deletePublicReport,
} from "@/lib/db/reports";
import { requireUser, getCurrentProjectId } from "@/lib/auth/current";

/* ---------------- Agendamentos ---------------- */

const scheduleSchema = z.object({
  name: z.string().min(1, "Dê um nome ao envio."),
  recipients: z.array(z.string().email("E-mail inválido.")).min(1, "Informe ao menos um e-mail."),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  period: z.enum(["7d", "30d", "90d", "12m", "all"]),
  format: z.enum(["pdf", "xlsx", "csv"]),
  surveyIds: z.array(z.string()),
});

export async function createScheduleAction(input: unknown) {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const session = await requireUser();
  const projectId = await getCurrentProjectId();
  await createScheduledReport({
    workspaceId: session.workspaceId,
    projectId,
    createdBy: session.userId,
    ...parsed.data,
  });
  revalidatePath("/reports");
  return { ok: true as const };
}

export async function toggleScheduleAction(id: string, active: boolean) {
  const projectId = await getCurrentProjectId();
  await setScheduledReportActive(id, projectId, active);
  revalidatePath("/reports");
  return { ok: true as const };
}

export async function deleteScheduleAction(id: string) {
  const projectId = await getCurrentProjectId();
  await deleteScheduledReport(id, projectId);
  revalidatePath("/reports");
  return { ok: true as const };
}

/* ---------------- Links públicos ---------------- */

const publicLinkSchema = z.object({
  surveyId: z.string().nullable().optional(),
  period: z.enum(["7d", "30d", "90d", "12m", "all"]),
});

export async function createPublicLinkAction(input: unknown) {
  const parsed = publicLinkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Dados inválidos." };
  }
  const session = await requireUser();
  const projectId = await getCurrentProjectId();
  const report = await createPublicReport({
    workspaceId: session.workspaceId,
    projectId,
    createdBy: session.userId,
    surveyId: parsed.data.surveyId ?? null,
    period: parsed.data.period,
  });
  revalidatePath("/reports");
  return { ok: true as const, token: report.token };
}

export async function togglePublicLinkAction(id: string, active: boolean) {
  const projectId = await getCurrentProjectId();
  await setPublicReportActive(id, projectId, active);
  revalidatePath("/reports");
  return { ok: true as const };
}

export async function deletePublicLinkAction(id: string) {
  const projectId = await getCurrentProjectId();
  await deletePublicReport(id, projectId);
  revalidatePath("/reports");
  return { ok: true as const };
}
