import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import { planRequests } from "@/db/schema";
import { planRequestId } from "./ids";

/** Pedido em andamento do workspace (o mais recente), se houver. */
export async function getPendingPlanRequest(workspaceId: string) {
  const [row] = await db
    .select()
    .from(planRequests)
    .where(and(eq(planRequests.workspaceId, workspaceId), eq(planRequests.status, "pending")))
    .orderBy(desc(planRequests.createdAt))
    .limit(1);
  return row ?? null;
}

/** Registra um pedido; um pedido novo cancela o anterior ainda pendente (vale o último). */
export async function createPlanRequest(input: {
  workspaceId: string;
  userId: string;
  plan: string;
  cycle: string;
  fromPlan: string;
  message: string;
}) {
  const id = planRequestId();
  await db.batch([
    db
      .update(planRequests)
      .set({ status: "canceled" })
      .where(and(eq(planRequests.workspaceId, input.workspaceId), eq(planRequests.status, "pending"))),
    db.insert(planRequests).values({ id, ...input, status: "pending" }),
  ]);
  return id;
}

export async function cancelPlanRequest(workspaceId: string) {
  await db
    .update(planRequests)
    .set({ status: "canceled" })
    .where(and(eq(planRequests.workspaceId, workspaceId), eq(planRequests.status, "pending")));
}
