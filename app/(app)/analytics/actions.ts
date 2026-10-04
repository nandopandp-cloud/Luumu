"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageWorkspace, getCurrentProjectId, getCurrentRole, requireUser } from "@/lib/auth/current";
import { createView, deleteView, getAnalyticsUserProfile, listAnalyticsEvents, saveAnalyticsSettings, updateView } from "@/lib/db/analytics";
import { parseViewConfig } from "@/lib/analytics/core";

type Result = { ok: true; id?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

/** Liga/desliga a coleta de Analytics no projeto ativo. Só owner/admin. */
export async function setAnalyticsEnabledAction(enabled: boolean): Promise<Result> {
  const session = await requireUser();
  if (!(await canManageWorkspace())) return fail("Só donos e administradores podem mudar a coleta.");
  try {
    await saveAnalyticsSettings(await getCurrentProjectId(), session.userId, { enabled });
  } catch {
    return fail("Não foi possível salvar. A migração do Analytics (0020) já foi aplicada?");
  }
  revalidatePath("/analytics");
  return { ok: true };
}

const eventName = z
  .string()
  .regex(/^[a-z0-9_:.-]{1,64}$/)
  .nullable();
const metricsSchema = z.object({
  northStarEvent: eventName,
  activationEvent: eventName,
  taskStartEvent: eventName,
  taskDoneEvent: eventName,
});

/** North Star, ativação e tarefa (início/conclusão) = eventos do produto. Editores ou acima. */
export async function saveMetricsAction(input: unknown): Promise<Result> {
  const session = await requireUser();
  const role = await getCurrentRole();
  if (role !== "owner" && role !== "admin" && role !== "editor") return fail("Você não tem permissão para configurar as métricas.");
  const p = metricsSchema.safeParse(input);
  if (!p.success) return fail("Escolha eventos válidos.");
  await saveAnalyticsSettings(await getCurrentProjectId(), session.userId, p.data);
  revalidatePath("/analytics");
  return { ok: true };
}

const viewSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome à visão.").max(60),
  goal: z.string().trim().max(160).default(""),
  shared: z.boolean().default(false),
  config: z.unknown(),
});

export async function createViewAction(input: unknown): Promise<Result> {
  const session = await requireUser();
  const p = viewSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const id = await createView(await getCurrentProjectId(), session.userId, { ...p.data, config: parseViewConfig(p.data.config) });
  revalidatePath("/analytics");
  return { ok: true, id };
}

export async function updateViewAction(id: string, input: unknown): Promise<Result> {
  const session = await requireUser();
  const p = viewSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  await updateView(await getCurrentProjectId(), session.userId, id, { ...p.data, config: parseViewConfig(p.data.config) });
  revalidatePath("/analytics");
  return { ok: true, id };
}

export async function deleteViewAction(id: string): Promise<Result> {
  const session = await requireUser();
  await deleteView(await getCurrentProjectId(), session.userId, id);
  revalidatePath("/analytics");
  return { ok: true };
}

/** Eventos reais do projeto (para o diálogo de métricas): carregados só quando ele abre. */
export async function listMetricEventsAction(): Promise<string[]> {
  await requireUser();
  return listAnalyticsEvents(await getCurrentProjectId()).catch(() => []);
}

/** Perfil de um usuário do projeto ativo (aba Usuários). */
export async function getUserProfileAction(anonId: string) {
  await requireUser();
  if (typeof anonId !== "string" || !/^[A-Za-z0-9_-]{6,64}$/.test(anonId)) return null;
  return getAnalyticsUserProfile(await getCurrentProjectId(), anonId);
}
