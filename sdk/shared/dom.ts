/*
  Leitura de elementos do produto do cliente — lado com DOM da identificação resiliente.
  Usado pelo builder (descrever o que o administrador escolheu, discovery) e pelo runtime
  (achar o alvo de novo). A pontuação em si é pura: lib/tours/target.ts.

  Privacidade: lê rótulos (texto visível curto, aria-label, placeholder, name), NUNCA o
  `value` de campos, e ignora inputs de senha por completo.
*/
import {
  bestStrategy,
  fingerprintOf,
  isStableClass,
  isStableId,
  kindOf,
  MIN_SCORE,
  normalizeText,
  scoreCandidate,
  stabilityOf,
  type CandidateInfo,
} from "../../lib/tours/target";
import type { ElementTarget } from "../../lib/tours/types";

/** Marca os nós da própria Luumu (overlay, widget, tour) para nunca serem alvo. */
export const LUUMU_HOST_ATTR = "data-luumu-ui";

export const INTERACTIVE_SELECTOR = [
  "[data-luumu-id]",
  "button",
  "a[href]",
  "input:not([type=hidden]):not([type=password])",
  "select",
  "textarea",
  "summary",
  "[role=button]",
  "[role=link]",
  "[role=tab]",
  "[role=menuitem]",
  "[role=option]",
  "[role=switch]",
  "[role=checkbox]",
  "[role=radio]",
  "[role=treeitem]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function isLuumuNode(el: Element): boolean {
  return !!el.closest(`[${LUUMU_HOST_ATTR}]`);
}

export function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const s = getComputedStyle(el);
  // opacity vazia (ambientes que não calculam estilo) conta como visível, não como 0
  const opacity = s.opacity === "" ? 1 : Number(s.opacity);
  return s.display !== "none" && s.visibility !== "hidden" && opacity > 0.05;
}

/** Texto curto que nomeia o elemento (nunca o valor digitado). */
function labelText(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") {
    const input = el as HTMLInputElement;
    const id = el.getAttribute("id");
    const forLabel = id ? document.querySelector(`label[for="${cssEscape(id)}"]`) : null;
    const wrap = el.closest("label");
    const txt = (forLabel?.textContent || wrap?.textContent || input.placeholder || "").trim();
    if (input.type === "submit" || input.type === "button") return (input.value || txt).slice(0, 60);
    return txt.replace(/\s+/g, " ").slice(0, 60);
  }
  const t = ((el as HTMLElement).innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  if (t) return t.slice(0, 60);
  return el.querySelector("img[alt]")?.getAttribute("alt")?.slice(0, 60) || el.getAttribute("title")?.slice(0, 60) || "";
}

export function cssEscape(v: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(v) : v.replace(/["\\]/g, "\\$&");
}

const LANDMARKS = "nav,header,footer,aside,main,[role=navigation],[role=banner],[role=complementary],[role=main],[role=dialog],[role=menu],[role=tablist],form";

/** Landmark ancestral ("nav", "aside", "form#login"...): ajuda a desambiguar textos repetidos. */
export function landmarkOf(el: Element): string {
  const lm = el.parentElement?.closest(LANDMARKS);
  if (!lm) return "";
  const role = lm.getAttribute("role");
  const id = lm.getAttribute("id");
  return `${role || lm.tagName.toLowerCase()}${id && isStableId(id) ? "#" + id : ""}`;
}

function stableClasses(el: Element): string[] {
  return Array.from(el.classList).filter(isStableClass).slice(0, 4);
}

/** Caminho semântico curto: landmark > ... > tag[.classe-estável], no máximo 4 níveis. */
function semanticPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  for (let i = 0; cur && i < 4 && cur !== document.body; i++) {
    const tag = cur.tagName.toLowerCase();
    const cls = stableClasses(cur)[0];
    parts.unshift(cls ? `${tag}.${cls}` : tag);
    if (cur.matches(LANDMARKS)) break;
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}

/** Seletor CSS de último recurso (com id estável quando houver, nth-of-type no resto). */
function fallbackSelector(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  for (let i = 0; cur && i < 5 && cur !== document.body; i++) {
    const id = cur.getAttribute("id");
    if (id && isStableId(id)) {
      parts.unshift(`#${cssEscape(id)}`);
      break;
    }
    const tag = cur.tagName.toLowerCase();
    const parent: Element | null = cur.parentElement;
    const same = parent ? Array.from(parent.children).filter((c) => c.tagName === cur!.tagName) : [];
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(cur) + 1})` : tag);
    cur = parent;
  }
  return parts.join(" > ");
}

export function candidateInfo(el: Element): CandidateInfo {
  const tag = el.tagName.toLowerCase();
  const href = tag === "a" ? safePathname((el as HTMLAnchorElement).href) : undefined;
  const id = el.getAttribute("id") || undefined;
  return {
    luumuId: el.getAttribute("data-luumu-id") || undefined,
    elementId: id && isStableId(id) ? id : undefined,
    testId: el.getAttribute("data-testid") || el.getAttribute("data-test") || el.getAttribute("data-cy") || undefined,
    ariaLabel: el.getAttribute("aria-label") || undefined,
    role: el.getAttribute("role") || undefined,
    tag,
    text: normalizeText(labelText(el)) || undefined,
    name: el.getAttribute("name") || undefined,
    href,
    classes: stableClasses(el),
    path: semanticPath(el),
  };
}

function safePathname(href: string): string | undefined {
  try {
    const u = new URL(href, location.href);
    return u.origin === location.origin ? u.pathname : u.host + u.pathname;
  } catch {
    return undefined;
  }
}

/** Descritor completo de um elemento (o que vai para o banco como alvo do passo). */
export function describeElement(el: Element): ElementTarget {
  const info = candidateInfo(el);
  const landmark = landmarkOf(el);
  const raw = labelText(el);
  const label = el.getAttribute("data-luumu-name") || el.getAttribute("aria-label") || raw || `<${info.tag}>`;
  const inNav = !!el.closest("nav,[role=navigation],aside");
  return {
    ...info,
    text: raw ? raw.slice(0, 60) : undefined,
    classes: info.classes?.length ? info.classes : undefined,
    selector: fallbackSelector(el),
    fingerprint: fingerprintOf(info, landmark),
    strategy: bestStrategy(info),
    stability: stabilityOf(info),
    label: label.slice(0, 80),
    kind: kindOf(info.tag, info.role, inNav, (el as HTMLInputElement).type),
    description: el.getAttribute("data-luumu-description") || undefined,
  };
}

/** Sobe a partir do clique até o elemento "acionável" mais próximo (como o auto-tracking). */
export function actionableFrom(start: Element): Element {
  let cur: Element | null = start;
  for (let i = 0; cur && i < 6 && cur !== document.body; i++) {
    if (cur.matches(INTERACTIVE_SELECTOR)) return cur;
    cur = cur.parentElement;
  }
  return start;
}

/**
 * Acha o alvo no DOM atual. `data-luumu-id` decide sozinho; senão, junta candidatos pelas
 * estratégias disponíveis e fica com o de maior pontuação (acima do mínimo), preferindo o
 * visível. Nunca lança: seletor inválido gravado no passado vira só "não achou".
 */
export function findTarget(t: ElementTarget): Element | null {
  try {
    if (t.luumuId) {
      const all = Array.from(document.querySelectorAll(`[data-luumu-id="${cssEscape(t.luumuId)}"]`));
      const hit = all.find(isVisible) || null;
      if (hit) return hit;
    }
    const pool = new Set<Element>();
    const add = (sel: string, limit = 400) => {
      try {
        const list = document.querySelectorAll(sel);
        for (let i = 0; i < list.length && i < limit; i++) pool.add(list[i]);
      } catch {}
    };
    if (t.elementId) add(`#${cssEscape(t.elementId)}`);
    if (t.testId) {
      const v = cssEscape(t.testId);
      add(`[data-testid="${v}"],[data-test="${v}"],[data-cy="${v}"]`);
    }
    if (t.ariaLabel) add(`[aria-label="${cssEscape(t.ariaLabel)}"]`);
    if (t.name) add(`[name="${cssEscape(t.name)}"]`);
    add(t.role ? `${t.tag},[role="${cssEscape(t.role)}"]` : t.tag, 1500);
    if (t.selector) add(t.selector, 20);

    let best: Element | null = null;
    let bestScore = MIN_SCORE - 1;
    pool.forEach((el) => {
      if (isLuumuNode(el)) return;
      let score = scoreCandidate(t, candidateInfo(el), landmarkOf(el));
      if (!isVisible(el)) score -= 25;
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    });
    return best;
  } catch {
    return null;
  }
}

/**
 * Espera o alvo aparecer (MutationObserver + polling para mudanças de visibilidade que não
 * mexem no DOM). Resolve null no timeout. Cancelável via `signal`.
 */
export function waitForElement(
  t: ElementTarget,
  timeoutMs: number,
  signal?: { cancelled: boolean }
): Promise<Element | null> {
  return new Promise((resolve) => {
    const tryNow = () => {
      const el = findTarget(t);
      return el && isVisible(el) ? el : null;
    };
    const first = tryNow();
    if (first) return resolve(first);
    let done = false;
    let scheduled = false;
    const finish = (el: Element | null) => {
      if (done) return;
      done = true;
      obs.disconnect();
      clearInterval(poll);
      clearTimeout(timer);
      resolve(el);
    };
    const check = () => {
      scheduled = false;
      if (signal?.cancelled) return finish(null);
      const el = tryNow();
      if (el) finish(el);
    };
    const obs = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(check);
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "aria-hidden"] });
    const poll = setInterval(check, 300);
    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}
