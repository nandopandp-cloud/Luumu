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

/** Endereço https absoluto da imagem (img, imagem dentro do elemento ou fundo em CSS). */
function imageUrl(el: Element | null): string | null {
  if (!el) return null;
  const img = el.tagName === "IMG" ? (el as HTMLImageElement) : el.querySelector("img");
  let src = img ? img.currentSrc || img.getAttribute("src") || "" : "";
  if (!src) {
    const bg = (el as HTMLElement).style?.backgroundImage || "";
    src = /url\(["']?([^"')]+)["']?\)/.exec(bg)?.[1] ?? "";
  }
  if (!src || src.startsWith("data:")) return null;
  try {
    const u = new URL(src, location.href);
    return u.protocol === "https:" && u.href.length <= 500 ? u.href : null;
  } catch {
    return null;
  }
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

export function readPageIdentity(cfg: CaptureConfig, doc: Document = document, email?: string | null): { name: string | null; avatar: string | null } {
  let name: string | null = null;
  let avatar: string | null = null;
  try {
    const marked = doc.querySelector("[data-luumu-name]");
    if (cfg.n) name = looksLikeName(doc.querySelector(cfg.n)?.textContent) ?? textOf(doc.querySelector(cfg.n));
    else if (marked) name = looksLikeName(marked.getAttribute("data-luumu-name") || marked.textContent);

    const av = cfg.a ? doc.querySelector(cfg.a) : autoAvatar(doc);
    avatar = imageUrl(av);
    // mesmo com seletor: ilustração/ícone não é foto de gente
    if (avatar && isJunkAvatar(avatar)) avatar = null;
    // nome ao lado do avatar — com foto, ou só com as iniciais (usuário sem foto)
    const anchor = av ?? (cfg.a ? null : firstVisible(doc, AVATAR_BOX));
    if (!name && !cfg.n && anchor) name = nameNear(anchor);
    if (!name && !cfg.n && email) name = nameNearEmail(doc, email);
  } catch {
    // seletor inválido ou DOM estranho: fica sem, nunca quebra o produto do cliente
  }
  return { name, avatar };
}

/** Seletor escolhido pelo cliente: aceita o texto como está (curto, sem @), mesmo fora do padrão de nome. */
function textOf(el: Element | null): string | null {
  const t = (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  return t.length >= 2 && t.length <= 80 && !t.includes("@") ? t : null;
}
