"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { annualTotal, formatBRL, monthlyPrice, type BillingCycle, type Plan } from "@/lib/plans";
import { cancelPlanRequestAction, requestPlanChangeAction } from "@/app/(app)/billing/actions";

export function priceLabel(plan: Plan, cycle: BillingCycle) {
  const m = monthlyPrice(plan, cycle);
  if (m === null) return "Sob consulta";
  return `R$ ${formatBRL(m)}/mês${cycle === "annual" && m > 0 ? ` · R$ ${formatBRL(annualTotal(plan)!)}/ano` : ""}`;
}

/**
 * Pedido de mudança de plano. Sem gateway de pagamento, nada é cobrado aqui: o pedido fica
 * registrado e a equipe da Luumu confirma a mudança com o workspace.
 */
export function PlanRequestDialog({
  plan,
  current,
  initialCycle,
  onClose,
}: {
  plan: Plan;
  current: Plan;
  initialCycle: BillingCycle;
  onClose: () => void;
}) {
  const [cycle, setCycle] = useState<BillingCycle>(plan.monthly ? initialCycle : "monthly");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [busy, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const enterprise = plan.monthly === null;
  const downgrade = (plan.monthly ?? Infinity) < (current.monthly ?? Infinity);

  function submit() {
    start(async () => {
      const res = await requestPlanChangeAction({ plan: plan.id, cycle, message });
      if (!res.ok) return toast("error", res.error);
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <Dialog title="Pedido enviado" onClose={onClose}>
        <div className="flex flex-col items-center py-4 text-center">
          <CheckCircle2 className="size-12 text-sucesso" aria-hidden />
          <p className="mt-3 text-sm text-fg-soft">
            Recebemos seu pedido para o plano <strong>{plan.name}</strong>. Nossa equipe vai entrar em contato para confirmar
            a mudança. Você acompanha o pedido no topo desta página.
          </p>
          <Button size="sm" className="mt-5" onClick={onClose}>
            Entendi
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={enterprise ? "Falar com vendas" : downgrade ? `Mudar para o ${plan.name}` : `Fazer upgrade para o ${plan.name}`}
      description={enterprise ? "Conte um pouco do seu cenário e montamos uma proposta." : "Nossa equipe confirma a mudança com você. Nenhuma cobrança é feita agora."}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            {enterprise ? "Enviar" : "Solicitar mudança"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-bg-sunken p-4 text-sm">
          <span className="text-fg-mut">
            De <strong className="text-fg">{current.name}</strong>
          </span>
          <ArrowRight className="size-4 text-fg-mut" aria-hidden />
          <span className="text-fg-mut">
            para <strong className="text-accent">{plan.name}</strong>
          </span>
        </div>
        {!enterprise && plan.monthly !== 0 && (
          <div role="radiogroup" aria-label="Ciclo de cobrança" className="grid grid-cols-2 gap-2">
            {(["monthly", "annual"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={cycle === c}
                onClick={() => setCycle(c)}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  cycle === c ? "border-accent bg-surface-brand/60" : "border-line hover:border-line-strong"
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {c === "monthly" ? "Mensal" : "Anual"}
                  {c === "annual" && <span className="rounded-full bg-sucesso/15 px-1.5 text-[10px] font-bold text-sucesso">-20%</span>}
                </span>
                <span className="mt-0.5 block text-xs text-fg-mut">{priceLabel(plan, c)}</span>
              </button>
            ))}
          </div>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-fg-soft">{enterprise ? "Como podemos ajudar?" : "Mensagem para a equipe (opcional)"}</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={enterprise ? "Volume de respostas, número de produtos, requisitos de segurança…" : "Algo que devamos saber?"}
            className="w-full resize-y rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm outline-none transition focus:border-accent"
          />
        </label>
      </div>
    </Dialog>
  );
}

export function CancelRequestButton() {
  const [busy, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const res = await cancelPlanRequestAction();
          if (!res.ok) return toast("error", res.error);
          toast("success", "Pedido cancelado.");
          router.refresh();
        })
      }
      className="text-xs font-semibold text-fg-mut underline underline-offset-2 hover:text-fg disabled:opacity-50"
    >
      Cancelar pedido
    </button>
  );
}
