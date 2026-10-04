/*
  Núcleo dos Heatmaps. PURO e testado — usado pelo SDK (formato do que é enviado), pela API
  (validação do que chega) e pelo painel (curvas, seções, caminhos, cores).

  O que o SDK manda por VISITA a uma página (um "pageview"):
   - cliques ancorados no ELEMENTO (seletor + posição dentro dele, 0–1000). Ancorar no
     elemento, e não no pixel da tela, faz o clique cair no lugar certo do print da página
     mesmo que o visitante tivesse outra largura de janela;
   - movimento do cursor no mesmo formato, já agregado numa grade 10×10 por elemento;
   - tempo de cursor parado sobre elementos (hover), em ms;
   - profundidade máxima de rolagem e de cursor (0–100% da altura da página);
   - os primeiros elementos clicados, em ordem (o "caminho");
   - tempo ativo na página.
  Nunca: valor digitado em campo, senha, posição absoluta do mouse na tela.
*/

export const HEATMAP_DEVICES = ["desktop", "tablet", "mobile"] as const;
export type HeatmapDevice = (typeof HEATMAP_DEVICES)[number];
export type HeatmapMode = "clicks" | "moves" | "scroll";

/** Tetos por visita: limitam o tamanho de cada envio (sendBeacon aceita ~64 KB). */
export const LIMITS = {
  clicks: 60,
  moveCells: 160,
  hovers: 25,
  path: 4,
  selector: 300,
  label: 60,
  durationMs: 2 * 60 * 60 * 1000,
};

/** Grade do movimento dentro de cada elemento (GRID × GRID células). */
export const MOVE_GRID = 10;
/** Validade da cópia da página: depois disso o SDK manda uma nova. */
export const SNAPSHOT_TTL_DAYS = 7;
/** Tamanho máximo do HTML da cópia da página (antes da compressão). */
export const SNAPSHOT_MAX_BYTES = 2_500_000;

export interface PageviewPayload {
  key: string;
  host: string;
  path: string;
  device: HeatmapDevice;
  sid: string;
  vw: number;
  vh: number;
  dh: number;
  dur: number;
  sd: number;
  md: number;
  /** cliques: [seletor, x 0–1000, y 0–1000] */
  c: [string, number, number][];
  /** movimento: "seletor|gx|gy" → amostras */
  m: Record<string, number>;
  /** hover: seletor → ms */
  h: Record<string, number>;
  /** rótulos curtos dos elementos citados acima */
  l: Record<string, string>;
  /** primeiros elementos clicados, em ordem, sem repetição seguida */
  p: string[];
  /** fração das sessões que estão sendo gravadas (amostragem); 1 = todas */
  r: number;
}

const int = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Mesma redação de dados pessoais da IA: rótulos podem conter nome, e-mail, telefone… */
export function redactLabel(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "•••@•••")
    .replace(/\d[\d.\-/\s]{5,}\d/g, "•••")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITS.label);
}

/** Seletor aceitável: CSS curto, sem nada que pareça código ("&gt;" é o separador de filhos: vale). */
export function validSelector(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= LIMITS.selector && !/[<{};]|javascript:/i.test(s);
}

/**
 * Valida e limita um envio do SDK. Tudo que vem do navegador é entrada não confiável
 * (qualquer pessoa com a key pública pode postar): números são presos aos limites, textos
 * cortados, listas truncadas. Devolve null se o essencial faltar.
 */
export function parsePageview(raw: unknown): PageviewPayload | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const path = str(o.path, 200);
  const sid = str(o.sid, 64);
  if (!path || !sid || typeof o.key !== "string") return null;
  const device = HEATMAP_DEVICES.includes(o.device as HeatmapDevice) ? (o.device as HeatmapDevice) : "desktop";

  const c: PageviewPayload["c"] = [];
  for (const it of Array.isArray(o.c) ? o.c.slice(0, LIMITS.clicks) : []) {
    if (!Array.isArray(it) || !validSelector(it[0])) continue;
    c.push([it[0], int(it[1], 0, 1000), int(it[2], 0, 1000)]);
  }

  const m: Record<string, number> = {};
  for (const [k, v] of Object.entries((o.m ?? {}) as Record<string, unknown>).slice(0, LIMITS.moveCells)) {
    const at = k.lastIndexOf("|", k.lastIndexOf("|") - 1);
    const sel = k.slice(0, at);
    const [gx, gy] = k.slice(at + 1).split("|").map(Number);
    if (!validSelector(sel) || !(gx >= 0 && gx < MOVE_GRID && gy >= 0 && gy < MOVE_GRID)) continue;
    m[`${sel}|${gx}|${gy}`] = int(v, 1, 10_000);
  }

  const h: Record<string, number> = {};
  for (const [k, v] of Object.entries((o.h ?? {}) as Record<string, unknown>).slice(0, LIMITS.hovers)) {
    if (validSelector(k)) h[k] = int(v, 0, LIMITS.durationMs);
  }

  const cited = new Set([...c.map((x) => x[0]), ...Object.keys(h)]);
  const p = (Array.isArray(o.p) ? o.p : []).filter(validSelector).slice(0, LIMITS.path);
  p.forEach((s) => cited.add(s));
  const l: Record<string, string> = {};
  for (const [k, v] of Object.entries((o.l ?? {}) as Record<string, unknown>)) {
    if (cited.has(k) && typeof v === "string") {
      const label = redactLabel(v);
      if (label) l[k] = label;
    }
  }

  return {
    key: o.key,
    host: str(o.host, 253).toLowerCase(),
    path,
    device,
    sid,
    vw: int(o.vw, 0, 10_000),
    vh: int(o.vh, 0, 10_000),
    dh: int(o.dh, 0, 200_000),
    dur: int(o.dur, 0, LIMITS.durationMs),
    sd: int(o.sd, 0, 100),
    md: int(o.md, 0, 100),
    c,
    m,
    h,
    l,
    p,
    r: Math.min(1, Math.max(0.001, Number(o.r) || 1)),
  };
}

/** Caminho gravado no banco: os 3 primeiros elementos clicados ("a > b > c"); null se < 2. */
export function clickPathKey(p: string[]): string | null {
  const steps = p.slice(0, 3);
  return steps.length >= 2 ? steps.join(" ⟶ ").slice(0, 900) : null;
}
export const splitPath = (k: string) => k.split(" ⟶ ");

/** Página legível: "home" vira "Página inicial"; o resto ganha a barra inicial. */
export function pageLabel(path: string): string {
  return path === "home" || path === "" ? "Página inicial" : `/${path.replace(/^\/+/, "")}`;
}

/* ---------- rolagem ---------- */

/**
 * Curva de alcance: reach[p] = fração das visitas que viram até p% da página (0–100).
 * `hist` é quantas visitas pararam em cada profundidade máxima.
 */
export function reachCurve(hist: { depth: number; n: number }[]): number[] {
  const at = new Array(101).fill(0);
  let total = 0;
  for (const { depth, n } of hist) {
    at[Math.min(100, Math.max(0, Math.round(depth)))] += n;
    total += n;
  }
  const reach = new Array(101).fill(0);
  let acc = 0;
  for (let p = 100; p >= 0; p--) {
    acc += at[p];
    reach[p] = total ? acc / total : 0;
  }
  // o topo da página é visto por todo mundo
  if (total) reach[0] = 1;
  return reach;
}

/** Alcance numa posição contínua (0–100), interpolado. */
export function reachAt(curve: number[], pct: number): number {
  const p = Math.min(100, Math.max(0, pct));
  const lo = Math.floor(p);
  const hi = Math.min(100, lo + 1);
  return curve[lo] + (curve[hi] - curve[lo]) * (p - lo);
}

export interface Section {
  label: string;
  /** início da seção, em % da altura da página */
  top: number;
}

export interface SectionStat extends Section {
  reach: number;
  /** quanto do público some entre o início desta seção e o da próxima */
  drop: number;
}

/** Alcance e queda por seção (seções em ordem na página). */
export function sectionStats(sections: Section[], curve: number[]): SectionStat[] {
  const sorted = [...sections].sort((a, b) => a.top - b.top);
  return sorted.map((s, i) => {
    const reach = reachAt(curve, s.top);
    const next = sorted[i + 1];
    const end = next ? reachAt(curve, next.top) : reachAt(curve, 100);
    return { ...s, reach, drop: Math.max(0, reach - end) };
  });
}

/** Pontos de maior abandono: as maiores quedas, só as relevantes (≥ 3 p.p.). */
export function biggestDrops(stats: SectionStat[], n = 3): SectionStat[] {
  return [...stats].filter((s) => s.drop >= 0.03).sort((a, b) => b.drop - a.drop).slice(0, n);
}

/** Distribui contagens de profundidade em faixas de 25%: quantos chegaram a cada marco. */
export function depthMilestones(curve: number[], total: number) {
  return [25, 50, 75, 100].map((p) => ({ depth: p, reach: curve[p] ?? 0, sessions: Math.round((curve[p] ?? 0) * total) }));
}

/* ---------- comparação ---------- */

/** Variação percentual (null sem base). */
export function pctChange(cur: number, prev: number | null | undefined): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${String(r).padStart(2, "0")}s` : `${m}m`;
}

/* ---------- cores do mapa de calor ---------- */

/** Paleta clássica (azul → ciano → verde → amarelo → vermelho), 256 cores RGBA. */
export function heatPalette(): Uint8ClampedArray {
  const stops: [number, [number, number, number]][] = [
    [0, [40, 60, 255]],
    [0.25, [0, 200, 255]],
    [0.5, [40, 220, 90]],
    [0.75, [255, 220, 0]],
    [1, [255, 40, 40]],
  ];
  const out = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k];
    const [t1, c1] = stops[k + 1];
    const f = (t - t0) / (t1 - t0 || 1);
    for (let j = 0; j < 3; j++) out[i * 4 + j] = Math.round(c0[j] + (c1[j] - c0[j]) * f);
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Cor da rolagem para um alcance 0–1 (vermelho = todos viram, azul = quase ninguém). */
export function reachColor(reach: number, palette = heatPalette()): [number, number, number] {
  const i = Math.round(Math.min(1, Math.max(0, reach)) * 255) * 4;
  return [palette[i], palette[i + 1], palette[i + 2]];
}

/**
 * Fração das sessões a gravar: a cota do mês que sobra dividida pelos dias restantes (com teto
 * diário), sobre o volume diário estimado. Sem histórico, grava tudo; cota esgotada, nada.
 */
export function heatmapSampleRate(i: { limit: number; used: number; daysLeft: number; estimatedDaily: number; dailyCap: number }): number {
  if (i.limit <= 0 || (i.limit !== Infinity && i.used >= i.limit)) return 0;
  if (i.estimatedDaily <= 0) return 1;
  const perDay = Math.min(i.dailyCap, i.limit === Infinity ? i.dailyCap : (i.limit - i.used) / Math.max(1, i.daysLeft));
  const rate = Math.min(1, Math.max(0.01, perDay / i.estimatedDaily));
  return Math.round(rate * 1000) / 1000;
}
