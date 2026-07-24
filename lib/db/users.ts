import "server-only";
import { and, count, eq } from "drizzle-orm";
import { db } from "./client";
import { users, memberships, workspaces } from "@/db/schema";
import { newId } from "./ids";
import { hashPassword } from "@/lib/auth/password";
import { createApiKey } from "./keys";

export async function findUserByEmail(email: string) {
  const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return u ?? null;
}

/** Workspace principal do usuário (o primeiro membership). */
export async function getUserWorkspace(userId: string) {
  const [m] = await db
    .select({ workspaceId: memberships.workspaceId, role: memberships.role })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);
  return m ?? null;
}

/**
 * Cria um usuário e o adiciona ao workspace com o papel dado (convite simples).
 * Retorna o userId. Lança se o e-mail já existir (constraint única).
 */
export async function addMemberToWorkspace(input: {
  workspaceId: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "editor" | "viewer";
}) {
  const email = input.email.toLowerCase();
  const userId = newId("usr");
  const passwordHash = await hashPassword(input.password);

  await db.insert(users).values({ id: userId, email, name: input.name, passwordHash });
  await db.insert(memberships).values({
    id: newId("mem"),
    userId,
    workspaceId: input.workspaceId,
    role: input.role,
  });
  return userId;
}

/** Membership de um usuário específico dentro de um workspace (ou null). */
export async function getMembership(workspaceId: string, userId: string) {
  const [m] = await db
    .select({ id: memberships.id, role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
    .limit(1);
  return m ?? null;
}

/**
 * Remove um membro do workspace (deleta a membership). Se, depois disso, o usuário
 * não pertencer a mais nenhum workspace, a conta em si também é removida — senão
 * ficaria uma conta "fantasma" sem acesso a nada.
 */
export async function removeMemberFromWorkspace(workspaceId: string, userId: string) {
  await db
    .delete(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)));

  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(memberships)
    .where(eq(memberships.userId, userId));

  if (Number(n) === 0) {
    await db.delete(users).where(eq(users.id, userId));
  }
}

export async function listWorkspaceMembers(workspaceId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.workspaceId, workspaceId));
}

/**
 * Cria usuário + workspace + membership(owner) + par de SDK keys.
 * Retorna { userId, workspaceId }.
 */
export async function createAccount(input: { name: string; email: string; password: string; workspaceName?: string }) {
  const email = input.email.toLowerCase();
  const userId = newId("usr");
  const workspaceId = newId("ws");
  const passwordHash = await hashPassword(input.password);

  await db.insert(users).values({ id: userId, email, name: input.name, passwordHash });
  await db.insert(workspaces).values({
    id: workspaceId,
    name: input.workspaceName || `Workspace de ${input.name.split(" ")[0]}`,
    slug: workspaceId.replace("ws_", ""),
    plan: "growth",
  });
  await db.insert(memberships).values({
    id: newId("mem"),
    userId,
    workspaceId,
    role: "owner",
  });
  await createApiKey(workspaceId, "Default");

  return { userId, workspaceId };
}
