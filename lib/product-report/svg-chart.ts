/**
 * Gráfico de linha em SVG puro (sem JS) para o relatório exportado: valor realizado por quinzena
 * e a meta vigente como linha tracejada. Quinzena sem dado quebra a linha em vez de ligar pontos
 * distantes (não inventa a evolução).
 */
import { formatValue } from "./indicators";

export interface ChartPoint {
  label: string;
  value: number | null;
  target: number | null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (v: number | null): v is number => typeof v === "number" && Number.isFinite(v);

/** Faixa do eixo Y com folga, incluindo metas; [0, 1] se não houver nada. */
export function chartDomain(points: ChartPoint[]): [number, number] {
  const all = points.flatMap((p) => [p.value, p.target]).filter(num);
  if (!all.length) return [0, 1];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (lo === hi) {
    lo -= Math.abs(lo) * 0.1 || 1;
    hi += Math.abs(hi) * 0.1 || 1;
  }
  const pad = (hi - lo) * 0.15;
  return [Math.max(0, lo - pad), hi + pad];
}

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

export function lineChartSvg(points: ChartPoint[], opts: { unit: "%" | "min" | "pts"; width?: number; height?: number; color?: string }): string {
  const W = opts.width ?? 640;
  const H = opts.height ?? 200;
  const color = opts.color ?? "#6B2BD9";
  // à direita cabe metade do último rótulo do eixo ("Q2 set/26")
  const m = { top: 16, right: 30, bottom: 28, left: 52 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const [lo, hi] = chartDomain(points);
  const x = (i: number) => m.left + (points.length <= 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = (v: number) => m.top + ih - ((v - lo) / (hi - lo)) * ih;
  const fmt = (v: number) => formatValue(v, opts.unit);

  const parts: string[] = [];
  // grade: 4 linhas horizontais
  for (let k = 0; k <= 3; k++) {
    const v = lo + ((hi - lo) * k) / 3;
    parts.push(`<line x1="${m.left}" x2="${W - m.right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#e7e5f0" stroke-width="1"/>`);
    parts.push(`<text x="${m.left - 6}" y="${(y(v) + 3).toFixed(1)}" font-size="10" fill="#6b7280" text-anchor="end">${esc(fmt(v))}</text>`);
  }
  points.forEach((p, i) => parts.push(`<text x="${x(i).toFixed(1)}" y="${H - 8}" font-size="10" fill="#6b7280" text-anchor="middle">${esc(p.label)}</text>`));

  // meta: degraus tracejados (a meta muda de uma quinzena para outra)
  for (const seg of segments(points.map((p) => p.target))) {
    const d = seg
      .map((i, k) => {
        const t = points[i].target as number;
        const half = points.length <= 1 ? iw / 2 : iw / (points.length - 1) / 2;
        const x0 = Math.max(m.left, x(i) - half);
        const x1 = Math.min(W - m.right, x(i) + half);
        return `${k === 0 ? "M" : "L"}${x0.toFixed(1)},${y(t).toFixed(1)} L${x1.toFixed(1)},${y(t).toFixed(1)}`;
      })
      .join(" ");
    parts.push(`<path d="${d}" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="5 4"/>`);
  }

  for (const seg of segments(points.map((p) => p.value))) {
    const d = seg.map((i, k) => `${k === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(points[i].value as number).toFixed(1)}`).join(" ");
    parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`);
  }
  points.forEach((p, i) => {
    if (!num(p.value)) return;
    const below = num(p.target) && p.value < p.target;
    parts.push(`<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.5" fill="${below ? "#dc2626" : color}"/>`);
    parts.push(`<text x="${x(i).toFixed(1)}" y="${(y(p.value) - 8).toFixed(1)}" font-size="10" font-weight="600" fill="#1a1a2e" text-anchor="middle">${esc(fmt(p.value))}</text>`);
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" role="img">${parts.join("")}</svg>`;
}
