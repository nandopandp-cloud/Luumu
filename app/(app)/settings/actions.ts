"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, canManageWorkspace, getCurrentRole } from "@/lib/auth/current";
import { updateWorkspace } from "@/lib/db/workspace";
import {
  addMemberToWorkspace,
  findUserByEmail,
  getMembership,
  removeMemberFromWorkspace,
  updateMemberRole,
} from "@/lib/db/users";
import { setMembershipProjects } from "@/lib/db/member-projects";

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
  // projetos visíveis ao membro; [] = todos os projetos do workspace
  projectIds: z.array(z.string()).default([]),
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

  // escopo de projetos é prerrogativa do owner (ver setMemberProjectsAction); no convite
  // feito por um admin o campo é ignorado e o membro nasce com acesso a todos os projetos
  const isOwner = (await getCurrentRole()) === "owner";
  const projectIds = isOwner ? parsed.data.projectIds : [];

  try {
    await addMemberToWorkspace({ workspaceId, ...parsed.data, projectIds });
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "23505") {
      return { ok: false, error: "Já existe uma conta com este e-mail." };
    }
    throw err;
  }

  revalidatePath("/settings/members");
  return { ok: true };
}

const scopeSchema = z.object({
  projectIds: z.array(z.string()),
});

/**
 * Define quais projetos um membro enxerga. Lista vazia = acesso a todos os projetos
 * (inclusive os criados depois), que é o padrão de quem nunca teve escopo definido.
 *
 * Só o owner pode mexer nisto. Um admin não pode, porque o escopo é justamente o que o
 * limita: se admins editassem escopos, um admin restrito ao projeto X ampliaria o próprio
 * acesso (ou o de um colega) para o workspace inteiro, e a restrição não valeria nada.
 */
export async function setMemberProjectsAction(
  targetUserId: string,
  input: unknown
): Promise<ActionResult> {
  const { workspaceId, userId } = await requireUser();

  if ((await getCurrentRole()) !== "owner") {
    return { ok: false, error: "Apenas o owner pode definir o acesso a projetos." };
  }

  const parsed = scopeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Seleção de projetos inválida." };

  if (targetUserId === userId) {
    return { ok: false, error: "O owner tem acesso a todos os projetos." };
  }

  const target = await getMembership(workspaceId, targetUserId);
  if (!target) return { ok: false, error: "Membro não encontrado." };
  if (target.role === "owner") {
    return { ok: false, error: "O owner tem acesso a todos os projetos." };
  }

  // setMembershipProjects descarta ids fora do workspace; se sobrar nada de uma seleção
  // não-vazia, os ids eram inválidos — salvar viraria "acesso a tudo", o oposto do pedido.
  const saved = await setMembershipProjects(target.id, workspaceId, parsed.data.projectIds);
  if (parsed.data.projectIds.length > 0 && saved.length === 0) {
    return { ok: false, error: "Nenhum dos projetos selecionados pertence a este workspace." };
  }

  revalidatePath("/settings/members");
  revalidatePath("/", "layout");
  return { ok: true };
}

const roleSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]),
});

/**
 * Troca o papel de um membro.
 *
 * Só o owner pode: o papel é o que concede poder no workspace, então deixar admins
 * mexerem nele permitiria um admin promover a si mesmo por tabela ou rebaixar outro
 * admin — a hierarquia deixaria de valer. É a mesma razão de setMemberProjectsAction
 * ser exclusiva do owner.
 *
 * O papel `owner` não entra: não se promove ninguém a owner nem se rebaixa o owner
 * atual, então o workspace segue com exatamente um dono.
 */
export async function setMemberRoleAction(
  targetUserId: string,
  input: unknown
): Promise<ActionResult> {
  const { workspaceId, userId } = await requireUser();

  if ((await getCurrentRole()) !== "owner") {
    return { ok: false, error: "Apenas o owner pode alterar papéis." };
  }

  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Papel inválido." };

  if (targetUserId === userId) {
    return { ok: false, error: "Você não pode alterar o próprio papel." };
  }

  const target = await getMembership(workspaceId, targetUserId);
  if (!target) return { ok: false, error: "Membro não encontrado." };
  if (target.role === "owner") {
    return { ok: false, error: "O papel do owner não pode ser alterado." };
  }
  if (target.role === parsed.data.role) return { ok: true };

  await updateMemberRole(workspaceId, targetUserId, parsed.data.role);

  revalidatePath("/settings/members");
  // o papel muda o que a pessoa pode fazer no app inteiro, não só nesta tela
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Remove um membro do workspace. Regras:
 * - só owner/admin podem remover;
 * - ninguém remove a si mesmo por aqui;
 * - o owner nunca pode ser removido (o workspace precisa de um dono);
 * - um admin não pode remover outro admin (só editor/viewer), evita que
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
