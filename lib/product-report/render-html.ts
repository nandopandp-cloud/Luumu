/**
 * Relatório exportado em HTML, no layout do report de referência: cabeçalho com período e
 * status, texto de abertura, "1. Resumo dos Indicadores" (tabelas coloridas por área),
 * "2. Highlights", "3. Evolução dos Indicadores" (6 gráficos) e "Observações e conclusões executivas".
 * Um arquivo só, estilos inline e gráficos em SVG: abre offline e imprime em PDF pelo navegador.
 */
import { formatCompact, type GoalStatus } from "./indicators";
import type { IndicatorRow, ReportModel } from "./model";
import { buildCharts, chartCardHtml, PLATFORM_COLOR } from "./charts";
import { escapeHtml, formatLongTs, highlightsHtml, ICON_MET, ICON_MISSED, introText, REPORT_STATUS, type ReportStatus } from "./html";

export { escapeHtml } from "./html";

export const STATUS_LABEL: Record<GoalStatus, string> = {
  met: "Atingiu",
  missed: "Abaixo da meta",
  no_target: "Sem meta",
  no_data: "Sem dado",
};

/** Faixa de cada tabela do resumo, como na referência. */
export const GROUP_STYLE: Record<string, { title: string; color: string }> = {
  produto: { title: "GESTÃO DE PRODUTO", color: "#8B6CF0" },
  geniex: { title: "GENIEX", color: PLATFORM_COLOR.geniex },
  exploradores: { title: "EXPLORADORES", color: "#5B9DF0" },
  educadores: { title: "EDUCADORES", color: "#86C35E" },
};

const TXT = "#1a1a2e";
const MUT = "#6b7280";
const LINE = "#E5E7EB";

const resultCell = (s: GoalStatus) => (s === "met" ? ICON_MET : s === "missed" ? ICON_MISSED : `<span style="color:${MUT}" title="${STATUS_LABEL[s]}">—</span>`);

/** Rótulo curto da linha: "NorthStar", "CSAT", "Aderência", "Tempo de uso". */
export function rowName(r: IndicatorRow): string {
  if (r.key === "northstar") return "NorthStar";
  return r.label.replace(/ · .*$/, "").replace(/ \(.*\)$/, "");
}

function summaryTable(group: ReportModel["groups"][number], code: string) {
  const st = GROUP_STYLE[group.key];
  // Gestão de Produto mostra só a North Star (os componentes estão nas tabelas das plataformas)
  const rows = group.key === "produto" ? group.rows.filter((r) => r.key === "northstar") : group.rows;
  const cell = (s: string, align = "center", extra = "") =>
    `<td style="padding:8px 12px;border-top:1px solid ${LINE};border-left:1px solid ${LINE};text-align:${align};font-size:12.5px;color:${TXT};${extra}">${s}</td>`;
  const th = (s: string, align = "center") =>
    `<th style="padding:9px 12px;border-left:1px solid ${LINE};text-align:${align};font-size:12px;font-weight:700;color:${TXT};background:#F3F4F6">${escapeHtml(s)}</th>`;
  const body = rows
    .map(
      (r) =>
        `<tr>${cell(escapeHtml(rowName(r)), "left", "border-left:none")}${cell(escapeHtml(formatCompact(r.target, r.unit)))}${cell(escapeHtml(formatCompact(r.value, r.unit)))}${cell(
          escapeHtml(formatCompact(r.nextTarget, r.unit))
        )}${cell(resultCell(r.status))}</tr>`
    )
    .join("");
  return `<div style="border:1.5px solid ${st.color}66;border-radius:10px;overflow:hidden;margin:0 0 14px;background:#fff;break-inside:avoid">
<div style="background:${st.color};color:#fff;text-align:center;font-weight:700;font-size:12px;letter-spacing:.03em;padding:7px">${st.title}</div>
<table style="width:100%;border-collapse:collapse;table-layout:fixed" cellspacing="0" cellpadding="0">
<colgroup><col style="width:22%"><col style="width:19%"><col style="width:19%"><col style="width:25%"><col style="width:15%"></colgroup>
<thead><tr>${th("Indicador", "left").replace(`border-left:1px solid ${LINE};`, "")}${th(`Meta (${code})`)}${th("Realizado")}${th("Nova Meta (Próxima Quinzena)")}${th("Resultado")}</tr></thead>
<tbody>${body}</tbody></table></div>`;
}

export function renderReportHtml(m: ReportModel, opts: { generatedAt: string; status: ReportStatus }): string {
  const status = REPORT_STATUS[opts.status];
  const charts = buildCharts(m).map(chartCardHtml).join("");
  const notes = m.notes.trim()
    ? `<div style="white-space:pre-wrap;font-size:13px;line-height:1.6;color:${TXT}">${escapeHtml(m.notes.trim())}</div>`
    : `<div style="font-size:13px;color:${MUT}">Sem observações registradas.</div>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Report da Área - Gestão de Produto · ${escapeHtml(m.code)}</title>
<style>@media print{body{padding:0!important;background:#fff!important}}@media (max-width:760px){.pr-grid{grid-template-columns:1fr!important}}</style></head>
<body style="margin:0;padding:28px 20px;background:#F7F7FA;color:${TXT};font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<main style="max-width:1000px;margin:0 auto;background:#fff;border:1px solid #ECECF2;border-radius:16px;padding:28px 28px 24px">
<header>
  <div style="font-size:11px;color:${MUT}">Luumu · Relatórios › Report Quinzenal</div>
  <h1 style="margin:6px 0 4px;font-size:24px;letter-spacing:-.01em">Report da Área - Gestão de Produto</h1>
  <div style="display:flex;align-items:center;gap:10px;font-size:15px;color:#374151">Período: ${escapeHtml(m.datesShort)} (${escapeHtml(m.code)})
    <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:${status.bg};color:${status.fg}">${status.label}</span></div>
</header>

<div style="white-space:pre-wrap;font-size:14px;color:#374151;line-height:1.6;margin:18px 0 22px">${escapeHtml(introText(m))}</div>

<h2 style="font-size:16px;margin:0 0 10px">1. Resumo dos Indicadores</h2>
${m.groups.map((g) => summaryTable(g, m.code)).join("\n")}

<h2 style="font-size:16px;margin:22px 0 12px">2. Highlights</h2>
${highlightsHtml(m.highlights, { font: "inherit", color: TXT, muted: MUT })}

<h2 style="font-size:16px;margin:22px 0 10px">3. Evolução dos Indicadores</h2>
<div class="pr-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${charts}</div>

<div style="border:1px solid #ECECF2;border-radius:12px;padding:14px 16px;margin-top:22px;break-inside:avoid">
  <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${TXT}" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>Observações e conclusões executivas</div>
  <div style="border:1px solid ${LINE};border-radius:8px;padding:12px 14px;margin-top:10px">${notes}</div>
</div>

<p style="font-size:10.5px;color:${MUT};margin:16px 0 0">Gerado em ${escapeHtml(formatLongTs(opts.generatedAt))}${
    m.sync.at ? ` · dados da Luumu atualizados em ${escapeHtml(formatLongTs(m.sync.at))}` : ""
  } · NorthStar = soma de (realizado ÷ meta × peso) de CSAT (${m.weights.csat}), Aderência (${m.weights.adherence}) e Tempo de uso (${m.weights.usage}), com a média das plataformas.</p>
</main></body></html>`;
}
