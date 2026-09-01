"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  requireUser,
  canManageWorkspace,
  canAccessProject,
  PROJECT_COOKIE_NAME,
} from "@/lib/auth/current";
import {
  createProject,
  renameProject,
  deleteProject,
  getProject,
  countProjects,
} from "@/lib/db/projects";

export type ProjectResult = { ok: boolean; error?: string };

/**
 * Define o projeto ativo (grava no cookie). Valida que o projeto pertence ao workspace e
 * que está no escopo do membro — a action é um endpoint POST alcançável diretamente, então
 * a checagem não pode depender do switcher só mostrar as opções permitidas.
 */
export async function switchProjectAction(projectId: string): Promise<ProjectResult> {
  const { workspaceId } = await requireUser();
  const project = await getProject(projectId, workspaceId);
  if (!project) return { ok: false, error: "Projeto não encontrado." };
  if (!(await canAccessProject(projectId))) {
    return { ok: false, error: "Você não tem acesso a este projeto." };
  }

  const store = await cookies();
  store.set(PROJECT_COOKIE_NAME, projectId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

const nameSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(60, "Nome muito longo."),
});

/** Cria um projeto no workspace (só owner/admin). Já gera a SDK key própria. */
export async function createProjectAction(input: unknown): Promise<ProjectResult & { projectId?: string }> {
  const { workspaceId } = await requireUser();
  if (!(await canManageWorkspace())) {
    return { ok: false, error: "Você não tem permissão para criar projetos." };
  }
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { projectId } = await createProject(workspaceId, parsed.data.name);
  revalidatePath("/settings");
  return { ok: true, projectId };
}

/** Renomeia um projeto (só owner/admin). */
export async function renameProjectAction(projectId: string, input: unknown): Promise<ProjectResult> {
  const { workspaceId } = await requireUser();
  if (!(await canManageWorkspace())) {
    return { ok: false, error: "Você não tem permissão para editar projetos." };
  }
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const project = await getProject(projectId, workspaceId);
  if (!project) return { ok: false, error: "Projeto não encontrado." };
  if (!(await canAccessProject(projectId))) {
    return { ok: false, error: "Você não tem acesso a este projeto." };
  }

  await renameProject(projectId, workspaceId, parsed.data.name);
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Exclui um projeto (só owner/admin). Não permite excluir o último projeto
 * (o workspace precisa de ao menos um). Cascade remove keys/surveys/eventos/respostas.
 */
export async function deleteProjectAction(projectId: string): Promise<ProjectResult> {
  const { workspaceId } = await requireUser();
  if (!(await canManageWorkspace())) {
    return { ok: false, error: "Você não tem permissão para excluir projetos." };
  }
  const project = await getProject(projectId, workspaceId);
  if (!project) return { ok: false, error: "Projeto não encontrado." };
  if (!(await canAccessProject(projectId))) {
    return { ok: false, error: "Você não tem acesso a este projeto." };
  }

  if ((await countProjects(workspaceId)) <= 1) {
    return { ok: false, error: "O workspace precisa de ao menos um projeto." };
  }

  await deleteProject(projectId, workspaceId);

  // se o projeto excluído era o ativo, limpa o cookie (cai no fallback do 1º)
  const store = await cookies();
  if (store.get(PROJECT_COOKIE_NAME)?.value === projectId) {
    store.delete(PROJECT_COOKIE_NAME);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
