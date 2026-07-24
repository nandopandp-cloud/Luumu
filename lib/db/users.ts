import "server-only";
import { eq } from "drizzle-orm";
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
