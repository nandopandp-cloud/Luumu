/**
 * O report no formato do corpo de e-mail (Gmail, Outlook): mesmo layout da referência, mas só com
 * o que cliente de e-mail aceita: tabelas, estilos inline, largura fixa e os gráficos como
 * imagens (PNG gerado no navegador a partir de chartCardSvg). Puro.
 */
import { formatCompact, type GoalStatus } from "./indicators";
import type { ReportModel } from "./model";
import { buildCharts } from "./charts";
import { escapeHtml, highlightsHtml, introText, REPORT_STATUS, type ReportStatus } from "./html";
import { GROUP_STYLE, rowName } from "./render-html";

const TXT = "#1a1a2e";
const MUT = "#6b7280";
const LINE = "#E5E7EB";
const FONT = "Arial,Helvetica,sans-serif";
export const EMAIL_WIDTH = 680;

/** ✅/❌ têm o mesmo desenho em todos os clientes (quadrado verde com check, X vermelho). */
const RESULT: Record<GoalStatus, string> = { met: "✅", missed: "❌", no_target: "—", no_data: "—" };

function table(g: ReportModel["groups"][number], code: string) {
  const st = GROUP_STYLE[g.key];
  const rows = g.key === "produto" ? g.rows.filter((r) => r.key === "northstar") : g.rows;
  const td = (s: string, align = "center", extra = "") =>
    `<td align="${align}" style="padding:8px 10px;border-top:1px solid ${LINE};${align === "left" ? "" : `border-left:1px solid ${LINE};`}font-family:${FONT};font-size:13px;color:${TXT};${extra}">${s}</td>`;
  const th = (s: string, align = "center", w: string) =>
    `<td align="${align}" width="${w}" style="padding:8px 6px;background:#F3F4F6;${align === "left" ? "padding-left:10px;" : `border-left:1px solid ${LINE};`}font-family:${FONT};font-size:11px;font-weight:bold;color:${TXT};white-space:nowrap">${escapeHtml(s)}</td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border:1.5px solid ${st.color};border-radius:10px;overflow:hidden;margin:0 0 14px">
<tr><td colspan="5" align="center" bgcolor="${st.color}" style="background:${st.color};padding:7px;font-family:${FONT};font-size:12px;font-weight:bold;letter-spacing:.5px;color:#ffffff">${st.title}</td></tr>
<tr>${th("Indicador", "left", "22%")}${th(`Meta (${code})`, "center", "19%")}${th("Realizado", "center", "19%")}${th("Nova Meta (Próxima Quinzena)", "center", "25%")}${th("Resultado", "center", "15%")}</tr>
${rows
  .map(
    (r) =>
      `<tr>${td(escapeHtml(rowName(r)), "left")}${td(escapeHtml(formatCompact(r.target, r.unit)))}${td(escapeHtml(formatCompact(r.value, r.unit)))}${td(
        escapeHtml(formatCompact(r.nextTarget, r.unit))
      )}${td(RESULT[r.status], "center", "font-size:15px")}</tr>`
  )
  .join("\n")}
</table>`;
}

export function renderEmailHtml(m: ReportModel, opts: { status: ReportStatus; generatedAt: string; chartImages: Record<string, string> }): string {
  const st = REPORT_STATUS[opts.status];
  const charts = buildCharts(m);
  const half = Math.floor((EMAIL_WIDTH - 12) / 2);
  const chartRows: string[] = [];
  for (let i = 0; i < charts.length; i += 2) {
    // valign + vertical-align + fonte 0 em TODAS as células: o Gmail, ao colar, ignora o valign e
    // alinhava as imagens pela linha de base, descendo o gráfico da direita
    const top = "vertical-align:top;font-size:0;line-height:0";
    const cell = (c: (typeof charts)[number] | undefined) =>
      c && opts.chartImages[c.id]
        ? `<td width="${half}" valign="top" style="${top};padding:0 0 12px"><img src="${opts.chartImages[c.id]}" width="${half}" alt="${escapeHtml(c.title)}" style="display:block;width:${half}px;max-width:100%;height:auto;border:0;vertical-align:top"></td>`
        : `<td width="${half}" valign="top" style="${top}"></td>`;
    chartRows.push(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cell(charts[i])}<td width="12" valign="top" style="${top}">&nbsp;</td>${cell(charts[i + 1])}</tr></table>`
    );
  }
  const nl2br = (s: string) => escapeHtml(s).replace(/\n/g, "<br>");

  return `<table role="presentation" width="${EMAIL_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:${EMAIL_WIDTH}px;max-width:100%;font-family:${FONT};color:${TXT}">
<tr><td style="font-family:${FONT};font-size:22px;font-weight:bold;color:${TXT};padding:0 0 4px">Report da Área - Gestão de Produto</td></tr>
<tr><td style="font-family:${FONT};font-size:15px;color:#374151;padding:0 0 16px">Período: ${escapeHtml(m.datesShort)} (${escapeHtml(m.code)}) &nbsp;<span style="display:inline-block;font-size:11px;font-weight:bold;padding:3px 10px;border-radius:10px;background:${st.bg};color:${st.fg}">${st.label}</span></td></tr>
<tr><td style="padding:0 0 22px;font-family:${FONT};font-size:14px;line-height:22px;color:#374151">${nl2br(introText(m))}</td></tr>
<tr><td style="font-family:${FONT};font-size:16px;font-weight:bold;color:${TXT};padding:0 0 10px">1. Resumo dos Indicadores</td></tr>
<tr><td>${m.groups.map((g) => table(g, m.code)).join("\n")}</td></tr>
<tr><td style="font-family:${FONT};font-size:16px;font-weight:bold;color:${TXT};padding:12px 0 12px">2. Highlights</td></tr>
<tr><td>${highlightsHtml(m.highlights, { font: FONT, color: TXT, muted: MUT })}</td></tr>
<tr><td style="font-family:${FONT};font-size:16px;font-weight:bold;color:${TXT};padding:12px 0 10px">3. Evolução dos Indicadores</td></tr>
<tr><td>${chartRows.join("\n")}</td></tr>
<tr><td style="padding:10px 0 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #ECECF2;border-radius:12px">
  <tr><td style="padding:14px 16px 6px;font-family:${FONT};font-size:14px;font-weight:bold;color:${TXT}">ⓘ&nbsp; Observações e conclusões executivas</td></tr>
  <tr><td style="padding:6px 16px 16px"><div style="border:1px solid ${LINE};border-radius:8px;padding:12px 14px;font-family:${FONT};font-size:13px;line-height:20px;color:${m.notes.trim() ? TXT : MUT}">${
    m.notes.trim() ? nl2br(m.notes.trim()) : "Sem observações registradas."
  }</div></td></tr></table>
</td></tr>
</table>`;
}
