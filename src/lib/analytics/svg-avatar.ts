/*
  Avatar desenhado DIRETO na página (SVG embutido, sem endereço de imagem) — caso do Exploradores e
  da Geniex. O SDK copia o desenho; o servidor guarda uma cópia por desenho (muitos alunos usam o
  mesmo personagem) e a serve como imagem. PURO e testado; usado no SDK e no servidor.
*/

/** Tamanho máximo do desenho enviado (o envio do SDK tem teto de ~60 KB). */
export const SVG_MAX = 40_000;

/**
 * Impressão digital do desenho: 2 × FNV-1a de 32 bits = 16 hex. O servidor recalcula sobre o
 * conteúdo recebido e só aceita se bater — ninguém grava um desenho sob a impressão de outro.
 */
export function svgHash(svg: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ svg.length;
  for (let i = 0; i < svg.length; i++) {
    const c = svg.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c ^ (i & 0xff), 0x01000193) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

/**
 * Limpa o desenho: só elementos e atributos de desenho. Sai tudo que executa ou busca algo fora
 * (script, foreignObject, iframe, eventos on*, links que não sejam âncoras internas ou imagens
 * data:). Mesmo servido com CSP "sandbox", a cópia guardada já fica inofensiva.
 */
export function sanitizeSvg(raw: string): string | null {
  let s = raw.trim();
  if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s) || s.length > SVG_MAX) return null;
  s = s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video|canvas|style)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video|canvas|style)\b[^>]*\/?>/gi, "")
    // eventos (onload=, onclick=…)
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // links: só âncora interna (#id) ou imagem embutida
    .replace(/\s+(xlink:)?href\s*=\s*("([^"]*)"|'([^']*)')/gi, (m, _x, _q, d1, d2) => {
      const v = String(d1 ?? d2 ?? "").trim();
      return v.startsWith("#") || /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v) ? m : "";
    })
    .replace(/javascript:/gi, "")
    .replace(/url\(\s*["']?(?!#)[^)]*\)/gi, "none");
  return /<svg[\s>]/i.test(s) ? s : null;
}
