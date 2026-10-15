/**
 * Os 6 gráficos da seção "2. Evolução dos Indicadores" do report de referência, definidos uma
 * vez só e desenhados em três lugares com o mesmo resultado: a tela da Luumu e o HTML exportado
 * (SVG, via chartCardHtml) e o PDF (pdfkit, a partir das mesmas primitivas de layoutChart).
 *
 *   Educadores, Exploradores e GenieX · Aderência: realizado, "Meta da plataforma" (a meta de
 *     cada quinzena) e "Meta Qx/mm" (a meta da quinzena do report, reta);
 *   CSAT Médio das Plataformas; Tempo de uso (+ média da quinzena);
 *   NorthStar (+ média anual).
 * Quinzena sem dado quebra a linha (não liga pontos distantes nem inventa valor).
 */
import { formatCompact, PLATFORMS, type GoalKey, type PlatformKey } from "./indicators";
import type { ReportModel } from "./model";
import { escapeHtml } from "./html";

export const SERIES_COLOR = "#2563EB";
export const REF_COLOR = "#9CA3AF";
const GRID = "#E5E7EB";
const MUT = "#6B7280";

/** Cores das plataformas (faixas das tabelas e etiquetas dos gráficos), como na referência. */
export const PLATFORM_COLOR: Record<PlatformKey, string> = {
  educadores: "#6DBE45",
  exploradores: "#4F8FF0",
  geniex: "#5F6368",
};

export interface ChartSpec {
  id: string;
  tag: string;
  tagColor: string;
  title: string;
  /** linha pequena centralizada acima do gráfico, ex.: "(minutos)" */
  subtitle?: string;
  /** texto do ícone (i) ao lado do título */
  info?: string;
  unit: "%" | "min";
  ticks: string[];
  values: (number | null)[];
  seriesLabel: string;
  refs: { label: string; values: (number | null)[]; dash: [number, number] }[];
  stats: { label: string; value: string; kind: "value" | "goal" }[];
  domain: [number, number];
  yTicks: number[];
}

const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Escala "redonda" de 10 em 10 envolvendo os valores (e o que mais precisar caber). */
function niceDomain(vals: (number | null)[], opts: { floor?: number; ceil?: number; step?: number } = {}): { domain: [number, number]; yTicks: number[] } {
  const xs = vals.filter(num);
  const step = opts.step ?? 10;
  let lo = xs.length ? Math.floor((Math.min(...xs) - step / 2) / step) * step : 0;
  let hi = xs.length ? Math.ceil((Math.max(...xs) + step / 2) / step) * step : 100;
  if (opts.floor !== undefined) lo = Math.max(opts.floor, lo);
  if (opts.ceil !== undefined) hi = Math.max(hi, opts.ceil);
  if (hi <= lo) hi = lo + step;
  // no máximo ~6 marcas
  const span = hi - lo;
  const tick = span / step > 6 ? Math.ceil(span / step / 5) * step : step;
  const yTicks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += tick) yTicks.push(Math.round(v * 100) / 100);
  return { domain: [lo, yTicks[yTicks.length - 1]], yTicks };
}

const flat = (n: number, v: number | null) => Array.from({ length: n }, () => v);

export function buildCharts(m: ReportModel): ChartSpec[] {
  const ticks = m.history.map((h) => h.tick);
  const series = (k: GoalKey) => m.history.map((h) => h.values[k] ?? null);
  const goals = (k: GoalKey) => m.history.map((h) => h.targets[k] ?? null);
  const current = (k: GoalKey) => m.history[m.history.length - 1]?.values[k] ?? null;
  const currentGoal = (k: GoalKey) => m.history[m.history.length - 1]?.targets[k] ?? null;
  const n = ticks.length;

  const adherence = (["educadores", "exploradores", "geniex"] as PlatformKey[]).map((p): ChartSpec => {
    const label = PLATFORMS.find((x) => x.key === p)!.label;
    const k = `${p}.adherence` as GoalKey;
    return {
      id: `adherence-${p}`,
      tag: `${label} - Aderência`,
      tagColor: PLATFORM_COLOR[p],
      title: `Aderência (Stickiness) - ${label}`,
      info: "DAU médio da quinzena ÷ MAU (usuários ativos nos 30 dias até o fim da quinzena), do Analytics da Luumu.",
      unit: "%",
      ticks,
      values: series(k),
      seriesLabel: "Aderência (Stickiness)",
      refs: [
        { label: "Meta da plataforma", values: goals(k), dash: [7, 4] },
        { label: `Meta ${m.code}`, values: flat(n, currentGoal(k)), dash: [3, 3] },
      ],
      stats: [
        { label: `Média ${m.code}`, value: formatCompact(current(k), "%"), kind: "value" },
        { label: "Meta", value: formatCompact(currentGoal(k), "%"), kind: "goal" },
      ],
      domain: [0, 100],
      yTicks: [0, 20, 40, 60, 80, 100],
    };
  });

  const csat = series("ns.csat");
  const usage = series("ns.usage");
  const ns = series("northstar");
  const usageNow = current("ns.usage");

  return [
    ...adherence,
    {
      id: "csat",
      tag: "CSAT Médio das Plataformas",
      tagColor: "#7C3AED",
      title: `CSAT Médio das Plataformas - ${m.title}`,
      info: "Média do CSAT de Exploradores e Educadores (o GenieX não tem CSAT).",
      unit: "%",
      ticks,
      values: csat,
      seriesLabel: "CSAT médio (todas as plataformas)",
      refs: [],
      stats: [],
      ...niceDomain(csat, { floor: 0, ceil: 100 }),
    },
    {
      id: "usage",
      tag: "Tempo de uso",
      tagColor: "#8B5CF6",
      title: `Tempo Médio de Uso - ${m.title}`,
      subtitle: "(minutos)",
      info: "Média das plataformas do tempo médio de uso (duração média das sessões) do Analytics da Luumu.",
      unit: "min",
      ticks,
      values: usage,
      seriesLabel: "Tempo médio de uso (minutos)",
      refs: [{ label: `Média (${m.code})`, values: flat(n, usageNow), dash: [6, 4] }],
      stats: [],
      ...niceDomain([...usage, usageNow], { floor: 0, step: usage.some((v) => num(v) && v > 30) ? 10 : 5 }),
    },
    {
      id: "northstar",
      tag: "NorthStar - Média Anual",
      tagColor: "#1E3A5F",
      title: `NorthStar - Evolução Quinzenal + Média Anual - ${m.title}`,
      info: "Soma de (realizado ÷ meta × peso) de CSAT, Aderência e Tempo de uso; 100% = tudo exatamente na meta.",
      unit: "%",
      ticks,
      values: ns,
      seriesLabel: "NorthStar (%)",
      refs: [{ label: `Média anual (${formatCompact(m.yearAverage, "%")})`, values: flat(n, m.yearAverage), dash: [6, 4] }],
      stats: [],
      ...niceDomain([...ns, m.yearAverage], { floor: 0 }),
    },
  ];
}

/* ---------- layout em primitivas (compartilhado por SVG e PDF) ---------- */

export type Prim =
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; color: string; width: number; dash?: [number, number] }
  | { t: "path"; pts: [number, number][]; color: string; width: number; dash?: [number, number] }
  | { t: "circle"; cx: number; cy: number; r: number; fill: string; stroke?: string }
  | { t: "rect"; x: number; y: number; w: number; h: number; r: number; fill: string }
  | { t: "text"; x: number; y: number; text: string; size: number; color: string; anchor: "start" | "middle" | "end"; bold?: boolean };

export const PLOT = { W: 520, H: 210 };

/** Segmentos contínuos (índices) de uma série com buracos. */
export function segments(values: (number | null)[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  values.forEach((v, i) => {
    if (num(v)) cur.push(i);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  });
  if (cur.length) out.push(cur);
  return out;
}

/** Largura aproximada de um texto em Helvetica/Inter (média por caractere). */
const textW = (s: string, size: number, bold = false) => s.length * size * (bold ? 0.6 : 0.55);

/** `font`: corpo do texto do eixo; margens e rótulos acompanham (o PDF usa gráficos menores). */
export function layoutChart(spec: ChartSpec, W = PLOT.W, H = PLOT.H, font = 8.5): Prim[] {
  const k = font / 8.5;
  const m = { top: 22 * k, right: 22 * k, bottom: 22 * k, left: 38 * k };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const [lo, hi] = spec.domain;
  const n = spec.ticks.length;
  // folga nas pontas: o rótulo do primeiro/último ponto não cobre o eixo
  const inset = 20 * k;
  const x = (i: number) => m.left + inset + (n <= 1 ? (iw - 2 * inset) / 2 : (i * (iw - 2 * inset)) / (n - 1));
  const y = (v: number) => m.top + ih - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo || 1)) * ih;
  const fmtTick = (v: number) => (spec.unit === "%" ? `${v.toLocaleString("pt-BR")}%` : v.toLocaleString("pt-BR"));
  const out: Prim[] = [];

  for (const v of spec.yTicks) {
    out.push({ t: "line", x1: m.left, y1: y(v), x2: W - m.right, y2: y(v), color: GRID, width: 0.8, dash: [2, 3] });
    out.push({ t: "text", x: m.left - 6 * k, y: y(v) + 3 * k, text: fmtTick(v), size: font, color: MUT, anchor: "end" });
  }
  out.push({ t: "line", x1: m.left, y1: m.top + ih, x2: W - m.right, y2: m.top + ih, color: "#D1D5DB", width: 1 });
  spec.ticks.forEach((t, i) => out.push({ t: "text", x: x(i), y: H - 6 * k, text: t, size: font, color: MUT, anchor: "middle" }));

  for (const ref of spec.refs) {
    for (const seg of segments(ref.values)) {
      if (seg.length === 1) {
        // um ponto só: traço curto para a meta continuar visível
        const i = seg[0];
        const v = ref.values[i] as number;
        out.push({ t: "line", x1: x(i) - 14 * k, y1: y(v), x2: x(i) + 14 * k, y2: y(v), color: REF_COLOR, width: 1.3 * k, dash: ref.dash });
      } else out.push({ t: "path", pts: seg.map((i) => [x(i), y(ref.values[i] as number)]), color: REF_COLOR, width: 1.3 * k, dash: ref.dash });
    }
  }

  for (const seg of segments(spec.values)) {
    if (seg.length > 1) out.push({ t: "path", pts: seg.map((i) => [x(i), y(spec.values[i] as number)]), color: SERIES_COLOR, width: 2 * k });
  }
  spec.values.forEach((v, i) => {
    if (!num(v)) return;
    out.push({ t: "circle", cx: x(i), cy: y(v), r: 3.2 * k, fill: SERIES_COLOR, stroke: "#FFFFFF" });
    const label = formatCompact(v, spec.unit).replace(" min", "");
    const w = textW(label, font, true) + 8 * k;
    const top = Math.max(1, y(v) - 21 * k);
    out.push({ t: "rect", x: x(i) - w / 2, y: top, w, h: 13 * k, r: 2.5 * k, fill: SERIES_COLOR });
    out.push({ t: "text", x: x(i), y: top + 9.3 * k, text: label, size: font, color: "#FFFFFF", anchor: "middle", bold: true });
  });
  return out;
}

/* ---------- SVG (tela e HTML exportado) ---------- */

/** Cores de texto/grade viram variáveis do tema na tela (modo escuro); no arquivo valem os hex. */
const themed = (c: string) => (c === MUT ? `var(--text-mut,${MUT})` : c === GRID ? `var(--border,${GRID})` : c);
const f = (n: number) => n.toFixed(1);

export function chartSvg(spec: ChartSpec, W = PLOT.W, H = PLOT.H): string {
  const body = layoutChart(spec, W, H)
    .map((p) => {
      switch (p.t) {
        case "line":
          return `<line x1="${f(p.x1)}" y1="${f(p.y1)}" x2="${f(p.x2)}" y2="${f(p.y2)}" style="stroke:${themed(p.color)};stroke-width:${p.width}${p.dash ? `;stroke-dasharray:${p.dash.join(" ")}` : ""}"/>`;
        case "path":
          return `<polyline points="${p.pts.map(([a, b]) => `${f(a)},${f(b)}`).join(" ")}" style="fill:none;stroke:${p.color};stroke-width:${p.width};stroke-linejoin:round${p.dash ? `;stroke-dasharray:${p.dash.join(" ")}` : ""}"/>`;
        case "circle":
          return `<circle cx="${f(p.cx)}" cy="${f(p.cy)}" r="${p.r}" style="fill:${p.fill}${p.stroke ? `;stroke:${p.stroke};stroke-width:1.2` : ""}"/>`;
        case "rect":
          return `<rect x="${f(p.x)}" y="${f(p.y)}" width="${f(p.w)}" height="${f(p.h)}" rx="${p.r}" style="fill:${p.fill}"/>`;
        case "text":
          return `<text x="${f(p.x)}" y="${f(p.y)}" text-anchor="${p.anchor}" style="font-size:${p.size}px;fill:${themed(p.color)}${p.bold ? ";font-weight:700" : ""}">${escapeHtml(p.text)}</text>`;
      }
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${escapeHtml(spec.title)}" style="display:block;font-family:inherit">${body}</svg>`;
}

const ICON_VALUE = `<svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M12 2.5c-.3 0-.6.2-.8.4C9 5.8 5.5 10.4 5.5 14a6.5 6.5 0 0 0 13 0c0-3.6-3.5-8.2-5.7-11.1-.2-.2-.5-.4-.8-.4z"/></svg>`;
const ICON_GOAL = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><circle cx="12" cy="9" r="2.5"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/></svg>`;
const ICON_INFO = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`;

const legendLine = (dash?: [number, number], marker = false) =>
  `<svg width="26" height="10" viewBox="0 0 26 10" style="flex:none"><line x1="1" y1="5" x2="25" y2="5" style="stroke:${dash ? REF_COLOR : SERIES_COLOR};stroke-width:${dash ? 1.3 : 2}${dash ? `;stroke-dasharray:${dash.join(" ")}` : ""}"/>${
    marker ? `<rect x="9.5" y="1.5" width="7" height="7" rx="1" style="fill:${SERIES_COLOR}"/>` : ""
  }</svg>`;

/** Cartão completo do gráfico (etiqueta, título, médias, gráfico e legenda), com estilos inline. */
export function chartCardHtml(spec: ChartSpec): string {
  const stats = spec.stats
    .map((s) =>
      s.kind === "value"
        ? `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:${SERIES_COLOR}">${ICON_VALUE}</span><div><div style="font-size:9px;color:var(--text-mut,${MUT})">${escapeHtml(s.label)}</div><div style="font-size:15px;font-weight:800;color:${SERIES_COLOR};line-height:1.1">${escapeHtml(s.value)}</div></div></div>`
        : `<div style="display:flex;align-items:center;gap:6px;color:var(--text-mut,${MUT})">${ICON_GOAL}<div><div style="font-size:9px">${escapeHtml(s.label)}</div><div style="font-size:13px;font-weight:700;color:var(--text-soft,#374151);line-height:1.1">${escapeHtml(s.value)}</div></div></div>`
    )
    .join("");
  const legend = [
    `<span style="display:inline-flex;align-items:center;gap:5px">${legendLine(undefined, true)}${escapeHtml(spec.seriesLabel)}</span>`,
    ...spec.refs.map((r) => `<span style="display:inline-flex;align-items:center;gap:5px">${legendLine(r.dash)}${escapeHtml(r.label)}</span>`),
  ].join("");
  return `<div style="border:1px solid var(--border,#E7E5F0);border-radius:12px;padding:14px 16px 12px;background:var(--bg-elev,#fff);break-inside:avoid">
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
<div style="min-width:0"><span style="display:inline-block;background:${spec.tagColor};color:#fff;font-weight:700;font-size:12px;padding:3px 9px;border-radius:4px">${escapeHtml(spec.tag)}</span>
<div style="margin-top:8px;font-weight:700;font-size:13px;color:var(--text,#1a1a2e);display:flex;align-items:center;gap:5px">${escapeHtml(spec.title)}${
    spec.info ? `<span title="${escapeHtml(spec.info)}" style="color:var(--text-mut,${MUT});display:inline-flex;cursor:help">${ICON_INFO}</span>` : ""
  }</div></div>
${stats ? `<div style="display:flex;gap:16px;flex:none">${stats}</div>` : ""}
</div>
${spec.subtitle ? `<div style="text-align:center;font-size:10px;color:var(--text-mut,${MUT});margin-top:2px">${escapeHtml(spec.subtitle)}</div>` : ""}
<div style="margin-top:6px">${chartSvg(spec)}</div>
<div style="display:flex;justify-content:center;flex-wrap:wrap;gap:6px 18px;font-size:10px;color:var(--text-mut,${MUT});margin-top:4px">${legend}</div>
</div>`;
}
