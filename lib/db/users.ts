import "server-only";
import { and, count, eq } from "drizzle-orm";
import { db } from "./client";
import { users, memberships, workspaces } from "@/db/schema";
import { newId } from "./ids";
import { hashPassword } from "@/lib/auth/password";
import { createProject } from "./projects";
import { getScopesByMembership, setMembershipProjects } from "./member-projects";

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
  /** projetos que o membro poderá ver; vazio/omisso = todos os projetos do workspace */
  projectIds?: string[];
}) {
  const email = input.email.toLowerCase();
  const userId = newId("usr");
  const membershipId = newId("mem");
  const passwordHash = await hashPassword(input.password);

  await db.insert(users).values({ id: userId, email, name: input.name, passwordHash });
  await db.insert(memberships).values({
    id: membershipId,
    userId,
    workspaceId: input.workspaceId,
    role: input.role,
  });

  if (input.projectIds && input.projectIds.length > 0) {
    await setMembershipProjects(membershipId, input.workspaceId, input.projectIds);
  }
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
 * não pertencer a mais nenhum workspace, a conta em si também é removida, senão
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
      membershipId: memberships.id,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.workspaceId, workspaceId));
}

/**
 * Membros do workspace já com o escopo de projetos de cada um.
 * `projectIds: []` = acesso a todos os projetos (sem restrição) — a mesma convenção da
 * tabela membership_projects. O owner é sempre irrestrito.
 */
export async function listWorkspaceMembersWithScope(workspaceId: string) {
  const [members, scopes] = await Promise.all([
    listWorkspaceMembers(workspaceId),
    getScopesByMembership(workspaceId),
  ]);

  return members.map((m) => ({
    ...m,
    projectIds: m.role === "owner" ? [] : scopes.get(m.membershipId) ?? [],
  }));
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
  // todo workspace nasce com um projeto "Padrão" já com SDK key própria
  await createProject(workspaceId, "Padrão");

  return { userId, workspaceId };
}
