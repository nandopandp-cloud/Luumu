/** Pedaços do report usados pela tela e pelo HTML/PDF exportados. Puro. */
import { parsePeriod } from "./period";
import type { ReportModel } from "./model";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Mensagem de abertura quando ninguém escreveu outra (a da referência). */
export function defaultIntro(period: string): string {
  const p = parsePeriod(period);
  if (!p) return "";
  return `Fala pessoal, boa tarde.\nSegue o report referente ao Q${p.half} do mês de ${MONTHS[p.month - 1]}.`;
}

export const introText = (m: Pick<ReportModel, "intro" | "period">) => m.intro.trim() || defaultIntro(m.period);

/** "02 de outubro de 2026, 17:16" */
export function formatLongTs(iso: string): string {
  const d = new Date(iso);
  const tz = "America/Sao_Paulo";
  const date = d.toLocaleDateString("pt-BR", { timeZone: tz, day: "2-digit", month: "long", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

export type ReportStatus = "concluido" | "em_andamento" | "em_revisao";

export const REPORT_STATUS: Record<ReportStatus, { label: string; bg: string; fg: string }> = {
  concluido: { label: "Concluído", bg: "#DCFCE7", fg: "#15803d" },
  em_revisao: { label: "Em revisão", bg: "#FEF3C7", fg: "#92400e" },
  em_andamento: { label: "Em andamento", bg: "#DBEAFE", fg: "#1d4ed8" },
};

/** Concluído = já existe relatório gerado da quinzena; senão, em andamento (aberta) ou em revisão. */
export function reportStatus(closed: boolean, generated: boolean): ReportStatus {
  return generated ? "concluido" : closed ? "em_revisao" : "em_andamento";
}

/** Ícones da coluna "Resultado": quadrado verde com check / X vermelho. */
export const ICON_MET = `<svg width="18" height="18" viewBox="0 0 18 18" aria-label="Atingiu"><rect width="18" height="18" rx="3" fill="#22C55E"/><path d="M4.5 9.3l3 3 6-6.3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const ICON_MISSED = `<svg width="16" height="16" viewBox="0 0 16 16" aria-label="Abaixo da meta"><path d="M3 3l10 10M13 3L3 13" stroke="#EF4444" stroke-width="2.4" stroke-linecap="round"/></svg>`;
