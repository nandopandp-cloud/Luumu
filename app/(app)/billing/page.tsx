import { BillingHeader } from "@/components/billing/BillingHeader";
import { UsageCard } from "@/components/billing/UsageCard";
import { PlanCards } from "@/components/billing/PlanCards";
import { ComparisonTable } from "@/components/billing/ComparisonTable";
import { Faq } from "@/components/billing/Faq";
import { TalkToSales } from "@/components/billing/PlanRequest";
import { canManageWorkspace, getCurrentWorkspaceId } from "@/lib/auth/current";
import { getWorkspaceUsage } from "@/lib/db/workspace";
import { getPendingPlanRequest } from "@/lib/db/plan-requests";
import { planOf, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const workspaceId = await getCurrentWorkspaceId();
  const [{ plan: planId, usage }, pending, canManage] = await Promise.all([
    getWorkspaceUsage(workspaceId),
    getPendingPlanRequest(workspaceId),
    canManageWorkspace(),
  ]);
  const plan = planOf(planId);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8">
      <BillingHeader />
      <UsageCard
        plan={plan}
        usage={usage}
        pending={pending ? { plan: pending.plan, cycle: pending.cycle, createdAt: pending.createdAt } : null}
        canManage={canManage}
      />
      <PlanCards current={plan.id} pendingPlan={(pending?.plan as PlanId | undefined) ?? null} canManage={canManage} />
      <ComparisonTable highlight={plan.id} />
      <Faq cta={<TalkToSales current={plan} canManage={canManage} salesEmail={process.env.SALES_EMAIL?.trim() || null} />} />
    </div>
  );
}
