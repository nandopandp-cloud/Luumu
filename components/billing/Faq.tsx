import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Mascot } from "@/components/ui/Mascot";
import { FAQ } from "@/lib/plans";

/** Perguntas frequentes (accordion nativo, sem JS) + contato com vendas. */
export function Faq({ cta }: { cta: ReactNode }) {
  return (
    <section aria-labelledby="faq-title" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl border border-line bg-bg-elev p-6">
        <h2 id="faq-title" className="font-display text-xl font-bold tracking-tight">
          Perguntas frequentes
        </h2>
        <div className="mt-4 grid gap-x-6 md:grid-cols-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-b border-line py-1 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-3 text-sm font-semibold text-fg-soft transition hover:text-fg">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-fg-mut transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="pb-3 text-sm leading-relaxed text-fg-mut">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
      <aside className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-accent/20 bg-surface-brand/60 p-6">
        <div className="relative z-10 max-w-[200px]">
          <h2 className="font-display text-lg font-bold tracking-tight">Ainda tem dúvidas?</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-soft">Nosso time ajuda você a escolher o plano certo para o seu momento.</p>
        </div>
        <div className="relative z-10 mt-5">{cta}</div>
        <div className="pointer-events-none absolute -bottom-3 -right-3" aria-hidden>
          <Mascot name="Feliz" size={120} />
        </div>
      </aside>
    </section>
  );
}
