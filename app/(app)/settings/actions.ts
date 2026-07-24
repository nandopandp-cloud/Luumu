"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, canManageWorkspace, getCurrentRole } from "@/lib/auth/current";
import { updateWorkspace } from "@/lib/db/workspace";
import { addMemberToWorkspace, findUserByEmail, getMembership, removeMemberFromWorkspace } from "@/lib/db/users";

export type ActionResult = { ok: boolean; error?: string };

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(80, "Nome muito longo."),
  slug: z.string().trim().min(1, "Informe uma URL.").max(48),
  timezone: z.string().trim().min(1),
  logoUrl: z.string().url().nullable().optional(),
});

/** Salva nome, URL, fuso e logo do workspace. Só owner/admin. */
export async function saveWorkspaceAction(input: unknown): Promise<ActionResult> {
  const { workspaceId } = await requireUser();
  if (!(await canManageWorkspace())) {
    return { ok: false, error: "Você não tem permissão para editar o workspace." };
  }

  const parsed = workspaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const slug = slugify(parsed.data.slug) || slugify(parsed.data.name);
  if (!slug) return { ok: false, error: "URL inválida." };

  await updateWorkspace(workspaceId, {
    name: parsed.data.name,
    slug,
    timezone: parsed.data.timezone,
    ...(parsed.data.logoUrl !== undefined ? { logoUrl: parsed.data.logoUrl } : {}),
  });

  revalidatePath("/settings");
  return { ok: true };
}

const memberSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  email: z.string().trim().email("E-mail inválido."),
  password: z.string().min(6, "A senha temporária precisa ter ao menos 6 caracteres."),
  role: z.enum(["admin", "editor", "viewer"]),
});

/** Convite simples: cria um membro no workspace com senha temporária. Só owner/admin. */
export async function inviteMemberAction(input: unknown): Promise<ActionResult> {
  const { workspaceId } = await requireUser();
  if (!(await canManageWorkspace())) {
    return { ok: false, error: "Você não tem permissão para convidar membros." };
  }

  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) return { ok: false, error: "Já existe uma conta com este e-mail." };

  try {
    await addMemberToWorkspace({ workspaceId, ...parsed.data });
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "23505") {
      return { ok: false, error: "Já existe uma conta com este e-mail." };
    }
    throw err;
  }

  revalidatePath("/settings/members");
  return { ok: true };
}

/**
 * Remove um membro do workspace. Regras:
 * - só owner/admin podem remover;
 * - ninguém remove a si mesmo por aqui;
 * - o owner nunca pode ser removido (o workspace precisa de um dono);
 * - um admin não pode remover outro admin (só editor/viewer) — evita que
 *   admins se removam entre si; só o owner pode remover admins.
 */
export async function removeMemberAction(targetUserId: string): Promise<ActionResult> {
  const { workspaceId, userId } = await requireUser();

  if (targetUserId === userId) {
    return { ok: false, error: "Você não pode remover a si mesmo." };
  }

  const myRole = await getCurrentRole();
  if (myRole !== "owner" && myRole !== "admin") {
    return { ok: false, error: "Você não tem permissão para remover membros." };
  }

  const target = await getMembership(workspaceId, targetUserId);
  if (!target) return { ok: false, error: "Membro não encontrado." };

  if (target.role === "owner") {
    return { ok: false, error: "O owner do workspace não pode ser removido." };
  }
  if (target.role === "admin" && myRole !== "owner") {
    return { ok: false, error: "Apenas o owner pode remover um admin." };
  }

  await removeMemberFromWorkspace(workspaceId, targetUserId);
  revalidatePath("/settings/members");
  return { ok: true };
}
