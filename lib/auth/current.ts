import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, type SessionData } from "./session";
import { getUserWorkspace } from "@/lib/db/users";
import { getProject, getFirstProject, type ProjectRow } from "@/lib/db/projects";

const PROJECT_COOKIE = "luumu_project";

/** Retorna a sessão atual ou redireciona para /login. Use em Server Components/actions. */
export async function requireUser(): Promise<SessionData> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Atalho para o workspace da sessão atual (o tenant ativo). */
export async function getCurrentWorkspaceId(): Promise<string> {
  const session = await requireUser();
  return session.workspaceId;
}

export type Role = "owner" | "admin" | "editor" | "viewer";

/** Papel do usuário atual no workspace ativo (null se não for membro). Memoizada por request. */
export const getCurrentRole = cache(async (): Promise<Role | null> => {
  const session = await requireUser();
  const m = await getUserWorkspace(session.userId);
  return (m?.role as Role) ?? null;
});

/** Garante que o usuário atual pode administrar o workspace (owner ou admin). */
export async function canManageWorkspace(): Promise<boolean> {
  const role = await getCurrentRole();
  return role === "owner" || role === "admin";
}

/**
 * Projeto ativo do usuário: lê o cookie `luumu_project`, valida que pertence ao
 * workspace da sessão e, se inválido/ausente, cai no primeiro projeto do workspace.
 * Todo workspace tem ao menos um projeto (criado no signup), então isto raramente é null.
 * Memoizada por request (React.cache): layout + cada page filha chamam isto (direta ou
 * indiretamente via getCurrentProjectId) na mesma navegação — sem cache, cada chamada
 * refaz a query de projeto do zero.
 */
export const getCurrentProject = cache(async (): Promise<ProjectRow | null> => {
  const session = await requireUser();
  const store = await cookies();
  const cookieId = store.get(PROJECT_COOKIE)?.value;

  if (cookieId) {
    const p = await getProject(cookieId, session.workspaceId);
    if (p) return p;
  }
  return getFirstProject(session.workspaceId);
});

/** Atalho para o id do projeto ativo (ou lança se o workspace não tiver projeto). */
export async function getCurrentProjectId(): Promise<string> {
  const p = await getCurrentProject();
  if (!p) throw new Error("Workspace sem projeto ativo.");
  return p.id;
}

export const PROJECT_COOKIE_NAME = PROJECT_COOKIE;
