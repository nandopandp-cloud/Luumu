"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProjectId, getCurrentWorkspaceId, requireUser } from "@/lib/auth/current";
import {
  createTour,
  deleteTour,
  duplicateTour,
  publishTour,
  renameTour,
  restoreTourVersion,
  saveTourDraft,
  setTourStatus,
  getTourEditor,
} from "@/lib/db/tours";
import { signTourToken } from "@/lib/tours/token";
import { listRegistry } from "@/lib/db/product-registry";
import { safeUrl } from "@/lib/tours/normalize";
import { normalizeHost } from "@/lib/hosts";

/*
  Ações do painel de tours. O projeto vem SEMPRE da sessão (getCurrentProjectId, já com o
  escopo do membro); o id do tour vindo do cliente só é usado depois de lib/db/tours conferir
  que ele pertence a esse projeto.
*/

const nameSchema = z.string().trim().min(1, "Dê um nome ao tour.").max(120, "Nome muito longo.");

const createSchema = z.object({
  name: nameSchema,
  description: z.string().max(300).optional(),
  startUrl: z.string().max(1000).optional(),
});

export async function createTourAction(input: unknown) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const startUrl = parsed.data.startUrl ? safeUrl(parsed.data.startUrl) : "";
  if (parsed.data.startUrl && !startUrl) return { ok: false as const, error: "Informe um endereço válido (https://...)." };
  const [workspaceId, projectId, user] = await Promise.all([getCurrentWorkspaceId(), getCurrentProjectId(), requireUser()]);
  const host = startUrl ? normalizeHost(startUrl) : "";
  const id = await createTour({
    workspaceId,
    projectId,
    userId: user.userId,
    name: parsed.data.name,
    description: parsed.data.description,
    startUrl: startUrl ?? "",
    // o tour nasce restrito à plataforma do endereço informado (editável em Público e gatilho)
    targetHosts: host ? [host] : [],
  });
  revalidatePath("/tours");
  return { ok: true as const, id };
}

const saveSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(120).optional(),
  description: z.string().max(300).optional(),
  settings: z.unknown().optional(),
  steps: z.array(z.unknown()).max(50).optional(),
});

/** Salva o rascunho (passos e/ou configurações). Nunca altera o que está publicado. */
export async function saveTourDraftAction(input: unknown) {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos." };
  const projectId = await getCurrentProjectId();
  const { id, ...patch } = parsed.data;
  const saved = await saveTourDraft(id, projectId, patch);
  if (!saved) return { ok: false as const, error: "Tour não encontrado." };
  revalidatePath(`/tours/${id}`, "layout");
  revalidatePath("/tours");
  return { ok: true as const, steps: saved.steps, settings: saved.settings, savedAt: Date.now() };
}

export async function publishTourAction(id: string) {
  const [projectId, user] = await Promise.all([getCurrentProjectId(), requireUser()]);
  const res = await publishTour(id, projectId, user.userId);
  revalidatePath(`/tours/${id}`, "layout");
  revalidatePath("/tours");
  return res;
}

export async function restoreTourVersionAction(id: string, versionId: string) {
  const projectId = await getCurrentProjectId();
  const ok = await restoreTourVersion(id, projectId, versionId);
  revalidatePath(`/tours/${id}`, "layout");
  return ok ? { ok: true as const } : { ok: false as const, error: "Versão não encontrada." };
}

export async function setTourStatusAction(id: string, status: "archived" | "active" | "paused") {
  const projectId = await getCurrentProjectId();
  const ok = await setTourStatus(id, projectId, status);
  revalidatePath(`/tours/${id}`, "layout");
  revalidatePath("/tours");
  return { ok };
}

export async function renameTourAction(id: string, name: string) {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const projectId = await getCurrentProjectId();
  const ok = await renameTour(id, projectId, parsed.data);
  revalidatePath(`/tours/${id}`, "layout");
  revalidatePath("/tours");
  return ok ? { ok: true as const } : { ok: false as const, error: "Tour não encontrado." };
}

const duplicateSchema = z.object({
  name: nameSchema.optional(),
  // plataformas da cópia; ausente = mantém as do original
  targetHosts: z.array(z.string().max(253)).max(50).optional(),
});

export async function duplicateTourAction(id: string, input: unknown = {}) {
  const parsed = duplicateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const [projectId, user] = await Promise.all([getCurrentProjectId(), requireUser()]);
  const targetHosts = parsed.data.targetHosts && Array.from(new Set(parsed.data.targetHosts.map(normalizeHost).filter(Boolean)));
  const newId = await duplicateTour(id, projectId, user.userId, { name: parsed.data.name, targetHosts });
  revalidatePath("/tours");
  return newId ? { ok: true as const, id: newId } : { ok: false as const, error: "Tour não encontrado." };
}

export async function deleteTourAction(id: string) {
  const projectId = await getCurrentProjectId();
  const ok = await deleteTour(id, projectId);
  revalidatePath("/tours");
  return { ok };
}

const linkSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(["builder", "preview"]),
  url: z.string().max(1000),
  stepKey: z.string().max(60).optional(),
});

/**
 * Gera o link que abre o produto do cliente em modo builder (selecionar elementos) ou
 * preview (rodar o rascunho). O token vai na URL e só vale para este tour, por poucas horas.
 */
export async function createTourLinkAction(input: unknown) {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos." };
  const url = safeUrl(parsed.data.url);
  if (!url) return { ok: false as const, error: "Informe o endereço do produto (https://...)." };
  const [workspaceId, projectId, user] = await Promise.all([getCurrentWorkspaceId(), getCurrentProjectId(), requireUser()]);
  const editor = await getTourEditor(parsed.data.id, projectId);
  if (!editor) return { ok: false as const, error: "Tour não encontrado." };

  const token = await signTourToken({
    mode: parsed.data.mode,
    workspaceId,
    projectId,
    tourId: parsed.data.id,
    userId: user.userId,
    stepKey: parsed.data.stepKey,
  });
  const target = new URL(url);
  target.searchParams.set(parsed.data.mode === "builder" ? "luumu_builder" : "luumu_preview", token);

  // lembra o endereço usado como padrão das próximas aberturas
  if (url !== editor.settings.startUrl) {
    await saveTourDraft(parsed.data.id, projectId, { settings: { ...editor.settings, startUrl: url } }, false);
  }
  return { ok: true as const, url: target.toString() };
}

/** Rascunho atual (o Construtor relê depois que o overlay do builder adiciona passos). */
export async function getTourDraftAction(id: string) {
  const projectId = await getCurrentProjectId();
  const editor = await getTourEditor(id, projectId);
  return editor ? { ok: true as const, steps: editor.steps, settings: editor.settings } : { ok: false as const };
}

/** Elementos descobertos no produto (Element Registry), para escolher o alvo de um passo. */
export async function listRegistryAction(host?: string) {
  const projectId = await getCurrentProjectId();
  const items = await listRegistry(projectId, host ? normalizeHost(host) || undefined : undefined);
  return items.map((i) => ({ ...i, lastSeenAt: i.lastSeenAt.toISOString() }));
}
