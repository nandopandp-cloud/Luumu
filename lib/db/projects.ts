import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "./client";
import { projects, surveys } from "@/db/schema";
import { projectId as newProjectId } from "./ids";
import { createApiKey } from "./keys";

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

/** Projetos do workspace (mais antigos primeiro) com nº de pesquisas. */
export async function listProjects(workspaceId: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(asc(projects.createdAt));

  return Promise.all(
    rows.map(async (p) => {
      const [{ n } = { n: 0 }] = await db
        .select({ n: count() })
        .from(surveys)
        .where(eq(surveys.projectId, p.id));
      return { ...p, surveyCount: Number(n) || 0 };
    })
  );
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
