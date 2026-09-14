import "server-only";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./client";
import { apiKeys, projects, surveys } from "@/db/schema";
import { projectId as newProjectId } from "./ids";
import { createApiKey } from "./keys";
import { invalidateKeyCache } from "@/lib/api/keys";

export type ProjectRow = typeof projects.$inferSelect;

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/**
 * Projetos do workspace (mais antigos primeiro) com nº de pesquisas.
 * Roda no layout compartilhado (app/(app)/layout.tsx), ou seja, em toda navegação —
 * por isso usa 1 única query agregada (GROUP BY) em vez de 1 query por projeto.
 */
export async function listProjects(workspaceId: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(asc(projects.createdAt));

  if (rows.length === 0) return [];

  const ids = rows.map((p) => p.id);
  const [counts, keys] = await Promise.all([
    db
      .select({ projectId: surveys.projectId, n: count() })
      .from(surveys)
      .where(inArray(surveys.projectId, ids))
      .groupBy(surveys.projectId),
    db
      .select({ projectId: apiKeys.projectId, domains: apiKeys.domains, createdAt: apiKeys.createdAt })
      .from(apiKeys)
      .where(and(inArray(apiKeys.projectId, ids), isNull(apiKeys.revokedAt)))
      .orderBy(asc(apiKeys.createdAt)),
  ]);

  const countByProject = new Map(counts.map((c) => [c.projectId, Number(c.n)]));
  // a URL do projeto mora na allowlist da key primária (a mais antiga ativa)
  const domainsByProject = new Map<string, string[]>();
  for (const k of keys) {
    if (!domainsByProject.has(k.projectId)) {
      domainsByProject.set(k.projectId, (k.domains as string[]) ?? []);
    }
  }

  return rows.map((p) => ({
    ...p,
    surveyCount: countByProject.get(p.id) ?? 0,
    domains: domainsByProject.get(p.id) ?? [],
  }));
}

/** Domínios (URLs) autorizados do projeto, lidos da key primária ativa. */
export async function getProjectDomains(projectId: string): Promise<string[]> {
  const [k] = await db
    .select({ domains: apiKeys.domains })
    .from(apiKeys)
    .where(and(eq(apiKeys.projectId, projectId), isNull(apiKeys.revokedAt)))
    .orderBy(asc(apiKeys.createdAt))
    .limit(1);
  return (k?.domains as string[]) ?? [];
}

/**
 * Regrava a allowlist de domínios de TODAS as keys ativas do projeto.
 * A URL é uma propriedade do projeto na UI, então keys extras não podem ficar
 * com uma allowlist divergente — seria uma origem aceita sem aparecer em lugar nenhum.
 */
export async function setProjectDomains(projectId: string, domains: string[]) {
  await db
    .update(apiKeys)
    .set({ domains })
    .where(and(eq(apiKeys.projectId, projectId), isNull(apiKeys.revokedAt)));
  invalidateKeyCache();
}

/** Busca um projeto garantindo que pertence ao workspace (ou null). */
export async function getProject(projectId: string, workspaceId: string): Promise<ProjectRow | null> {
  const [p] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  return p ?? null;
}

/** Primeiro projeto do workspace (fallback quando não há projeto ativo no cookie). */
export async function getFirstProject(workspaceId: string): Promise<ProjectRow | null> {
  const [p] = await db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(asc(projects.createdAt))
    .limit(1);
  return p ?? null;
}

/**
 * Cria um projeto no workspace já com uma SDK key própria.
 * Retorna { projectId, publicKey }.
 */
export async function createProject(workspaceId: string, name: string) {
  const id = newProjectId();
  const slug = slugify(name) || slugify(id);
  await db.insert(projects).values({ id, workspaceId, name, slug });
  const { publicKey } = await createApiKey(workspaceId, id, "Default");
  return { projectId: id, publicKey };
}

export async function renameProject(projectId: string, workspaceId: string, name: string) {
  await db
    .update(projects)
    .set({ name, slug: slugify(name) || projectId })
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)));
}

/** Exclui um projeto (cascade remove keys, surveys, events e respostas). */
export async function deleteProject(projectId: string, workspaceId: string) {
  await db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)));
}

/** Atualiza a logo do projeto (ou remove, passando null). */
export async function updateProjectLogo(projectId: string, workspaceId: string, logoUrl: string | null) {
  await db
    .update(projects)
    .set({ logoUrl })
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)));
}

/** Quantos projetos o workspace tem (para impedir excluir o último). */
export async function countProjects(workspaceId: string): Promise<number> {
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId));
  return Number(n) || 0;
}
