import type { ElementKind } from "@/lib/tours/types";

export const KIND_LABEL: Record<ElementKind, string> = {
  button: "Botão",
  link: "Link",
  navigation: "Navegação",
  input: "Campo",
  select: "Seleção",
  tab: "Aba",
  menu: "Menu",
  card: "Card",
  other: "Elemento",
};

/** Estabilidade do alvo (0–1): o quanto a Luumu consegue reencontrá-lo se a tela mudar. */
export function StabilityMeter({ value, compact }: { value: number; compact?: boolean }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 75 ? "bg-sucesso" : pct >= 50 ? "bg-aviso" : "bg-erro";
  const label = pct >= 75 ? "Alta" : pct >= 50 ? "Média" : "Baixa";
  return (
    <span className="inline-flex shrink-0 items-center gap-2" title={`Estabilidade ${pct}%`}>
      <span className={`block h-1.5 overflow-hidden rounded-full bg-bg-sunken ${compact ? "w-10" : "w-16"}`}>
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[11px] font-semibold text-fg-mut">{label}</span>
    </span>
  );
}
