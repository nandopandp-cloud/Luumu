import { Flame, Layers, MessageSquareHeart, Route, Sparkles } from "lucide-react";
import { Mascot } from "@/components/ui/Mascot";

const CHIPS = [
  { icon: MessageSquareHeart, label: "Pesquisas (CSAT, NPS, CES e mais)" },
  { icon: Flame, label: "Heatmaps e Session Replay", soon: true },
  { icon: Sparkles, label: "Insights de IA" },
  { icon: Route, label: "Product Tours" },
  { icon: Layers, label: "Tudo em uma única plataforma" },
];

/** Cabeçalho da área Plano & Cobrança: título, o que a Luumu reúne e o mascote. */
export function BillingHeader() {
  return (
    <header className="relative flex flex-col gap-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-md bg-surface-brand px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
            Plano &amp; Cobrança
          </span>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight md:text-[36px] md:leading-tight">
            Escolha o plano ideal para o seu time
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-fg-mut">
            Do feedback à análise de comportamento, a Luumu reúne tudo que você precisa para entender, engajar e evoluir a
            experiência dos seus usuários.
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-2 md:flex" aria-hidden>
          <div className="relative max-w-[230px] rounded-2xl border border-accent/15 bg-bg-elev px-4 py-3 text-sm font-medium leading-snug text-accent shadow-[0_8px_24px_rgba(75,28,171,.10)]">
            Escolha o plano que mais faz sentido para o seu momento. Você pode alterar quando quiser! ✨
            <span className="absolute -right-1.5 top-1/2 size-3 -translate-y-1/2 rotate-45 border-r border-t border-accent/15 bg-bg-elev" />
          </div>
          <Mascot name="Piscando" size={120} float />
        </div>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="O que a Luumu reúne">
        {CHIPS.map(({ icon: Icon, label, soon }) => (
          <li key={label} className="inline-flex items-center gap-2 rounded-xl border border-line bg-bg-elev px-3.5 py-2 text-sm font-medium text-fg-soft">
            <Icon className="size-4 text-accent" aria-hidden />
            {label}
            {soon && <span className="rounded-full bg-aviso/15 px-1.5 py-px text-[10px] font-bold text-aviso">Em breve</span>}
          </li>
        ))}
      </ul>
    </header>
  );
}
