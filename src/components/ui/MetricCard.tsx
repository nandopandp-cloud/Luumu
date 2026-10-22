import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./Card";

export function MetricCard({
  label,
  value,
  delta,
  suffix,
  accent = "roxo",
  icon,
  hint,
}: {
  label: string;
  value: string | number;
  delta?: number;
  suffix?: string;
  accent?: "roxo" | "verde" | "azul" | "laranja";
  icon?: React.ReactNode;
  /** Explica o que o número representa (ex: fórmula da metodologia) — evita leitura errada do valor. */
  hint?: string;
}) {
  const up = (delta ?? 0) >= 0;
  const accentColor = {
    roxo: "text-luumu-roxo",
    verde: "text-luumu-verde",
    azul: "text-sec-azul",
    laranja: "text-sec-laranja",
  }[accent];

  return (
    <Card padded className="p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-mut">{label}</span>
        {icon && <span className="text-fg-mut">{icon}</span>}
      </div>
      <div className={cn("mt-1 font-display text-[40px] font-extrabold leading-none tracking-tight", accentColor)}>
        {value}
        {suffix && <span className="ml-1 text-lg text-fg-mut">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-xs leading-snug text-fg-mut">{hint}</p>}
      {delta !== undefined && (
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-[13px] font-semibold",
            up ? "text-sucesso" : "text-erro"
          )}
        >
          {up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
          {up ? "+" : ""}
          {delta}% vs. período anterior
        </div>
      )}
    </Card>
  );
}
