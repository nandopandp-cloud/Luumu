/*
  Desenho dos heatmaps sobre a cópia da página (no navegador do painel). Funções de DOM sem
  React: o componente PageMap só orquestra.

  A cópia é exibida num iframe `sandbox="allow-same-origin"` — SEM allow-scripts: nada do
  HTML enviado pelo site do cliente executa. Ainda assim ele é limpo de novo aqui (scripts,
  handlers, refresh, iframes), porque o envio vem de um navegador qualquer.
*/
import { heatPalette, reachAt, type Section } from "./core";

/** Limpa a cópia e devolve o HTML pronto para o srcdoc. */
export function sanitizeSnapshot(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,iframe,object,embed,frame,frameset,meta[http-equiv],link[rel=import],portal").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      if (/^on/i.test(a.name) || a.name === "srcdoc" || a.name === "ping") el.removeAttribute(a.name);
      else if (/^(href|src|action|formaction|xlink:href)$/i.test(a.name) && /^\s*(javascript|data:text\/html|vbscript):/i.test(a.value)) el.removeAttribute(a.name);
    }
  });
  // só uma <base>, e só http(s)
  const bases = Array.from(doc.querySelectorAll("base"));
  bases.slice(1).forEach((b) => b.remove());
  if (bases[0] && !/^https?:\/\//i.test(bases[0].getAttribute("href") ?? "")) bases[0].remove();
  // animações terminam na hora (no estado final) e nada fica "piscando" sob o mapa
  const st = doc.createElement("style");
  st.textContent =
    "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition:none!important;caret-color:transparent!important}html{scroll-behavior:auto!important}";
  doc.head.appendChild(st);
  return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Localiza elementos por seletor (com cache; seletor inválido = não encontrado). */
export function makeLocator(doc: Document) {
  const cache = new Map<string, Element | null>();
  return (sel: string): Element | null => {
    if (cache.has(sel)) return cache.get(sel)!;
    let el: Element | null = null;
    try {
      el = doc.querySelector(sel);
    } catch {}
    cache.set(sel, el);
    return el;
  };
}

/** Caixa do elemento em coordenadas do DOCUMENTO (independe da rolagem atual). */
export function boxOf(el: Element): Box | null {
  const win = el.ownerDocument.defaultView;
  const r = el.getBoundingClientRect();
  if (r.width < 1 && r.height < 1) return null;
  return { x: r.left + (win?.scrollX ?? 0), y: r.top + (win?.scrollY ?? 0), w: r.width, h: r.height };
}

export function docSize(doc: Document) {
  const d = doc.documentElement;
  const b = doc.body;
  return { w: Math.max(d.scrollWidth, b?.scrollWidth ?? 0, 1), h: Math.max(d.scrollHeight, b?.scrollHeight ?? 0, 1) };
}

export interface HeatPoint {
  x: number;
  y: number;
  w: number;
}

/**
 * Mapa de calor clássico: cada ponto vira uma mancha radial em tons de cinza (alfa
 * acumulado) e o resultado é colorido pela paleta azul→vermelho. `scale` reduz o canvas para
 * páginas longas (o CSS estica de volta).
 */
export function drawHeat(canvas: HTMLCanvasElement, points: HeatPoint[], opts: { radius: number; scale: number; opacity?: number }) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!points.length) return;
  const max = Math.max(...points.map((p) => p.w));
  const r = Math.max(4, opts.radius * opts.scale);
  for (const p of points) {
    const x = p.x * opts.scale;
    const y = p.y * opts.scale;
    // raiz: um ponto muito clicado não apaga os outros
    const a = Math.min(1, 0.12 + 0.88 * Math.sqrt(p.w / max));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pal = heatPalette();
  const op = opts.opacity ?? 0.82;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 6) {
      d[i + 3] = 0;
      continue;
    }
    const k = a * 4;
    d[i] = pal[k];
    d[i + 1] = pal[k + 1];
    d[i + 2] = pal[k + 2];
    d[i + 3] = Math.min(255, a * 1.5) * op;
  }
  ctx.putImageData(img, 0, 0);
}

/** Faixas de rolagem: vermelho onde todos chegam, azul onde quase ninguém. */
export function drawScroll(canvas: HTMLCanvasElement, curve: number[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const pal = heatPalette();
  const h = canvas.height;
  const step = 3;
  for (let y = 0; y < h; y += step) {
    const reach = reachAt(curve, (y / h) * 100);
    const k = Math.round(reach * 255) * 4;
    ctx.fillStyle = `rgba(${pal[k]},${pal[k + 1]},${pal[k + 2]},0.5)`;
    ctx.fillRect(0, y, canvas.width, step + 0.5);
  }
}

/**
 * Seções da página a partir dos títulos visíveis (h1–h3), em % da altura. A primeira vira
 * "(Topo)"; títulos muito próximos contam como uma seção só.
 */
export function detectSections(doc: Document, maxSections = 12): Section[] {
  const { h } = docSize(doc);
  const out: Section[] = [];
  const heads = Array.from(doc.querySelectorAll("h1,h2,h3"))
    .map((el) => ({ el, box: boxOf(el), text: (el.textContent ?? "").replace(/\s+/g, " ").trim() }))
    .filter((x) => x.box && x.text.length >= 2 && x.text.length <= 90)
    .sort((a, b) => a.box!.y - b.box!.y);
  for (const x of heads) {
    const top = Math.max(0, Math.min(100, (x.box!.y / h) * 100));
    const prev = out[out.length - 1];
    if (prev && top - prev.top < 4) continue;
    out.push({ label: x.text.length > 42 ? `${x.text.slice(0, 40).trimEnd()}…` : x.text, top });
    if (out.length >= maxSections) break;
  }
  if (!out.length || out[0].top > 8) out.unshift({ label: "Topo da página", top: 0 });
  else out[0] = { ...out[0], label: `${out[0].label} (Topo)`, top: 0 };
  return out;
}

/** Tipo legível de um elemento a partir do seletor ("Botão", "Link", "Campo"…). */
export function kindOfSelector(sel: string): string {
  const last = sel.split(">").pop() ?? "";
  const tag = last.replace(/[:#.[].*$/, "").toLowerCase();
  const map: Record<string, string> = {
    a: "Link",
    button: "Botão",
    input: "Campo",
    textarea: "Campo",
    select: "Seletor",
    img: "Imagem",
    svg: "Ícone",
    h1: "Título",
    h2: "Título",
    h3: "Título",
    label: "Rótulo",
    summary: "Expansor",
    li: "Item",
    nav: "Menu",
    p: "Texto",
    span: "Texto",
  };
  return map[tag] ?? "Elemento";
}
