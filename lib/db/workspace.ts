import "server-only";
import { and, count, eq } from "drizzle-orm";
import { db } from "./client";
import { workspaces, surveys, responses, memberships } from "@/db/schema";

/** Limites por plano (fonte da verdade dos planos oferecidos). */
export const PLAN_LIMITS: Record<
  string,
  { label: string; responses: number; activeSurveys: number; members: number }
> = {
  starter: { label: "Starter", responses: 1_000, activeSurveys: 2, members: 3 },
  growth: { label: "Growth", responses: 50_000, activeSurveys: Infinity, members: 10 },
  enterprise: { label: "Enterprise", responses: Infinity, activeSurveys: Infinity, members: Infinity },
};

export interface WorkspaceUsage {
  plan: string;
  planLabel: string;
  usage: { responses: number; activeSurveys: number; members: number };
  limits: { responses: number; activeSurveys: number; members: number };
}

/** Plano do workspace + uso real (respostas, pesquisas ativas, membros) vs. limites. */
export async function getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
  const [ws] = await db
    .select({ plan: workspaces.plan })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const plan = (ws?.plan ?? "growth").toLowerCase();
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.growth;

  const [{ nResponses } = { nResponses: 0 }] = await db
    .select({ nResponses: count() })
    .from(responses)
    .innerJoin(surveys, eq(responses.surveyId, surveys.id))
    .where(eq(surveys.workspaceId, workspaceId));

  const [{ nActive } = { nActive: 0 }] = await db
    .select({ nActive: count() })
    .from(surveys)
    .where(and(eq(surveys.workspaceId, workspaceId), eq(surveys.status, "ativa")));

  const [{ nMembers } = { nMembers: 0 }] = await db
    .select({ nMembers: count() })
    .from(memberships)
    .where(eq(memberships.workspaceId, workspaceId));

  return {
    plan,
    planLabel: limits.label,
    usage: {
      responses: Number(nResponses) || 0,
      activeSurveys: Number(nActive) || 0,
      members: Number(nMembers) || 0,
    },
    limits: {
      responses: limits.responses,
      activeSurveys: limits.activeSurveys,
      members: limits.members,
    },
  };
}
