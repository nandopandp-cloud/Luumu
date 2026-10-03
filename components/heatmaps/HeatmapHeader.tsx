import { Mascot, type MascotName } from "@/components/ui/Mascot";
import type { HeatmapMode } from "@/lib/heatmaps/core";

const BUBBLE: Record<HeatmapMode, { text: string; mascot: MascotName }> = {
  clicks: { text: "Entenda o comportamento dos seus usuários e encontre o que pode ser melhorado. ✨", mascot: "Animado" },
  moves: { text: "Acompanhe o movimento dos seus usuários e veja os caminhos mais comuns na sua página. ✨", mascot: "Analisando" },
  scroll: { text: "Veja até onde os usuários chegam e onde eles mais abandonam a sua página. 👀✨", mascot: "Surpreso" },
};

/** Cabeçalho dos Heatmaps: título e o mascote, com um balão que muda a cada modo. */
export function HeatmapHeader({ mode }: { mode: HeatmapMode }) {
  const b = BUBBLE[mode];
  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <span className="inline-flex rounded-md bg-surface-brand px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
          Heatmaps
        </span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight md:text-[34px] md:leading-tight">Veja como seus usuários interagem</h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-fg-mut">Descubra onde seus usuários clicam, rolam e passam mais tempo na sua página.</p>
      </div>
      <div className="relative hidden shrink-0 items-center gap-1 md:flex" aria-hidden>
        <div
          key={mode}
          className="relative max-w-[250px] rounded-2xl border border-accent/15 bg-bg-elev px-4 py-3 text-sm font-medium leading-snug text-accent shadow-[0_8px_24px_rgba(75,28,171,.10)] animate-[luumuFade_.3s_ease-out]"
        >
          {b.text}
          <span className="absolute -right-1.5 top-1/2 size-3 -translate-y-1/2 rotate-45 border-r border-t border-accent/15 bg-bg-elev" />
        </div>
        <Mascot name={b.mascot} size={118} float />
      </div>
    </header>
  );
}
