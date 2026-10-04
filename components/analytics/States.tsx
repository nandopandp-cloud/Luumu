"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, Check, EyeOff, Loader2, Lock, Repeat, ShieldCheck, Sparkles, UserPlus, Zap } from "lucide-react";
import { Mascot } from "@/components/ui/Mascot";
import { useToast } from "@/components/ui/Toast";
import { setAnalyticsEnabledAction } from "@/app/(app)/analytics/actions";

export function ToggleCollection({ enable, label, compact }: { enable: boolean; label?: string; compact?: boolean }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const r = await setAnalyticsEnabledAction(enable);
          if (!r.ok) return toast("error", r.error);
          toast("success", enable ? "Analytics ativado! Os dados começam a chegar nas próximas visitas." : "Coleta pausada. Os dados já coletados continuam aqui.");
          router.refresh();
        })
      }
      className={
        compact
          ? "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-fg-soft hover:bg-bg-sunken disabled:opacity-50"
          : enable
          ? "inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 disabled:opacity-60 [background:var(--grad-roxo)]"
          : "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-fg-mut transition hover:bg-bg-sunken hover:text-fg disabled:opacity-50"
      }
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : enable ? <Zap className="size-4" /> : <EyeOff className="size-4" />}
      {label ?? (enable ? "Ativar Analytics neste projeto" : "Pausar coleta")}
    </button>
  );
}

const WHAT = [
  { icon: UserPlus, title: "Aquisição", text: "De onde vêm os usuários: canais, campanhas e páginas de entrada." },
  { icon: Repeat, title: "Engajamento e retenção", text: "DAU, MAU, frequência, cohorts e o que faz as pessoas voltarem." },
  { icon: BarChart3, title: "Produto", text: "Telas, funcionalidades, funis e as métricas que você definir." },
];

const PRIVACY = [
  "Usuários anônimos por padrão; o ID só aparece se o seu produto chamar Luumu.identify.",
  "Sem gravação de tela e sem nada do que é digitado.",
  "Um único envio por carregamento de página: leve para o seu site.",
  "Você pode pausar a coleta a qualquer momento.",
];

export function EnableAnalytics({ canManage }: { canManage: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-bg-elev p-8 md:p-10">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-accent/10 blur-3xl" aria-hidden />
      <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-brand px-3 py-1 text-xs font-bold text-accent">
            <Sparkles className="size-3.5" /> Analytics de produto
          </span>
          <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight md:text-3xl">Decisões de produto com dados de uso reais</h2>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-fg-mut">
            Ative a coleta e o SDK que já está no seu produto passa a medir aquisição, engajamento e retenção. Sem instalar nada novo.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {WHAT.map((m) => (
              <div key={m.title} className="rounded-2xl border border-line bg-bg p-4">
                <span className="grid size-10 place-items-center rounded-xl bg-surface-brand text-accent">
                  <m.icon className="size-5" />
                </span>
                <div className="mt-3 font-display font-bold">{m.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-fg-mut">{m.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            {canManage ? (
              <ToggleCollection enable />
            ) : (
              <span className="inline-flex items-center gap-2 rounded-xl bg-bg-sunken px-4 py-3 text-sm text-fg-mut">
                <Lock className="size-4" /> Peça a um dono ou administrador do workspace para ativar.
              </span>
            )}
          </div>
        </div>
        <aside className="rounded-2xl border border-line bg-bg p-5">
          <div className="flex items-center gap-2 font-display font-bold">
            <ShieldCheck className="size-5 text-sucesso" /> Privacidade por padrão
          </div>
          <ul className="mt-3 flex flex-col gap-2.5">
            {PRIVACY.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm leading-snug text-fg-soft">
                <Check className="mt-0.5 size-4 shrink-0 text-sucesso" /> {p}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-center">
            <Mascot name="Dados viram insights" size={120} />
          </div>
        </aside>
      </div>
    </section>
  );
}

export function WaitingAnalytics({ canManage }: { canManage: boolean }) {
  return (
    <section className="flex flex-col items-center rounded-3xl border border-line bg-bg-elev px-6 py-14 text-center">
      <Mascot name="Analisando" size={130} float />
      <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight">Tudo pronto! Aguardando as primeiras visitas</h2>
      <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-fg-mut">
        A coleta está ativa. Assim que alguém usar o seu produto, os indicadores aparecem aqui. Cada visita é enviada quando a pessoa troca de aba ou fecha a página.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/settings/sdk" className="rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-fg-soft transition hover:border-accent hover:text-accent">
          Ver instalação do SDK
        </Link>
        {canManage && <ToggleCollection enable={false} />}
      </div>
    </section>
  );
}

export function AnalyticsUnavailable() {
  return (
    <section className="flex flex-col items-center rounded-3xl border border-line bg-bg-elev px-6 py-14 text-center">
      <Mascot name="Preocupado" size={110} />
      <h2 className="mt-4 font-display text-xl font-bold">O Analytics ainda não foi configurado neste ambiente</h2>
      <p className="mt-2 max-w-md text-sm text-fg-mut">Falta aplicar a migração do banco (db/migrations/0020_analytics.sql).</p>
    </section>
  );
}
