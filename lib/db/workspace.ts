import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { monthStart, planOf, type PlanId } from "@/lib/plans";
import { db } from "./client";
import { workspaces, surveys, responses, memberships } from "@/db/schema";

export type WorkspaceRow = typeof workspaces.$inferSelect;

/** Dados completos do workspace (para a aba de Configurações). */
export async function getWorkspace(workspaceId: string): Promise<WorkspaceRow | null> {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  return ws ?? null;
}

/** Atualiza campos editáveis do workspace. */
export async function updateWorkspace(
  workspaceId: string,
  patch: Partial<Pick<WorkspaceRow, "name" | "slug" | "timezone" | "logoUrl">>
) {
  await db.update(workspaces).set(patch).where(eq(workspaces.id, workspaceId));
}

export interface WorkspaceUsage {
  plan: PlanId;
  planLabel: string;
  /** uso do mês do calendário atual (respostas) e atual (pesquisas ativas, membros) */
  usage: { responses: number; activeSurveys: number; members: number };
  limits: { responses: number; activeSurveys: number; members: number };
}

/**
 * Plano do workspace + uso real vs. limites do catálogo (lib/plans.ts). Respostas contam o
 * MÊS ATUAL — os planos são "por mês"; antes somava todo o histórico. As 4 consultas rodam
 * em paralelo.
 */
export async function getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
  const since = monthStart();
  const [[ws], [{ nResponses } = { nResponses: 0 }], [{ nActive } = { nActive: 0 }], [{ nMembers } = { nMembers: 0 }]] =
    await Promise.all([
      db.select({ plan: workspaces.plan }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
      db
        .select({ nResponses: count() })
        .from(responses)
        .innerJoin(surveys, eq(responses.surveyId, surveys.id))
        .where(and(eq(surveys.workspaceId, workspaceId), gte(responses.createdAt, since))),
      db
        .select({ nActive: count() })
        .from(surveys)
        .where(and(eq(surveys.workspaceId, workspaceId), eq(surveys.status, "ativa"))),
      db.select({ nMembers: count() }).from(memberships).where(eq(memberships.workspaceId, workspaceId)),
    ]);

  const plan = planOf(ws?.plan);
  return {
    plan: plan.id,
    planLabel: plan.name,
    usage: {
      responses: Number(nResponses) || 0,
      activeSurveys: Number(nActive) || 0,
      members: Number(nMembers) || 0,
    },
    limits: { responses: plan.limits.responses, activeSurveys: plan.limits.activeSurveys, members: plan.limits.members },
  };
}
