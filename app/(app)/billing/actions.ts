"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageWorkspace, getCurrentWorkspaceId, requireUser } from "@/lib/auth/current";
import { getWorkspace } from "@/lib/db/workspace";
import { cancelPlanRequest, createPlanRequest } from "@/lib/db/plan-requests";
import { sendEmail } from "@/lib/email";
import { annualTotal, formatBRL, monthlyPrice, PLAN_IDS, planOf, PLAN_BY_ID } from "@/lib/plans";
import { escapeHtml } from "@/lib/email-templates";

const schema = z.object({
  plan: z.enum(PLAN_IDS),
  cycle: z.enum(["monthly", "annual"]),
  message: z.string().trim().max(1000).default(""),
});

/**
 * Pedido de mudança de plano. Sem gateway de pagamento, a troca é confirmada pela equipe:
 * o pedido fica registrado e, se SALES_EMAIL estiver configurado, a equipe recebe um e-mail.
 * Só donos e administradores do workspace podem pedir.
 */
export async function requestPlanChangeAction(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Pedido inválido." };
  const [user, workspaceId, canManage] = await Promise.all([requireUser(), getCurrentWorkspaceId(), canManageWorkspace()]);
  if (!canManage) return { ok: false as const, error: "Só donos e administradores do workspace podem mudar o plano." };

  const ws = await getWorkspace(workspaceId);
  const current = planOf(ws?.plan);
  const { plan: planId, cycle, message } = parsed.data;
  if (planId === current.id) return { ok: false as const, error: "Esse já é o seu plano atual." };
  const plan = PLAN_BY_ID.get(planId)!;

  await createPlanRequest({ workspaceId, userId: user.userId, plan: planId, cycle, fromPlan: current.id, message });

  const to = process.env.SALES_EMAIL;
  if (to) {
    const price = monthlyPrice(plan, cycle);
    const priceText =
      price === null ? "sob consulta" : cycle === "annual" ? `R$ ${formatBRL(price)}/mês (R$ ${formatBRL(annualTotal(plan)!)}/ano)` : `R$ ${formatBRL(price)}/mês`;
    await sendEmail({
      to: [to],
      subject: `Pedido de plano: ${ws?.name ?? "workspace"} → ${plan.name}`,
      html: `<p><strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)}) pediu a mudança do workspace <strong>${escapeHtml(
        ws?.name ?? workspaceId
      )}</strong>:</p>
<ul><li>De: ${current.name}</li><li>Para: ${plan.name} — ${cycle === "annual" ? "anual" : "mensal"}, ${priceText}</li></ul>
${message ? `<p>Mensagem: ${escapeHtml(message)}</p>` : ""}`,
    }).catch(() => undefined); // o pedido já está registrado; e-mail é aviso
  }

  revalidatePath("/billing");
  return { ok: true as const };
}

export async function cancelPlanRequestAction() {
  const [workspaceId, canManage] = await Promise.all([getCurrentWorkspaceId(), canManageWorkspace()]);
  if (!canManage) return { ok: false as const, error: "Só donos e administradores do workspace podem fazer isso." };
  await cancelPlanRequest(workspaceId);
  revalidatePath("/billing");
  return { ok: true as const };
}
