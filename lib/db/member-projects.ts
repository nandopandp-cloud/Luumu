import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { memberships, membershipProjects, projects, surveys } from "@/db/schema";
import { membershipProjectId } from "./ids";

/**
 * Escopo de projetos de um membro.
 *
 * Regra central, usada em todo o arquivo: `null` significa "sem restrição" (o membro vê
 * todos os projetos do workspace) e um array significa "somente estes ids". Guardamos a
 * ausência de restrição como ausência de linhas em `membership_projects`, e não como uma
 * linha por projeto, para que projetos criados depois já entrem no escopo de quem tem
 * acesso total — sem precisar reconciliar nada.
 */

/** Ids dos projetos permitidos a uma membership, ou null se não houver restrição. */
export async function getMembershipProjectIds(membershipId: string): Promise<string[] | null> {
  const rows = await db
    .select({ projectId: membershipProjects.projectId })
    .from(membershipProjects)
    .where(eq(membershipProjects.membershipId, membershipId));
  return rows.length === 0 ? null : rows.map((r) => r.projectId);
}

/**
 * Escopo do usuário no workspace: null = todos os projetos.
 * O owner nunca é restringido — mesmo que existam linhas, ele enxerga o workspace inteiro.
 */
export async function getUserProjectScope(
  workspaceId: string,
  userId: string
): Promise<string[] | null> {
  const [m] = await db
    .select({ id: memberships.id, role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
    .limit(1);

  if (!m) return [];
  if (m.role === "owner") return null;
  return getMembershipProjectIds(m.id);
}

/**
 * Define o escopo de uma membership. `projectIds` vazio limpa a restrição (acesso a todos).
 * Só entram ids que realmente pertencem ao workspace, então um id forjado é ignorado em vez
 * de virar uma linha órfã.
 *
 * O delete + insert vai num `db.batch()` (uma única transação no lado do Neon) em vez de
 * `db.transaction()`, que o driver neon-http não implementa. Sem isso, uma falha entre as
 * duas queries deixaria o membro sem nenhuma linha — ou seja, com acesso a TODOS os
 * projetos, o oposto do que se estava salvando.
 */
export async function setMembershipProjects(
  membershipId: string,
  workspaceId: string,
  projectIds: string[]
): Promise<string[]> {
  const valid =
    projectIds.length === 0
      ? []
      : (
          await db
            .select({ id: projects.id })
            .from(projects)
            .where(and(eq(projects.workspaceId, workspaceId), inArray(projects.id, projectIds)))
        ).map((p) => p.id);

  const del = db.delete(membershipProjects).where(eq(membershipProjects.membershipId, membershipId));

  if (valid.length === 0) {
    await del;
  } else {
    await db.batch([
      del,
      db.insert(membershipProjects).values(
        valid.map((projectId) => ({ id: membershipProjectId(), membershipId, projectId }))
      ),
    ]);
  }

  return valid;
}

/**
 * Projetos visíveis ao usuário, com nº de pesquisas — versão com escopo de `listProjects`.
 * Roda no layout compartilhado (toda navegação), por isso mantém 1 query agregada para as
 * contagens em vez de 1 por projeto.
 */
export async function listProjectsForUser(workspaceId: string, userId: string) {
  const scope = await getUserProjectScope(workspaceId, userId);
  if (scope !== null && scope.length === 0) return [];

  const rows = await db
    .select()
    .from(projects)
    .where(
      scope === null
        ? eq(projects.workspaceId, workspaceId)
        : and(eq(projects.workspaceId, workspaceId), inArray(projects.id, scope))
    )
    .orderBy(asc(projects.createdAt));

  if (rows.length === 0) return [];

  const counts = await db
    .select({ projectId: surveys.projectId, n: count() })
    .from(surveys)
    .where(inArray(surveys.projectId, rows.map((p) => p.id)))
    .groupBy(surveys.projectId);

  const countByProject = new Map(counts.map((c) => [c.projectId, Number(c.n)]));
  return rows.map((p) => ({ ...p, surveyCount: countByProject.get(p.id) ?? 0 }));
}

/** Escopo de cada membership do workspace, para montar a tela de membros numa query só. */
export async function getScopesByMembership(workspaceId: string): Promise<Map<string, string[]>> {
  const rows = await db
    .select({
      membershipId: membershipProjects.membershipId,
      projectId: membershipProjects.projectId,
    })
    .from(membershipProjects)
    .innerJoin(memberships, eq(membershipProjects.membershipId, memberships.id))
    .where(eq(memberships.workspaceId, workspaceId));

  const byMembership = new Map<string, string[]>();
  for (const r of rows) {
    const list = byMembership.get(r.membershipId);
    if (list) list.push(r.projectId);
    else byMembership.set(r.membershipId, [r.projectId]);
  }
  return byMembership;
}
