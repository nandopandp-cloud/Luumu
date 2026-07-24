import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionData } from "./session";
import { getUserWorkspace } from "@/lib/db/users";

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

/** Papel do usuário atual no workspace ativo (null se não for membro). */
export async function getCurrentRole(): Promise<Role | null> {
  const session = await requireUser();
  const m = await getUserWorkspace(session.userId);
  return (m?.role as Role) ?? null;
}

/** Garante que o usuário atual pode administrar o workspace (owner ou admin). */
export async function canManageWorkspace(): Promise<boolean> {
  const role = await getCurrentRole();
  return role === "owner" || role === "admin";
}
