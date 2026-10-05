/*
  "Fotografia" do avatar apontado pelo seletor do cliente, para avatares que NÃO são uma imagem
  com endereço: personagens montados em camadas (corpo em SVG + rosto em imagem), desenhos que
  referenciam partes definidas em outro lugar da página (<use href="#rosto">, fill="url(#pele)"),
  pintados em <canvas>, ou em fundos CSS (inclusive ::before/::after e Shadow DOM).

  Resultado: um SVG único do tamanho do avatar, com cada camada na posição em que aparece na tela
  e TODA imagem externa embutida (reduzida) — SVG exibido como <img> não carrega nada de fora.
  Assíncrono (baixar imagens leva tempo): roda em segundo plano enquanto a pessoa usa a tela, nunca
  no envio. Imagem de outro domínio sem permissão (CORS) é pulada; o resto do avatar vai.
*/
import { styledSvgClone } from "./page-identity";
import { SVG_MAX } from "../../lib/analytics/svg-avatar";

const NS = "http://www.w3.org/2000/svg";
const XLINK = "http://www.w3.org/1999/xlink";

export interface Snapshot {
  /** avatar é uma única imagem com endereço https: basta o endereço */
  url?: string;
  /** avatar em camadas/desenho: o SVG composto */
  svg?: string;
  reason: string;
  /** camadas encontradas (diagnóstico) */
  layers: string[];
}

const urlIn = (css: string) => /url\(["']?([^"')]+)["']?\)/.exec(css || "")?.[1] ?? "";

/** Imagem → data URI reduzido (WebP; PNG se o navegador não fizer WebP). null se o domínio não permite. */
async function toDataUri(src: string, maxSide: number): Promise<string | null> {
  if (!src) return null;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src) && src.length < 30_000) return src;
  const abs = (() => {
    try {
      return new URL(src, location.href).href;
    } catch {
      return "";
    }
  })();
  if (!abs || !/^https?:|^data:|^blob:/.test(abs)) return null;

  const draw = (img: CanvasImageSource, w: number, h: number): string | null => {
    if (!w || !h) return null;
    const k = Math.min(1, maxSide / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    try {
      const webp = c.toDataURL("image/webp", 0.82);
      return webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/png");
    } catch {
      return null; // canvas "contaminado" por imagem de outro domínio sem CORS
    }
  };

  // 1) <img crossOrigin=anonymous> (usa o cache do navegador quando o domínio permite)
  const viaImg = await new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    const t = window.setTimeout(() => resolve(null), 6000);
    img.onload = () => {
      window.clearTimeout(t);
      resolve(draw(img, img.naturalWidth || img.width, img.naturalHeight || img.height));
    };
    img.onerror = () => {
      window.clearTimeout(t);
      resolve(null);
    };
    img.src = abs;
  });
  if (viaImg) return viaImg;
  // 2) fetch com CORS → bitmap
  try {
    const r = await fetch(abs, { mode: "cors", credentials: "omit" });
    if (!r.ok) return null;
    const bmp = await createImageBitmap(await r.blob());
    return draw(bmp, bmp.width, bmp.height);
  } catch {
    return null;
  }
}

/** Ids referenciados por um elemento: href="#id", xlink:href="#id", url(#id) em atributos/estilo. */
function refsOf(el: Element): string[] {
  const out: string[] = [];
  for (const a of Array.from(el.attributes)) {
    const v = a.value;
    if ((a.name === "href" || a.name === "xlink:href") && v.startsWith("#")) out.push(v.slice(1));
    for (const m of v.matchAll(/url\(\s*["']?#([^"')\s]+)["']?\s*\)/g)) out.push(m[1]);
  }
  return out;
}

/*
  Partes referenciadas que NÃO estão dentro do desenho copiado (sprites, <defs> de outro <svg> da
  página): copiadas para um <defs> do próprio desenho, recursivamente. Sem isso o rosto/pele que
  vinha de um <symbol>/<pattern> externo some.
*/
function pullExternalDefs(original: Element, clone: Element) {
  const doc = original.ownerDocument;
  const have = new Set(Array.from(clone.querySelectorAll("[id]")).map((n) => n.id));
  const defs = doc.createElementNS(NS, "defs");
  const queue = [clone, ...Array.from(clone.querySelectorAll("*"))];
  let guard = 0;
  while (queue.length && guard++ < 400) {
    const el = queue.shift()!;
    for (const id of refsOf(el)) {
      if (have.has(id)) continue;
      const src = doc.getElementById(id);
      if (!src || src.namespaceURI !== NS) continue;
      const copy = styledSvgClone(src as unknown as SVGElement);
      defs.appendChild(copy);
      have.add(id);
      queue.push(copy, ...Array.from(copy.querySelectorAll("*")));
    }
  }
  if (defs.childNodes.length) clone.insertBefore(defs, clone.firstChild);
}

/** Toda imagem do desenho vira data URI (as que o domínio não permitir são removidas). */
async function inlineSvgImages(clone: Element, maxSide: number) {
  const imgs = Array.from(clone.querySelectorAll("image"));
  await Promise.all(
    imgs.map(async (im) => {
      const href = im.getAttribute("href") || im.getAttributeNS(XLINK, "href") || "";
      const data = href ? await toDataUri(href, maxSide) : null;
      im.removeAttributeNS(XLINK, "href");
      if (data) im.setAttribute("href", data);
      else im.remove();
    })
  );
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** Fotografa o avatar (ver comentário do módulo). */
export async function snapshotAvatar(root: Element, scale = 2): Promise<Snapshot> {
  const doc = root.ownerDocument;
  const R = root.getBoundingClientRect();
  const W = R.width || 64;
  const H = R.height || 64;
  const maxSide = Math.max(48, Math.min(160, Math.round(Math.max(W, H) * scale)));
  const layers: string[] = [];
  const parts: Promise<string | null>[] = [];
  const pos = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - R.left, y: r.top - R.top, w: r.width || W, h: r.height || H };
  };
  const imageTag = (data: string, p: { x: number; y: number; w: number; h: number }, fit = "xMidYMid slice") =>
    `<image x="${fmt(p.x)}" y="${fmt(p.y)}" width="${fmt(p.w)}" height="${fmt(p.h)}" preserveAspectRatio="${fit}" href="${data}"/>`;

  // camadas em ordem de pintura (DOM), entrando em Shadow DOM aberto
  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    const cs = window.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return;
    // fundo do próprio elemento e dos pseudo-elementos
    for (const pseudo of [null, "::before", "::after"] as const) {
      const bg = urlIn(window.getComputedStyle(el, pseudo).backgroundImage);
      if (bg) {
        layers.push(`fundo${pseudo ?? ""} <${tag}>`);
        const p = pos(el);
        parts.push(toDataUri(bg, maxSide).then((d) => (d ? imageTag(d, p) : null)));
      }
    }
    if (tag === "svg") {
      layers.push("svg");
      const p = pos(el);
      const clone = styledSvgClone(el as SVGSVGElement);
      pullExternalDefs(el, clone);
      const vb = el.getAttribute("viewBox");
      clone.setAttribute("x", fmt(p.x));
      clone.setAttribute("y", fmt(p.y));
      clone.setAttribute("width", fmt(p.w));
      clone.setAttribute("height", fmt(p.h));
      if (!vb) clone.setAttribute("viewBox", `0 0 ${fmt(p.w)} ${fmt(p.h)}`);
      parts.push(inlineSvgImages(clone, maxSide).then(() => clone.outerHTML));
      return; // o que está dentro do SVG já foi
    }
    if (tag === "img") {
      const img = el as HTMLImageElement;
      const src = img.currentSrc || img.src;
      layers.push("img");
      const p = pos(el);
      const fit = cs.objectFit === "contain" ? "xMidYMid meet" : "xMidYMid slice";
      parts.push(toDataUri(src, maxSide).then((d) => (d ? imageTag(d, p, fit) : null)));
    } else if (tag === "canvas") {
      layers.push("canvas");
      const p = pos(el);
      let d: string | null = null;
      try {
        d = (el as HTMLCanvasElement).toDataURL("image/webp", 0.82);
      } catch {
        d = null; // canvas contaminado por imagem de outro domínio
      }
      parts.push(Promise.resolve(d && d.length > 30 ? d : null).then((x) => (x ? toDataUri(x, maxSide) : null)).then((x) => (x ? imageTag(x, p) : null)));
    }
    for (const child of Array.from(el.children)) walk(child);
    if ((el as HTMLElement).shadowRoot) for (const child of Array.from((el as HTMLElement).shadowRoot!.children)) walk(child);
  };
  walk(root);

  if (!layers.length) return { reason: "o elemento não tem imagem (só iniciais/texto?)", layers };

  // uma única foto com endereço que cobre o avatar: basta o endereço (mais leve)
  if (layers.length === 1 && layers[0] === "img") {
    const img = (root.tagName.toLowerCase() === "img" ? root : root.querySelector("img")) as HTMLImageElement | null;
    const src = img ? img.currentSrc || img.src : "";
    try {
      const u = new URL(src, location.href);
      if (/\/_next\/image\/?$/.test(u.pathname) && u.searchParams.get("url")) {
        const real = new URL(u.searchParams.get("url")!, u.href);
        if (real.protocol === "https:") return { url: real.href, reason: "ok", layers };
      }
      if (u.protocol === "https:" && u.href.length <= 500) return { url: u.href, reason: "ok", layers };
    } catch {}
  }

  const done = (await Promise.all(parts)).filter((x): x is string => !!x);
  if (!done.length) return { reason: "as imagens do avatar são de outro domínio sem permissão de leitura (CORS)", layers };
  const svg = `<svg xmlns="${NS}" width="${fmt(W)}" height="${fmt(H)}" viewBox="0 0 ${fmt(W)} ${fmt(H)}">${done.join("")}</svg>`.replace(/\s+/g, " ");
  if (svg.length <= SVG_MAX) return { svg, reason: "ok", layers };
  // grande demais: tenta de novo com imagens menores
  if (scale > 1) return snapshotAvatar(root, 1);
  void doc;
  return { reason: "avatar grande demais para copiar", layers };
}
