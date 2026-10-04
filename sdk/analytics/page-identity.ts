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

export interface CaptureConfig {
  /** seletor CSS do nome (vazio = automático) */
  n: string;
  /** seletor CSS da foto (vazio = automático) */
  a: string;
}

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

/** Tem cara de nome de pessoa? Letras (com acento), 1 a 6 palavras, sem número nem @. */
export function looksLikeName(raw: string | null | undefined): string | null {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (t.length < 2 || t.length > 60) return null;
  if (!/^[\p{L}][\p{L}'’.\- ]*[\p{L}.]$/u.test(t)) return null;
  const words = t.split(" ");
  if (words.length > 6 || NOT_NAMES.test(t) || words.every((w) => NOT_NAMES.test(w))) return null;
  return t;
}

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

/** Foto de perfil automática: a primeira visível, preferindo topo/menu/barra lateral. */
function autoAvatar(doc: Document): Element | null {
  const all = Array.from(doc.querySelectorAll(AVATAR_AUTO)).filter(visible);
  const inChrome = all.find((el) => el.closest('header, nav, aside, [role="banner"], [role="navigation"], [role="menu"]'));
  return inChrome ?? all[0] ?? null;
}

/** Primeira linha com cara de nome dentro do menu/botão do usuário em volta da foto. */
function nameNear(avatar: Element): string | null {
  const alt = avatar.tagName === "IMG" ? looksLikeName(avatar.getAttribute("alt")) : looksLikeName(avatar.querySelector("img")?.getAttribute("alt"));
  if (alt) return alt;
  const box = avatar.closest('button, a, [role="button"], [aria-haspopup], [data-slot*="trigger"], [class*="user" i], [class*="profile" i]') ?? avatar.parentElement?.parentElement ?? null;
  if (!box) return null;
  // cada pedaço de texto separado: innerText junta <span>s vizinhos ("ASAna SouzaAluno")
  const walker = box.ownerDocument.createTreeWalker(box, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const n = looksLikeName(node.textContent);
    // as iniciais do "fallback" do avatar ("FR") não são nome
    if (n && !/^[\p{Lu}]{1,3}$/u.test(n)) return n;
  }
  return null;
}

export function readPageIdentity(cfg: CaptureConfig, doc: Document = document): { name: string | null; avatar: string | null } {
  let name: string | null = null;
  let avatar: string | null = null;
  try {
    const marked = doc.querySelector("[data-luumu-name]");
    if (cfg.n) name = looksLikeName(doc.querySelector(cfg.n)?.textContent) ?? textOf(doc.querySelector(cfg.n));
    else if (marked) name = looksLikeName(marked.getAttribute("data-luumu-name") || marked.textContent);

    const av = cfg.a ? doc.querySelector(cfg.a) : autoAvatar(doc);
    avatar = imageUrl(av);
    if (!name && !cfg.n && av) name = nameNear(av);
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
