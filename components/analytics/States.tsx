"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/Link";
import { BarChart3, BookOpen, Check, EyeOff, FileText, Loader2, Lock, Repeat, ShieldCheck, Sparkles, Star, UserPlus, Users, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { IllustratedState } from "@/components/ui/IllustratedState";
import { AnalyticsEmptyArt } from "@/components/illustrations/EmptyArt";
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
    <div>
      <PageHeader title="Analytics" description="Acompanhe a evolução do feedback e descubra insights valiosos." />
      <IllustratedState
        art={<AnalyticsEmptyArt className="w-full" />}
        title="Ainda não há dados de analytics por aqui"
        description="Seus dados começarão a aparecer assim que seus usuários responderem às pesquisas ou interagirem com o seu produto."
        actions={
          <>
            <Button href="/surveys/new" className="w-full justify-center">
              <BarChart3 className="size-4" /> Criar minha primeira pesquisa
            </Button>
            <Button href="/help?a=analytics" variant="ghost" className="w-full justify-center">
              <BookOpen className="size-4" /> Conhecer o Analytics da Luumu
            </Button>
            {/* a coleta já está ligada: quem administra continua com os atalhos de antes */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-fg-mut">
              <Link href="/settings/sdk" className="font-semibold hover:text-accent">
                Ver instalação do SDK
              </Link>
              {canManage && <ToggleCollection enable={false} label="Pausar coleta" />}
            </div>
          </>
        }
        steps={[
          { icon: FileText, title: "1. Crie uma pesquisa", text: "Escolha um modelo ou crie do zero em poucos minutos." },
          { icon: Users, title: "2. Colete respostas", text: "Compartilhe o link, QR Code ou integre ao seu produto." },
          { icon: BarChart3, title: "3. Acompanhe os dados", text: "Visualize métricas como CSAT, NPS, temas e sentimento em tempo real." },
          { icon: Star, title: "4. Descubra insights", text: "Identifique oportunidades e tome decisões baseadas em dados reais." },
        ]}
      />
    </div>
  );
}

export function AnalyticsUnavailable({ migration = "0020_analytics.sql" }: { migration?: string }) {
  return (
    <section className="flex flex-col items-center rounded-3xl border border-line bg-bg-elev px-6 py-14 text-center">
      <Mascot name="Preocupado" size={110} />
      <h2 className="mt-4 font-display text-xl font-bold">O Analytics ainda não foi configurado neste ambiente</h2>
      <p className="mt-2 max-w-md text-sm text-fg-mut">Falta aplicar a migração do banco (db/migrations/{migration}).</p>
    </section>
  );
}
