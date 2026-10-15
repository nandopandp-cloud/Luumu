/**
 * Relatório exportado em HTML: um arquivo só, com estilos inline e gráficos em SVG (abre offline,
 * imprime em PDF pelo navegador). Seções na ordem do report quinzenal de referência:
 *   1 título e período · 2 Gestão de Produto · 3 GenieX · 4 Exploradores · 5 Educadores ·
 *   6 evolução · 7 gráficos · 8 comparação com as metas · 9 observações · 10 data de geração.
 */
import { formatDelta, formatValue, METRIC_META, NORTH_STAR, type GoalKey, type GoalStatus } from "./indicators";
import type { IndicatorRow, ReportModel } from "./model";
import { periodShortLabel } from "./period";
import { lineChartSvg, type ChartPoint } from "./svg-chart";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export const STATUS_LABEL: Record<GoalStatus, string> = {
  met: "Atingiu",
  missed: "Abaixo da meta",
  no_target: "Sem meta",
  no_data: "Sem dado",
};
const STATUS_COLOR: Record<GoalStatus, [string, string]> = {
  met: ["#DCFCE7", "#15803d"],
  missed: ["#FEE2E2", "#b91c1c"],
  no_target: ["#F3F4F6", "#4b5563"],
  no_data: ["#FEF3C7", "#92400e"],
};

const ROXO = "#6B2BD9";
const TXT = "#1a1a2e";
const MUT = "#6b7280";
const LINE = "#e7e5f0";

const fmtTs = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

const badge = (s: GoalStatus) => {
  const [bg, fg] = STATUS_COLOR[s];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${bg};color:${fg};font-size:11px;font-weight:700;white-space:nowrap">${STATUS_LABEL[s]}</span>`;
};

const th = (s: string, align = "left") =>
  `<th style="text-align:${align};padding:8px 10px;background:${ROXO};color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(s)}</th>`;
const td = (s: string, align = "left", extra = "") => `<td style="text-align:${align};padding:8px 10px;border-bottom:1px solid ${LINE};font-size:13px;${extra}">${s}</td>`;

const table = (head: string, body: string) =>
  `<table style="width:100%;border-collapse:collapse;margin:8px 0 4px" cellspacing="0" cellpadding="0"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;

const section = (n: number, title: string, body: string) =>
  `<section style="margin:28px 0 0"><h2 style="font-size:17px;color:${ROXO};margin:0 0 6px">${n}. ${escapeHtml(title)}</h2>${body}</section>`;

const targetCell = (r: IndicatorRow, which: "target" | "next") => {
  const v = which === "target" ? r.target : r.nextTarget;
  const from = which === "target" ? r.targetFrom : r.nextTargetFrom;
  const inherited = from ? `<div style="font-size:10px;color:${MUT}">mantida de ${escapeHtml(periodShortLabel(from))}</div>` : "";
  return `${escapeHtml(formatValue(v, r.unit))}${inherited}`;
};

function platformTable(rows: IndicatorRow[]) {
  const head = [th("Indicador"), th("Meta", "right"), th("Realizado", "right"), th("Status"), th("Quinzena anterior", "right"), th("Variação", "right"), th("Nova meta", "right"), th("Fonte")].join("");
  const body = rows
    .map((r) => {
      const missed = r.status === "missed" ? `background:#FEF2F2;` : "";
      const source = r.source ? `${escapeHtml(r.source)}${r.detail ? `<div style="font-size:10px;color:${MUT}">${escapeHtml(r.detail)}</div>` : ""}` : "—";
      return `<tr>${[
        td(`<strong>${escapeHtml(METRIC_META[r.key.split(".")[1] as keyof typeof METRIC_META]?.label ?? r.label)}</strong> <span style="color:${MUT}">(${r.unit})</span>`, "left", missed),
        td(targetCell(r, "target"), "right", missed),
        td(`<strong>${escapeHtml(formatValue(r.value, r.unit))}</strong>`, "right", missed),
        td(badge(r.status), "left", missed),
        td(escapeHtml(formatValue(r.prev, r.unit)), "right", missed),
        td(escapeHtml(formatDelta(r.delta, r.unit)), "right", missed),
        td(targetCell(r, "next"), "right", missed),
        td(`<span style="font-size:11px;color:${MUT}">${source}</span>`, "left", missed),
      ].join("")}</tr>`;
    })
    .join("");
  return table(head, body);
}

function productTable(m: ReportModel) {
  const head = [th("Indicador"), th("Peso", "right"), th("Meta", "right"), th("Realizado", "right"), th("Normalizado", "right"), th("Resultado", "right"), th("Status"), th("Nova meta", "right")].join("");
  const comp = m.components
    .map((c) => {
      const r = c.row;
      return `<tr>${[
        td(`${escapeHtml(METRIC_META[c.metric].label)} <span style="color:${MUT}">(${r.unit})</span><div style="font-size:10px;color:${MUT}">média: ${c.platforms.map((p) => escapeHtml(formatValue(p.value, r.unit))).join(" · ")}</div>`),
        td(String(c.weight), "right"),
        td(targetCell(r, "target"), "right"),
        td(escapeHtml(formatValue(c.value, r.unit)), "right"),
        td(c.normalized === null ? "—" : escapeHtml(c.normalized.toLocaleString("pt-BR", { maximumFractionDigits: 3 })), "right"),
        td(escapeHtml(formatValue(c.result, "pts")), "right"),
        td(badge(r.status)),
        td(targetCell(r, "next"), "right"),
      ].join("")}</tr>`;
    })
    .join("");
  const ns = m.northStar;
  const nsRow = `<tr style="background:#F3EDFF">${[
    td(`<strong>North Star</strong> <span style="color:${MUT}">(soma dos resultados)</span>`),
    td(String(m.components.reduce((a, c) => a + c.weight, 0)), "right"),
    td(targetCell(ns, "target"), "right"),
    td(`<strong style="font-size:15px">${escapeHtml(formatValue(ns.value, "pts"))}</strong>`, "right"),
    td("", "right"),
    td(`<strong>${escapeHtml(formatValue(ns.value, "pts"))}</strong>`, "right"),
    td(badge(ns.status)),
    td(targetCell(ns, "next"), "right"),
  ].join("")}</tr>`;
  const prev = ns.prev === null ? "" : `<p style="font-size:12px;color:${MUT};margin:4px 0 0">Quinzena anterior: ${escapeHtml(formatValue(ns.prev, "pts"))} (${escapeHtml(formatDelta(ns.delta, "pts"))}).</p>`;
  return table(head, comp + nsRow) + prev;
}

const EVOLUTION_ROWS: GoalKey[] = [NORTH_STAR, "ns.csat", "ns.adherence", "ns.usage"];

function evolutionTable(m: ReportModel) {
  const rows = [...EVOLUTION_ROWS, ...m.groups.slice(1).flatMap((g) => g.rows.map((r) => r.key))];
  const labelOf = (k: GoalKey) => m.groups.flatMap((g) => g.rows).find((r) => r.key === k)?.label ?? k;
  const unitOf = (k: GoalKey) => m.groups.flatMap((g) => g.rows).find((r) => r.key === k)?.unit ?? "pts";
  const head = th("Indicador") + m.history.map((h) => th(h.label, "right")).join("");
  const body = rows
    .map((k) => {
      const u = unitOf(k);
      const cells = m.history.map((h) => {
        const v = h.values[k] ?? null;
        const t = h.targets[k] ?? null;
        const below = v !== null && t !== null && v < t;
        return td(escapeHtml(formatValue(v, u)), "right", below ? "color:#b91c1c;font-weight:600;" : "");
      });
      return `<tr>${td(escapeHtml(labelOf(k)), "left", k === NORTH_STAR ? "font-weight:700;" : "")}${cells.join("")}</tr>`;
    })
    .join("");
  return `<div style="overflow-x:auto">${table(head, body)}</div><p style="font-size:11px;color:${MUT};margin:4px 0 0">Em vermelho: abaixo da meta vigente na quinzena.</p>`;
}

function chart(m: ReportModel, key: GoalKey, title: string, unit: "%" | "min" | "pts") {
  const points: ChartPoint[] = m.history.map((h) => ({ label: h.label, value: h.values[key] ?? null, target: h.targets[key] ?? null }));
  return `<div style="border:1px solid ${LINE};border-radius:12px;padding:12px 12px 4px;margin:10px 0"><div style="font-weight:700;font-size:13px;margin-bottom:4px">${escapeHtml(title)}</div>${lineChartSvg(points, { unit })}<div style="font-size:10px;color:${MUT};margin-top:2px"><span style="color:${ROXO}">●</span> realizado &nbsp; <span style="color:#9ca3af">- - -</span> meta &nbsp; <span style="color:#dc2626">●</span> abaixo da meta</div></div>`;
}

function goalComparison(m: ReportModel) {
  const all = m.groups.flatMap((g) => g.rows.map((r) => ({ ...r, group: g.title })));
  const list = (status: GoalStatus) => {
    const items = all.filter((r) => r.status === status);
    if (!items.length) return `<p style="font-size:13px;color:${MUT};margin:4px 0">Nenhum.</p>`;
    return `<ul style="margin:4px 0 0;padding-left:18px">${items
      .map((r) => `<li style="font-size:13px;margin:2px 0">${escapeHtml(r.group)} · ${escapeHtml(r.label.replace(/ · .*$/, ""))}: <strong>${escapeHtml(formatValue(r.value, r.unit))}</strong>${r.target !== null ? ` (meta ${escapeHtml(formatValue(r.target, r.unit))})` : ""}</li>`)
      .join("")}</ul>`;
  };
  return `<div style="display:flex;gap:16px;flex-wrap:wrap"><div style="flex:1;min-width:240px"><h3 style="font-size:13px;color:#15803d;margin:8px 0 0">Atingiram a meta</h3>${list("met")}</div><div style="flex:1;min-width:240px"><h3 style="font-size:13px;color:#b91c1c;margin:8px 0 0">Abaixo da meta</h3>${list("missed")}</div></div>${
    all.some((r) => r.status === "no_data" || r.status === "no_target")
      ? `<p style="font-size:12px;color:${MUT};margin:8px 0 0">Sem dado ou sem meta: ${all
          .filter((r) => r.status === "no_data" || r.status === "no_target")
          .map((r) => `${escapeHtml(r.group)} · ${escapeHtml(r.label.replace(/ · .*$/, ""))}`)
          .join("; ")}.</p>`
      : ""
  }`;
}

export function renderReportHtml(m: ReportModel, opts: { generatedAt: string }): string {
  const groups = Object.fromEntries(m.groups.map((g) => [g.key, g]));
  const alerts = m.alerts.length
    ? `<div style="border:1px solid #FDE68A;background:#FFFBEB;border-radius:12px;padding:10px 14px;margin:16px 0 0"><strong style="font-size:12px;color:#92400e">Avisos sobre os dados</strong><ul style="margin:4px 0 0;padding-left:18px">${m.alerts
        .map((a) => `<li style="font-size:12px;color:#92400e">${escapeHtml(a.text)}</li>`)
        .join("")}</ul></div>`
    : "";
  const notes = m.notes.trim()
    ? `<div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(m.notes.trim())}</div>`
    : `<p style="font-size:13px;color:${MUT}">Sem observações registradas.</p>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Report Quinzenal de Produto · ${escapeHtml(m.label)}</title>
<style>@media print{body{padding:0!important}section{break-inside:avoid}}</style></head>
<body style="margin:0;padding:24px;background:#fff;color:${TXT};font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<main style="max-width:960px;margin:0 auto">
<header style="background:#F3EDFF;border-radius:16px;padding:20px 24px">
  <div style="font-size:12px;font-weight:700;color:${ROXO};letter-spacing:.08em;text-transform:uppercase">Luumu · Gestão de Produto</div>
  <h1 style="margin:6px 0 2px;font-size:26px">1. Report Quinzenal de Produto</h1>
  <div style="font-size:15px;font-weight:600">${escapeHtml(m.label)} <span style="color:${MUT};font-weight:400">(${escapeHtml(m.dates)})</span></div>
  ${m.closed ? "" : `<div style="margin-top:6px;font-size:12px;color:#92400e">Quinzena em andamento: resultados parciais.</div>`}
</header>
${alerts}
${section(2, "Gestão de Produto · North Star", productTable(m))}
${section(3, "GenieX", platformTable(groups.geniex.rows))}
${section(4, "Exploradores", platformTable(groups.exploradores.rows))}
${section(5, "Educadores", platformTable(groups.educadores.rows))}
${section(6, "Evolução dos indicadores", evolutionTable(m))}
${section(7, "Gráficos históricos", chart(m, NORTH_STAR, "North Star", "pts") + chart(m, "ns.csat", "CSAT (média Exploradores e Educadores)", "%") + chart(m, "ns.adherence", "Aderência (média das plataformas)", "%") + chart(m, "ns.usage", "Tempo de uso (média das plataformas)", "min"))}
${section(8, "Comparação com as metas", goalComparison(m))}
${section(9, "Observações e conclusões executivas", notes)}
${section(10, "Geração", `<p style="font-size:13px;margin:4px 0">Gerado em ${escapeHtml(fmtTs(opts.generatedAt))}${m.sync.at ? ` · dados da Luumu atualizados em ${escapeHtml(fmtTs(m.sync.at))}` : " · sem atualização da Luumu nesta quinzena"}.</p>
<p style="font-size:11px;color:${MUT};margin:4px 0">North Star = Σ (realizado ÷ meta × peso) dos componentes CSAT (${m.weights.csat}), Aderência (${m.weights.adherence}) e Tempo de uso (${m.weights.usage}), com a média das plataformas; mesma fórmula da planilha North Star.</p>`)}
</main></body></html>`;
}
