import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionData } from "./session";

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
