import Link from "@/components/ui/Link";
import { ArrowRight } from "lucide-react";
import { Mascot } from "@/components/ui/Mascot";

/** Sem respostas suficientes para encontrar padrões. */
export function InsightEmptyState() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-bg-elev/60 px-6 py-16 text-center">
      <Mascot name="Analisando" size={120} float />
      <h2 className="mt-5 font-display text-xl font-bold tracking-tight">Precisamos de mais feedbacks para encontrar padrões.</h2>
      <p className="mt-2 max-w-md text-sm text-fg-mut">
        Assim que sua pesquisa começar a receber respostas, a Luumu mostrará os principais insights aqui.
      </p>
      <Link
        href="/surveys"
        className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 [background:var(--grad-roxo)]"
      >
        Ver pesquisas <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
