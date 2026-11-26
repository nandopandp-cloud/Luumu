"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditContent, canManageWorkspace, getCurrentProjectId, getCurrentWorkspaceId, requireUser } from "@/lib/auth/current";
import { getWorkspace } from "@/lib/db/workspace";
import {
  deleteNotification,
  duplicateNotification,
  getBellSettings,
  saveBellSettings,
  saveNotification,
  setNotificationStatus,
} from "@/lib/db/notifications";
import {
  draftProblem,
  fromLocalInput,
  isCategory,
  normalizeAudience,
  normalizeBellSettings,
  type NotificationDraft,
} from "@/lib/notifications/model";
import { normalizeHost } from "@/lib/platform/hosts";
import { feedForClass, revealWebhookSecret } from "@/lib/db/notification-activities";
import { classKey, normalizeAuto, type FeedActivity } from "@/lib/notifications/activities";
import { DEFAULT_TIMEZONE } from "@/lib/surveys/schedule";

/*
  Mutações do módulo Notificações. Só owner, admin e editor alteram (leitores veem a tela sem os
  botões, e estas actions recusam de qualquer jeito); tudo no projeto ativo da sessão.
*/

type Result = { ok: true; id?: string } | { ok: false; error: string };
const DENIED: Result = { ok: false, error: "Só editores e administradores podem alterar as notificações." };

async function guard() {
  const [user, allowed, projectId, workspaceId] = await Promise.all([requireUser(), canEditContent(), getCurrentProjectId(), getCurrentWorkspaceId()]);
  return allowed ? { user, projectId, workspaceId } : null;
}

const draftSchema = z.object({
  id: z.string().max(40).optional(),
  title: z.string().max(200),
  body: z.string().max(1000),
  category: z.string(),
  ctaLabel: z.string().max(100),
  ctaUrl: z.string().max(600),
  schoolYears: z.array(z.string()).max(20),
  list: z.array(z.string()).max(5000),
  hosts: z.array(z.string()).max(50),
  pinned: z.boolean(),
  /** "YYYY-MM-DDTHH:mm" no fuso do workspace; "" = assim que publicar / não expira */
  publishAt: z.string().max(20),
  expiresAt: z.string().max(20),
  /** o que fazer: salvar rascunho, enviar para os usuários de teste ou publicar */
  intent: z.enum(["rascunho", "teste", "publicada"]),
});

export async function saveNotificationAction(input: unknown): Promise<Result> {
  const g = await guard();
  if (!g) return DENIED;
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const d = parsed.data;
  const tz = (await getWorkspace(g.workspaceId))?.timezone || DEFAULT_TIMEZONE;
  const draft: NotificationDraft = {
    title: d.title.trim(),
    body: d.body.trim(),
    category: isCategory(d.category) ? d.category : "aviso",
    ctaLabel: d.ctaLabel.trim(),
    ctaUrl: d.ctaUrl.trim(),
    audience: normalizeAudience({ schoolYears: d.schoolYears, list: d.list }),
    hosts: [...new Set(d.hosts.map((h) => normalizeHost(h)).filter((h): h is string => !!h))],
    pinned: d.pinned,
    publishAt: fromLocalInput(d.publishAt, tz),
    expiresAt: fromLocalInput(d.expiresAt, tz),
  };
  const problem = draftProblem(draft, d.intent !== "rascunho");
  if (problem) return { ok: false, error: problem };
  if (d.intent === "teste") {
    const settings = await getBellSettings(g.projectId);
    if (!settings?.testers.length) return { ok: false, error: "Cadastre usuários de teste em Sino e instalação antes de testar." };
  }
  try {
    const id = await saveNotification({ id: d.id, workspaceId: g.workspaceId, projectId: g.projectId, draft, status: d.intent, userId: g.user.userId });
    revalidatePath("/notifications");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível salvar." };
  }
}

const statusSchema = z.object({ id: z.string().max(40), status: z.enum(["rascunho", "publicada", "arquivada"]) });

export async function setNotificationStatusAction(input: unknown): Promise<Result> {
  const g = await guard();
  if (!g) return DENIED;
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const ok = await setNotificationStatus(parsed.data.id, g.projectId, parsed.data.status);
  revalidatePath("/notifications");
  return ok ? { ok: true } : { ok: false, error: "Notificação não encontrada." };
}

export async function duplicateNotificationAction(id: string): Promise<Result> {
  const g = await guard();
  if (!g) return DENIED;
  const copy = await duplicateNotification(String(id), g.projectId, g.user.userId);
  revalidatePath("/notifications");
  return copy ? { ok: true, id: copy } : { ok: false, error: "Notificação não encontrada." };
}

export async function deleteNotificationAction(id: string): Promise<Result> {
  const g = await guard();
  if (!g) return DENIED;
  await deleteNotification(String(id), g.projectId);
  revalidatePath("/notifications");
  return { ok: true };
}

export async function saveBellSettingsAction(input: unknown): Promise<Result> {
  const g = await guard();
  if (!g) return DENIED;
  const s = normalizeBellSettings(input);
  // os avisos automáticos têm a própria aba (saveAutoSettingsAction): aqui ficam como estão gravados
  const current = await getBellSettings(g.projectId);
  if (current) s.auto = current.auto;
  s.hosts = [...new Set(s.hosts.map((h) => normalizeHost(h)).filter((h): h is string => !!h))];
  if (s.placement === "selector" && !s.selector) return { ok: false, error: "Informe o seletor CSS do elemento onde o sino entra." };
  try {
    await saveBellSettings(g.workspaceId, g.projectId, s, g.user.userId);
    revalidatePath("/notifications");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível salvar. A migração drizzle/0048_notifications.sql já foi aplicada?" };
  }
}

/* ---------- avisos automáticos (webhook de atividades) ---------- */

export async function saveAutoSettingsAction(input: unknown): Promise<Result> {
  const g = await guard();
  if (!g) return DENIED;
  const current = await getBellSettings(g.projectId);
  if (!current) return { ok: false, error: "Não foi possível salvar. A migração drizzle/0048_notifications.sql já foi aplicada?" };
  try {
    await saveBellSettings(g.workspaceId, g.projectId, { ...current, auto: normalizeAuto(input) }, g.user.userId);
    revalidatePath("/notifications");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível salvar." };
  }
}

/** Mostra o segredo do webhook (gera na primeira vez). Só donos e administradores: dá acesso de escrita. */
export async function revealWebhookSecretAction(rotate = false): Promise<{ ok: true; secret: string } | { ok: false; error: string }> {
  const [user, allowed, projectId, workspaceId] = await Promise.all([requireUser(), canManageWorkspace(), getCurrentProjectId(), getCurrentWorkspaceId()]);
  if (!allowed) return { ok: false, error: "Só donos e administradores veem o segredo do webhook." };
  try {
    const secret = await revealWebhookSecret(workspaceId, projectId, user.userId, rotate === true);
    revalidatePath("/notifications");
    return { ok: true, secret };
  } catch {
    return { ok: false, error: "Não foi possível gerar o segredo. A migração drizzle/0051_notification_activities.sql já foi aplicada?" };
  }
}

/** "Ver como uma turma": o que o sino dos estudantes desta turma recebe agora (sem cache). */
export async function previewClassFeedAction(classId: string): Promise<{ ok: true; items: FeedActivity[] } | { ok: false; error: string }> {
  await requireUser();
  const projectId = await getCurrentProjectId();
  const c = classKey(classId);
  if (!c) return { ok: false, error: "Informe o id de uma turma, como o GenieX manda no classIds." };
  try {
    return { ok: true, items: await feedForClass(projectId, c) };
  } catch {
    return { ok: false, error: "Não foi possível consultar. A migração drizzle/0051_notification_activities.sql já foi aplicada?" };
  }
}
