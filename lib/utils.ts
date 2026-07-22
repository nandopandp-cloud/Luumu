import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina classes condicionais e resolve conflitos do Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata número compacto (1.248 → 1,2 mil). */
export function formatNumber(n: number) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Formata número inteiro com separador de milhar. */
export function formatInt(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

/** Formata porcentagem. */
export function formatPct(n: number, digits = 0) {
  return `${n.toFixed(digits)}%`;
}
