import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Mascot } from "@/components/ui/Mascot";

/** Card "Dica Luumu" da Dashboard: atalho para criar pesquisa a partir de template. */
export function TemplatesTip() {
  return (
    <section className="relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-2xl border border-accent/15 bg-[linear-gradient(135deg,#F3EDFF_0%,#E9DDFF_55%,#DCCBFF_100%)] p-6 dark:bg-[linear-gradient(135deg,#1B1435_0%,#24184A_100%)]">
      <span className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-accent">Dica Luumu</span>
      <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-fg">Explore nossos templates</h2>
      <p className="mt-2 max-w-[230px] text-sm text-fg-soft">Pesquisas prontas de CSAT, NPS e CES para você criar mais rápido.</p>
      <Link
        href="/surveys/new"
        className="mt-5 inline-flex w-fit items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#16C47F,#12B76A)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(18,183,106,.35)] transition hover:-translate-y-0.5"
      >
        Ver templates <ArrowRight className="size-4" />
      </Link>
      <div className="pointer-events-none absolute -bottom-3 -right-2" aria-hidden>
        <Mascot name="Animado" size={150} float />
      </div>
    </section>
  );
}
