"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/Link";
import { ArrowDownUp, Check, EyeOff, Loader2, Lock, MousePointerClick, Move, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Mascot } from "@/components/ui/Mascot";
import { useToast } from "@/components/ui/Toast";
import { setHeatmapsEnabledAction } from "@/app/(app)/heatmaps/actions";

function EnableButton({ label = "Ativar heatmaps neste projeto" }: { label?: string }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const r = await setHeatmapsEnabledAction(true);
          if (!r.ok) return toast("error", r.error);
          toast("success", "Heatmaps ativados! A coleta começa nas próximas visitas.");
          router.refresh();
        })
      }
      className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 disabled:opacity-60 [background:var(--grad-roxo)]"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
      {label}
    </button>
  );
}

const MODES = [
  { icon: MousePointerClick, title: "Cliques", text: "Onde as pessoas clicam, e o que nunca é clicado." },
  { icon: Move, title: "Movimento", text: "Para onde o cursor vai e os caminhos mais comuns." },
  { icon: ArrowDownUp, title: "Scroll", text: "Até onde a página é vista e onde ela é abandonada." },
];

const PRIVACY = [
  "Nada do que é digitado em campos é capturado, nunca.",
  "E-mails e números longos (CPF, telefone) são mascarados.",
  "Marque qualquer área com data-luumu-mask para escondê-la.",
  "Sem gravação de tela: só posições relativas a elementos.",
];

/** Coleta desligada: o que são os heatmaps, privacidade e o botão de ativar. */
export function EnableHeatmaps({ canManage, allowed }: { canManage: boolean; allowed: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-bg-elev p-8 md:p-10">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-accent/10 blur-3xl" aria-hidden />
      <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-brand px-3 py-1 text-xs font-bold text-accent">
            <Sparkles className="size-3.5" /> Novo na Luumu
          </span>
          <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight md:text-3xl">Enxergue a sua página pelos olhos de quem usa</h2>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-fg-mut">
            Ative a coleta e o SDK que já está no seu produto passa a registrar cliques, movimento e rolagem. Sem instalar nada novo.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {MODES.map((m) => (
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
            {!allowed ? (
              <Link href="/billing" className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-glow)] [background:var(--grad-roxo)]">
                <Sparkles className="size-4" /> Disponível a partir do Starter. Ver planos
              </Link>
            ) : canManage ? (
              <EnableButton />
            ) : (
              <span className="inline-flex items-center gap-2 rounded-xl bg-bg-sunken px-4 py-3 text-sm text-fg-mut">
                <Lock className="size-4" /> Peça a um dono ou administrador do workspace para ativar.
              </span>
            )}
            <span className="text-xs text-fg-mut">Você pode pausar a qualquer momento.</span>
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
            <Mascot name="Trabalhando" size={110} />
          </div>
        </aside>
      </div>
    </section>
  );
}

/** Coleta ligada, nenhuma visita ainda. */
export function WaitingForData({ canManage, hosts, sdkKey }: { canManage: boolean; hosts: string[]; sdkKey: string | null }) {
  return (
    <section className="flex flex-col items-center rounded-3xl border border-line bg-bg-elev px-6 py-14 text-center">
      <Mascot name="Analisando" size={130} float />
      <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight">Tudo pronto! Aguardando as primeiras visitas</h2>
      <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-fg-mut">
        A coleta está ativa. Assim que alguém navegar pelo seu produto, os mapas aparecem aqui, normalmente em poucos minutos.
      </p>
      <ol className="mt-6 grid w-full max-w-2xl gap-3 text-left sm:grid-cols-3">
        <li className="rounded-2xl border border-line p-4 text-sm">
          <span className="text-xs font-bold text-accent">1</span>
          <p className="mt-1 font-semibold">SDK instalado</p>
          <p className="mt-0.5 text-xs text-fg-mut">
            {hosts.length ? `Visto em ${hosts.slice(0, 2).join(", ")}${hosts.length > 2 ? "…" : ""}` : sdkKey ? "Ainda não vimos o SDK rodar." : "Crie uma chave em Configurações → SDK & Eventos."}
          </p>
        </li>
        <li className="rounded-2xl border border-line p-4 text-sm">
          <span className="text-xs font-bold text-accent">2</span>
          <p className="mt-1 font-semibold">Navegue pelo produto</p>
          <p className="mt-0.5 text-xs text-fg-mut">Abra seu site em outra aba, clique e role a página.</p>
        </li>
        <li className="rounded-2xl border border-line p-4 text-sm">
          <span className="text-xs font-bold text-accent">3</span>
          <p className="mt-1 font-semibold">Volte aqui</p>
          <p className="mt-0.5 text-xs text-fg-mut">A visita é enviada quando a aba é fechada ou trocada.</p>
        </li>
      </ol>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/settings/sdk" className="rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-fg-soft transition hover:border-accent hover:text-accent">
          Ver instalação do SDK
        </Link>
        {canManage && <PauseButton />}
      </div>
    </section>
  );
}

export function PauseButton({ compact = false }: { compact?: boolean }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const r = await setHeatmapsEnabledAction(false);
          if (!r.ok) return toast("error", r.error);
          toast("success", "Coleta pausada. Os mapas já coletados continuam aqui.");
          router.refresh();
        })
      }
      className={
        compact
          ? "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-fg-soft hover:bg-bg-sunken disabled:opacity-50"
          : "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-fg-mut transition hover:bg-bg-sunken hover:text-fg disabled:opacity-50"
      }
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <EyeOff className="size-4" />} Pausar coleta
    </button>
  );
}

export { EnableButton };

/** Migração ainda não aplicada (tabelas inexistentes). */
export function HeatmapsUnavailable() {
  return (
    <section className="flex flex-col items-center rounded-3xl border border-line bg-bg-elev px-6 py-14 text-center">
      <Mascot name="Preocupado" size={110} />
      <h2 className="mt-4 font-display text-xl font-bold">Os heatmaps ainda não foram configurados neste ambiente</h2>
      <p className="mt-2 max-w-md text-sm text-fg-mut">Falta aplicar a migração do banco (db/migrations/0019_heatmaps.sql).</p>
    </section>
  );
}
