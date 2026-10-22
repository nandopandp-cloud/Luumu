/*
  Nome e foto do usuário logado, lidos da PRÓPRIA página do produto — para quando o
  Luumu.identify do cliente manda só id/e-mail. Ligado pela workspace (Configurações → SDK &
  Eventos); o core só repassa a configuração quando ela está ativa.

  Regras de segurança/privacidade:
  - só é chamado com o usuário identificado (id ou e-mail): nada de visitante anônimo;
  - lê só texto de exibição e o endereço de uma imagem — nunca campos de formulário,
    cookies, armazenamento ou tokens do produto;
  - foto só com endereço https (o painel a carrega direto da origem).

  Sem seletores, a detecção é automática e conservadora: procura a foto de perfil (elementos de
  "avatar"/"perfil", de preferência no topo/menu) e o nome no texto alternativo dela ou no menu
  do usuário em volta — só aceitando o que tem cara de nome de pessoa.
*/

import { isJunkAvatar, isJunkName, stripNameNoise } from "../../lib/analytics/identity-filter";
import { SVG_MAX } from "../../lib/analytics/svg-avatar";

export interface CaptureConfig {
  /** seletor CSS do nome (vazio = automático) */
  n: string;
  /** seletor CSS da foto (vazio = automático) */
  a: string;
}

// contêiner do avatar, COM ou SEM foto: usuário sem foto só tem as iniciais (o <img> do Radix
// nem é montado), e é nele que o nome ao lado é procurado
const AVATAR_BOX = ['[data-slot="avatar"]', '[class*="avatar" i]:not(img)'].join(",");

const AVATAR_AUTO = [
  '[data-slot="avatar-image"]',
  '[data-slot="avatar"] img',
  'img[class*="avatar" i]',
  '[class*="avatar" i] img',
  'img[alt*="avatar" i]',
  'img[alt*="perfil" i]',
  'img[alt*="profile" i]',
  'img[alt*="foto" i]',
  'img[src*="avatar" i]',
].join(",");

// rótulos de interface que aparecem perto da foto e NÃO são nomes
const NOT_NAMES = /^(avatar|foto|imagem|image|perfil|profile|meu perfil|minha conta|conta|account|menu|usu[aá]rio|user|sair|logout|entrar|configura[çc][õo]es|settings|ol[aá]|bem-vindo|bem-vinda)$/i;

/**
 * Tem cara de nome de pessoa? Letras (com acento), 1 a 6 palavras, sem número nem @, sem
 * palavra de interface/ilustração ("Genie Bot", "Knowledge Area"). Tira o ruído em volta
 * ("Ana Souza avatar" → "Ana Souza").
 */
export function looksLikeName(raw: string | null | undefined): string | null {
  const t = stripNameNoise(raw ?? "");
  if (t.length < 2 || t.length > 60) return null;
  if (!/^[\p{L}][\p{L}'’.\- ]*[\p{L}.]$/u.test(t)) return null;
  const words = t.split(" ");
  if (words.length > 6 || NOT_NAMES.test(t) || words.every((w) => NOT_NAMES.test(w)) || isJunkName(t)) return null;
  return t;
}

/** Na detecção AUTOMÁTICA, só nome completo (2+ palavras): "Astra", "Yugen" são personagens. */
const fullName = (raw: string | null | undefined) => {
  const n = looksLikeName(raw);
  return n && n.split(" ").length >= 2 ? n : null;
};

/*
  Foto de um elemento, onde quer que ela esteja: <img> (src, srcset, currentSrc, data-src),
  <picture><source>, <svg><image href>, ou fundo em CSS — inclusive o vindo de CLASSE
  (Tailwind bg-[url(...)]), que só aparece no estilo computado. Fotos servidas pelo otimizador
  do Next (/_next/image?url=…) viram o endereço original.
*/
type Found = { url: string | null; reason: string; svg?: string };

/*
  Cópia do avatar desenhado em SVG embutido: o desenho com as cores/estilos JÁ APLICADOS (muitos
  vêm de classes CSS da página, que não existiriam fora dela), tamanho explícito e sem nada que
  execute. O servidor limpa de novo e guarda uma cópia por desenho.
*/
const SVG_PROPS = ["fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "opacity", "stop-color", "stop-opacity", "color", "display", "visibility", "transform", "font-family", "font-size", "font-weight", "text-anchor", "dominant-baseline"];

// valores padrão do SVG: não precisam ir na cópia (só aumentariam o envio)
const SVG_DEFAULTS: Record<string, string> = {
  "fill-opacity": "1", "fill-rule": "nonzero", "stroke-opacity": "1", "stroke-linecap": "butt", "stroke-linejoin": "miter",
  "stroke-width": "1px", opacity: "1", "stop-opacity": "1", display: "inline", visibility: "visible", transform: "none", stroke: "none",
};

/** Clone do SVG com os estilos computados no próprio desenho (sem classes) e sem nada que execute. */
export function styledSvgClone(svg: SVGElement): SVGElement {
  const clone = svg.cloneNode(true) as SVGElement;
  inlineStyles(svg, clone);
  clone.querySelectorAll("script, foreignObject").forEach((n) => n.remove());
  return clone;
}

/** Copia os estilos computados de `from` (e descendentes) para `to` (mesma estrutura). */
export function inlineStyles(from: Element, to: Element) {
  const src = [from, ...Array.from(from.querySelectorAll("*"))];
  const dst = [to, ...Array.from(to.querySelectorAll("*"))];
  src.forEach((el, i) => {
    if (!dst[i]) return;
    const cs = window.getComputedStyle(el);
    const text = /^(text|tspan|textPath)$/i.test(el.tagName);
    const style = SVG_PROPS.map((p) => {
      if (!text && /^(font-|text-anchor|dominant-baseline)/.test(p)) return "";
      const v = cs.getPropertyValue(p).trim();
      return v && v !== "normal" && SVG_DEFAULTS[p] !== v ? `${p}:${v}` : "";
    })
      .filter(Boolean)
      .join(";");
    if (style) dst[i].setAttribute("style", style);
    dst[i].removeAttribute("class");
  });
}

function copySvg(svg: SVGSVGElement): string | null {
  try {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const src = [svg, ...Array.from(svg.querySelectorAll("*"))];
    const dst = [clone, ...Array.from(clone.querySelectorAll("*"))];
    src.forEach((el, i) => {
      const cs = window.getComputedStyle(el);
      const text = /^(text|tspan|textPath)$/i.test(el.tagName);
      const style = SVG_PROPS.map((p) => {
        if (!text && /^(font-|text-anchor|dominant-baseline)/.test(p)) return "";
        const v = cs.getPropertyValue(p).trim();
        return v && v !== "normal" && SVG_DEFAULTS[p] !== v ? `${p}:${v}` : "";
      })
        .filter(Boolean)
        .join(";");
      if (style) dst[i].setAttribute("style", style);
      dst[i].removeAttribute("class");
    });
    clone.querySelectorAll("script, foreignObject").forEach((n) => n.remove());
    const r = svg.getBoundingClientRect();
    if (!clone.getAttribute("viewBox") && r.width && r.height) clone.setAttribute("viewBox", `0 0 ${Math.round(r.width)} ${Math.round(r.height)}`);
    clone.setAttribute("width", String(Math.round(r.width) || 64));
    clone.setAttribute("height", String(Math.round(r.height) || 64));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const out = clone.outerHTML.replace(/\s+/g, " ").trim();
    return out.length <= SVG_MAX ? out : null;
  } catch {
    return null;
  }
}

const firstUrlOf = (srcset: string | null) => (srcset ?? "").split(",")[0]?.trim().split(/\s+/)[0] ?? "";

function rawImageSrc(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === "img") {
    const img = el as HTMLImageElement;
    return img.currentSrc || img.getAttribute("src") || img.getAttribute("data-src") || firstUrlOf(img.getAttribute("srcset"));
  }
  if (tag === "source") return firstUrlOf(el.getAttribute("srcset"));
  if (tag === "image") return el.getAttribute("href") || el.getAttribute("xlink:href") || "";
  return "";
}

function backgroundOf(el: Element): string {
  let bg = (el as HTMLElement).style?.backgroundImage || "";
  if (!bg || bg === "none") {
    try {
      bg = getComputedStyle(el).backgroundImage || "";
    } catch {}
  }
  return /url\(["']?([^"')]+)["']?\)/.exec(bg)?.[1] ?? "";
}

function toHttps(src: string): Found {
  if (!src) return { url: null, reason: "sem imagem no elemento" };
  if (src.startsWith("data:") || src.startsWith("blob:")) return { url: null, reason: "imagem embutida (data:/blob:), sem endereço público" };
  try {
    let u = new URL(src, location.href);
    // otimizador do Next: o endereço real vem em ?url=
    if (/\/_next\/image\/?$/.test(u.pathname) && u.searchParams.get("url")) u = new URL(u.searchParams.get("url")!, u.href);
    if (u.protocol !== "https:") return { url: null, reason: "endereço sem https" };
    if (u.href.length > 500) return { url: null, reason: "endereço longo demais" };
    return { url: u.href, reason: "ok" };
  } catch {
    return { url: null, reason: "endereço inválido" };
  }
}

function findImage(el: Element | null): Found {
  if (!el) return { url: null, reason: "seletor não encontrou nenhum elemento na tela" };
  // o próprio elemento e os de dentro (a foto costuma estar um ou dois níveis abaixo)
  const nodes = [el, ...Array.from(el.querySelectorAll("img, picture source, svg image, [style*='background'], div, span")).slice(0, 40)];
  for (const n of nodes) {
    const src = rawImageSrc(n) || backgroundOf(n);
    if (src) return toHttps(src);
  }
  const svg = (el.tagName.toLowerCase() === "svg" ? el : el.querySelector("svg")) as SVGSVGElement | null;
  if (svg) {
    const copy = copySvg(svg);
    return copy ? { url: null, reason: "ok (desenho SVG copiado)", svg: copy } : { url: null, reason: "a foto é um desenho SVG grande demais para copiar" };
  }
  return { url: null, reason: "o elemento não tem imagem (só iniciais/texto?)" };
}

/** Endereço https absoluto da imagem do elemento (ver findImage). */
function imageUrl(el: Element | null): string | null {
  return findImage(el).url;
}

function visible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  // happy-dom/ambientes sem layout devolvem 0: não descarta por isso
  if (r.width === 0 && r.height === 0) return true;
  return r.width >= 12 && r.width <= 200 && r.height <= 200;
}

const CHROME = 'header, nav, aside, [role="banner"], [role="navigation"], [role="menu"], [data-sidebar], [data-slot^="sidebar"]';
const firstVisible = (doc: Document, sel: string) => {
  const all = Array.from(doc.querySelectorAll(sel)).filter(visible);
  // prefere o que está no topo/menu/barra lateral (o usuário logado), não um card do conteúdo
  return all.find((el) => el.closest(CHROME)) ?? all[0] ?? null;
};

/** Foto de perfil automática: a primeira visível que É foto de gente (não ilustração/ícone), preferindo topo/menu. */
function autoAvatar(doc: Document): Element | null {
  const all = Array.from(doc.querySelectorAll(AVATAR_AUTO)).filter((el) => {
    if (!visible(el)) return false;
    const u = imageUrl(el);
    return !!u && !isJunkAvatar(u);
  });
  return all.find((el) => el.closest(CHROME)) ?? all[0] ?? null;
}

/** Primeira linha com cara de nome dentro do menu/botão do usuário em volta da foto. */
function nameNear(avatar: Element): string | null {
  const alt = avatar.tagName === "IMG" ? fullName(avatar.getAttribute("alt")) : fullName(avatar.querySelector("img")?.getAttribute("alt"));
  if (alt) return alt;
  // o menu/botão do usuário em volta; sem ele, só o contêiner IMEDIATO (subir até o <body>
  // pegaria qualquer nome da página, como o de um professor num card)
  const parent = avatar.parentElement;
  const box =
    avatar.closest('button, a, [role="button"], [aria-haspopup], [data-slot*="trigger"], [data-sidebar="menu-button"], [class*="user" i], [class*="profile" i]') ??
    (parent && !parent.matches("body, html, main, header, nav, aside") && parent.childElementCount <= 6 ? parent : null);
  if (!box) return null;
  // cada pedaço de texto separado: innerText junta <span>s vizinhos ("ASAna SouzaAluno")
  const walker = box.ownerDocument.createTreeWalker(box, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const n = fullName(node.textContent);
    // as iniciais do "fallback" do avatar ("FR") não são nome
    if (n && !/^[\p{Lu}]{1,3}$/u.test(n)) return n;
  }
  return null;
}

/*
  Nome ao lado do E-MAIL do usuário: o SDK já sabe o e-mail (Luumu.identify) e menus/perfis
  costumam mostrar "Nome / e-mail" juntos. É o sinal mais confiável quando o nome não está
  colado no avatar (ex.: avatar só no topo e nome no menu da barra lateral).
*/
function nameNearEmail(doc: Document, email: string): string | null {
  const target = email.trim().toLowerCase();
  if (!target.includes("@") || !doc.body) return null;
  const walker = doc.createTreeWalker(doc.body, 4 /* SHOW_TEXT */);
  let seen = 0;
  for (let node = walker.nextNode(); node && seen < 20_000; node = walker.nextNode(), seen++) {
    if ((node.textContent ?? "").trim().toLowerCase() !== target) continue;
    // sobe até 3 níveis procurando o nome no mesmo bloco
    let box: Element | null = node.parentElement;
    for (let i = 0; i < 3 && box; i++, box = box.parentElement) {
      const inner = doc.createTreeWalker(box, 4);
      for (let t = inner.nextNode(); t; t = inner.nextNode()) {
        const n = fullName(t.textContent);
        if (n && !/^[\p{Lu}]{1,3}$/u.test(n)) return n;
      }
    }
  }
  return null;
}

/*
  "Copiar seletor" do navegador gera caminhos completos a partir do <body>
  (body > div > div > … > header > div > button) que só casam na tela EXATA de onde foram
  copiados: em outra tela, com um contêiner a mais ou a menos, não acham nada. Se o seletor
  inteiro não casa, tenta versões cada vez mais curtas — tirando segmentos do COMEÇO e mantendo
  sempre o final (o elemento em si e seus pais imediatos), com no mínimo 3 segmentos.
*/
export function queryTolerant(doc: Document, selector: string): Element | null {
  const exact = doc.querySelector(selector);
  if (exact) return exact;
  const parts = selector.split(/\s*>\s*/).filter(Boolean);
  for (let i = 1; parts.length - i >= 3; i++) {
    try {
      const el = doc.querySelector(parts.slice(i).join(" > "));
      if (el) return el;
    } catch {
      return null;
    }
  }
  return null;
}

/** Todos os candidatos do seletor: os que casam com ele inteiro e, depois, com versões mais curtas. */
export function queryTolerantAll(doc: Document, selector: string): Element[] {
  const out: Element[] = [];
  const add = (sel: string) => {
    try {
      for (const el of Array.from(doc.querySelectorAll(sel))) if (!out.includes(el)) out.push(el);
    } catch {}
  };
  add(selector);
  const parts = selector.split(/\s*>\s*/).filter(Boolean);
  for (let i = 1; parts.length - i >= 3 && out.length < 20; i++) add(parts.slice(i).join(" > "));
  return out;
}

export interface PageIdentity {
  name: string | null;
  avatar: string | null;
  /** a foto veio de um seletor configurado pelo cliente (confiável: vale até ilustração/SVG) */
  avatarFromSelector: boolean;
  /** por que a foto não veio (diagnóstico do Luumu.debugIdentity) */
  avatarReason: string;
  /** começo do HTML do elemento da foto (diagnóstico: mostra como a foto é montada) */
  avatarHtml?: string;
  /** avatar desenhado em SVG embutido (sem endereço): a cópia do desenho */
  avatarSvg?: string;
}

export function readPageIdentity(cfg: CaptureConfig, doc: Document = document, email?: string | null): PageIdentity {
  let name: string | null = null;
  let avatar: string | null = null;
  let avatarReason = "";
  let avatarEl: Element | null = null;
  let avatarSvg: string | undefined;
  try {
    const marked = doc.querySelector("[data-luumu-name]");
    const nameEl = cfg.n ? queryTolerant(doc, cfg.n) : null;
    if (cfg.n) name = looksLikeName(nameEl?.textContent) ?? textOf(nameEl);
    else if (marked) name = looksLikeName(marked.getAttribute("data-luumu-name") || marked.textContent);

    // avatar: seletor INTEIRO (a versão tolerante casava com ícones de outras telas)
    const av = cfg.a ? doc.querySelector(cfg.a) : autoAvatar(doc);
    avatarEl = av;
    const found = cfg.a ? findImage(av) : av ? findImage(av) : { url: null, reason: "nenhuma foto de perfil reconhecida (modo automático)" };
    avatar = found.url;
    avatarReason = found.reason;
    // desenho embutido: só pelo seletor (no automático, ícones/ilustrações não são perfil)
    if (!avatar && found.svg && cfg.a) avatarSvg = found.svg;
    // automático: ilustração/ícone não é foto de gente. Com seletor, o cliente apontou: vale
    // (no Exploradores o avatar escolhido pelo aluno é um personagem em SVG)
    if (avatar && !cfg.a && isJunkAvatar(avatar)) {
      avatar = null;
      avatarReason = "ilustração/ícone ignorado no modo automático";
    }
    // nome ao lado do avatar — com foto, ou só com as iniciais (usuário sem foto)
    const anchor = av ?? (cfg.a ? null : firstVisible(doc, AVATAR_BOX));
    if (!name && !cfg.n && anchor) name = nameNear(anchor);
    if (!name && !cfg.n && email) name = nameNearEmail(doc, email);
  } catch {
    // seletor inválido ou DOM estranho: fica sem, nunca quebra o produto do cliente
    avatarReason ||= "seletor inválido";
  }
  return {
    name,
    avatar,
    avatarFromSelector: !!cfg.a && !!avatar,
    avatarReason: avatar || avatarSvg ? "ok" : avatarReason,
    avatarSvg,
    avatarHtml: avatarEl ? avatarEl.outerHTML.replace(/\s+/g, " ").slice(0, 600) : undefined,
  };
}

/** Seletor escolhido pelo cliente: aceita o texto como está (curto, sem @), mesmo fora do padrão de nome. */
function textOf(el: Element | null): string | null {
  const t = (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  return t.length >= 2 && t.length <= 80 && !t.includes("@") ? t : null;
}
