import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, type SessionData } from "./session";
import { getUserWorkspace } from "@/lib/db/users";
import { getProject, getFirstProject, type ProjectRow } from "@/lib/db/projects";
import { getUserProjectScope, listProjectsForUser } from "@/lib/db/member-projects";

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

/**
 * Projetos que o usuário atual pode acessar: null = todos (sem restrição).
 * Memoizada por request — o layout, o guard de projeto ativo e as páginas de
 * configuração consultam o mesmo escopo na mesma navegação.
 */
export const getProjectScope = cache(async (): Promise<string[] | null> => {
  const session = await requireUser();
  return getUserProjectScope(session.workspaceId, session.userId);
});

/** Projetos visíveis ao usuário atual (já com o escopo aplicado). Memoizada por request. */
export const getVisibleProjects = cache(async () => {
  const session = await requireUser();
  return listProjectsForUser(session.workspaceId, session.userId);
});

/** True se o usuário atual pode acessar o projeto informado. */
export async function canAccessProject(projectId: string): Promise<boolean> {
  const scope = await getProjectScope();
  return scope === null || scope.includes(projectId);
}

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
 * Projeto ativo do usuário: lê o cookie `luumu_project`, valida que pertence ao workspace
 * da sessão E ao escopo de projetos do membro; se inválido/ausente, cai no projeto acessível
 * mais antigo. É null apenas quando o membro não tem nenhum projeto no escopo.
 * Memoizada por request (React.cache): layout + cada page filha chamam isto (direta ou
 * indiretamente via getCurrentProjectId) na mesma navegação — sem cache, cada chamada
 * refaz a query de projeto do zero.
 */
export const getCurrentProject = cache(async (): Promise<ProjectRow | null> => {
  const session = await requireUser();
  const [store, scope] = await Promise.all([cookies(), getProjectScope()]);
  const cookieId = store.get(PROJECT_COOKIE)?.value;

  // membro restrito a nenhum projeto não tem projeto ativo
  if (scope !== null && scope.length === 0) return null;

  // o cookie é escolha do usuário, não credencial: além de conferir o workspace,
  // exigimos que o projeto esteja no escopo do membro. Sem isso, um membro restrito
  // trocaria de projeto só reescrevendo o cookie.
  if (cookieId && (scope === null || scope.includes(cookieId))) {
    const p = await getProject(cookieId, session.workspaceId);
    if (p) return p;
  }

  if (scope === null) return getFirstProject(session.workspaceId);

  // fallback dentro do escopo: o projeto permitido mais antigo
  const [first] = await getVisibleProjects();
  return first ?? null;
});

/** Atalho para o id do projeto ativo (ou lança se o workspace não tiver projeto). */
export async function getCurrentProjectId(): Promise<string> {
  const p = await getCurrentProject();
  if (!p) throw new Error("Nenhum projeto acessível para este usuário.");
  return p.id;
}

export const PROJECT_COOKIE_NAME = PROJECT_COOKIE;
