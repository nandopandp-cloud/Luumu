import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Estado vazio ilustrado (Analytics, Pesquisas…): ilustração, título, texto, ações empilhadas
  e uma faixa de passos. O EmptyState simples continua para áreas menores.
*/
export function IllustratedState({
  art,
  title,
  description,
  actions,
  steps,
  className,
}: {
  art: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
  steps?: { icon: LucideIcon; title: string; text: string }[];
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col items-center text-center", className)}>
      <div className="w-full max-w-[720px]">{art}</div>
      <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-fg md:text-[32px] md:leading-tight">{title}</h2>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-mut md:text-base">{description}</p>
      {actions && <div className="mt-7 flex w-full max-w-[340px] flex-col gap-3">{actions}</div>}
      {steps && steps.length > 0 && (
        <div
          className={cn(
            "mt-10 grid w-full gap-6 border-t border-line pt-8 text-left sm:grid-cols-2",
            steps.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"
          )}
        >
          {steps.map((s, i) => (
            <div key={s.title} className={cn("flex items-start gap-4", i > 0 && "lg:border-l lg:border-line lg:pl-6")}>
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-brand text-accent">
                <s.icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-fg">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-fg-mut">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
