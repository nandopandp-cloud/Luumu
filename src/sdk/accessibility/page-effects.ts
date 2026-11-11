/*
  Efeitos do plugin de acessibilidade NA PÁGINA do cliente (fora do Shadow DOM do widget).

  Tudo que é regra fixa vira uma classe em <html> (`lu-a11y-*`) com o CSS numa <style> única
  marcada com data-luumu-ui: desligar remove a classe, e destroy() remove a <style> — a página
  volta exatamente como estava. O que depende de cálculo (tamanho do texto, filtros de cor,
  máscara e régua) é feito aqui em JS, guardando o valor original para restaurar.

  Nenhum efeito lê ou envia conteúdo da página para fora: o leitor de texto usa a voz do
  próprio navegador (speechSynthesis), e a escolha de texto para Libras fica no navegador.
*/
import { colorBlindMatrix, TEXT_SIZES, type A11yPrefs } from "../../lib/accessibility/features";

const UI_ATTR = "data-luumu-ui";
const CLASS = {
  font: "lu-a11y-font",
  spacing: "lu-a11y-spacing",
  links: "lu-a11y-links",
  headings: "lu-a11y-headings",
  still: "lu-a11y-still",
  cursor: "lu-a11y-cursor",
  focus: "lu-a11y-focus",
  dark: "lu-a11y-dark",
  pick: "lu-a11y-picking",
};

const FONT_HREF = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap";
export const LEGIBLE_FONT = '"Atkinson Hyperlegible", Verdana, Tahoma, sans-serif';

function cursorUrl(fill: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'><path d='M6 4l30 15-13 4-5.5 13z' fill='${fill}' stroke='white' stroke-width='3' stroke-linejoin='round'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 5 3`;
}

function docCss(accent: string): string {
  const own = `:not([${UI_ATTR}]):not([${UI_ATTR}] *)`;
  const icons = `:not(i):not([class*="icon"]):not([class*="Icon"]):not([class*="material-"]):not([class*="fa-"]):not([class^="fa"]):not(svg *)`;
  return `
html.${CLASS.font} body *${own}${icons}{font-family:${LEGIBLE_FONT}!important}
html.${CLASS.spacing} body *${own}{letter-spacing:.1em!important;word-spacing:.16em!important;line-height:1.75!important}
html.${CLASS.links} a[href]${own},html.${CLASS.links} [role="link"]${own}{text-decoration:underline!important;text-decoration-thickness:2px!important;text-underline-offset:3px!important;outline:2px solid ${accent}!important;outline-offset:2px!important;border-radius:3px}
html.${CLASS.headings} :is(h1,h2,h3,h4,h5,h6,[role="heading"])${own}{outline:2px dashed ${accent}!important;outline-offset:4px!important;border-radius:4px}
html.${CLASS.still} *${own},html.${CLASS.still} *${own}::before,html.${CLASS.still} *${own}::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important}
html.${CLASS.cursor},html.${CLASS.cursor} *${own}{cursor:${cursorUrl("#111827")},auto!important}
html.${CLASS.cursor} :is(a,button,[role="button"],label,select,summary)${own},html.${CLASS.cursor} :is(a,button,[role="button"],label,select,summary)${own} *{cursor:${cursorUrl(accent)},pointer!important}
html.${CLASS.focus} :focus${own}{outline:3px solid ${accent}!important;outline-offset:3px!important;box-shadow:0 0 0 6px ${accent}40!important;border-radius:4px}
html.${CLASS.dark}{background:#fff}
html.${CLASS.dark} :is(img,video,canvas,iframe,embed,object,[style*="background-image"]),html.${CLASS.dark} [${UI_ATTR}]{filter:invert(1) hue-rotate(180deg)!important}
html.${CLASS.pick} .lu-a11y-pick{outline:3px dashed ${accent}!important;outline-offset:4px!important;border-radius:4px;cursor:pointer!important;background-color:${accent}14!important}
`;
}

/* ---------------------------------------------------------------- tamanho do texto */

const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH", "IFRAME", "CANVAS", "VIDEO", "AUDIO", "IMG", "BR", "HR", "TEMPLATE", "OBJECT", "EMBED"]);
const FIELDS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON"]);

function hasOwnText(el: Element): boolean {
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && (n.nodeValue || "").trim()) return true;
  return false;
}

/**
 * Escala cada elemento com texto próprio a partir do tamanho ORIGINAL dele (medido com tudo
 * restaurado), em px e !important. Funciona em sites com px, rem ou em sem compor escalas:
 * todos os tamanhos são lidos antes de qualquer escrita. Conteúdo novo (SPA) refaz a escala
 * inteira, no máximo uma vez por segundo — restaurar e reaplicar na mesma tarefa não pinta
 * nada no meio, então não pisca.
 */
function createTextScaler() {
  let factor = 1;
  let touched: { el: HTMLElement; inline: string; priority: string }[] = [];
  let observer: MutationObserver | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = 0;

  function reset() {
    for (const t of touched) t.el.style.setProperty("font-size", t.inline, t.priority);
    touched = [];
  }
  function run() {
    reset();
    if (factor === 1 || !document.body) return;
    const els: HTMLElement[] = [];
    document.body.querySelectorAll("*").forEach((el) => {
      if (SKIP.has(el.tagName.toUpperCase()) || el.closest(`[${UI_ATTR}]`)) return;
      if (hasOwnText(el) || FIELDS.has(el.tagName)) els.push(el as HTMLElement);
    });
    const sizes = els.map((el) => parseFloat(getComputedStyle(el).fontSize) || 0);
    els.forEach((el, i) => {
      if (!sizes[i]) return;
      touched.push({ el, inline: el.style.getPropertyValue("font-size"), priority: el.style.getPropertyPriority("font-size") });
      el.style.setProperty("font-size", `${Math.round(sizes[i] * factor * 10) / 10}px`, "important");
    });
    last = Date.now();
  }
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      run();
    }, Math.max(150, 1000 - (Date.now() - last)));
  }
  return {
    set(f: number) {
      if (f === factor) return;
      factor = f;
      run();
      if (f !== 1 && !observer && typeof MutationObserver !== "undefined" && document.body) {
        observer = new MutationObserver((list) => {
          for (const m of list) {
            for (const n of Array.from(m.addedNodes)) {
              if (n.nodeType === 1 && !(n as Element).closest?.(`[${UI_ATTR}]`)) return schedule();
              if (n.nodeType === 3) return schedule();
            }
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
      if (f === 1 && observer) {
        observer.disconnect();
        observer = null;
      }
    },
    destroy() {
      observer?.disconnect();
      observer = null;
      if (timer) clearTimeout(timer);
      factor = 1;
      reset();
    },
  };
}

/* ---------------------------------------------------------------- escolha de texto (leitor/Libras) */

const BLOCK = "p,li,h1,h2,h3,h4,h5,h6,td,th,blockquote,figcaption,label,dd,dt,caption,summary,legend,[role=heading]";
const INTERACTIVE = "a,button,input,select,textarea,[role=button],[role=link],[contenteditable],[contenteditable=true]";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export function readableFrom(t: Element | null): HTMLElement | null {
  if (!t || t.closest(`[${UI_ATTR}]`)) return null;
  const block = t.closest(BLOCK) as HTMLElement | null;
  if (block) {
    const s = clean(block.innerText || block.textContent || "");
    if (s.length >= 2 && s.length <= 1500) return block;
  }
  for (let el = t as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (hasOwnText(el)) {
      const s = clean(el.innerText || el.textContent || "");
      if (s.length >= 2 && s.length <= 800) return el;
    }
  }
  return null;
}

/** Nome acessível curto de um elemento focado (para o leitor ao navegar por Tab). */
export function accessibleName(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return clean(aria);
  const labelled = el.getAttribute("aria-labelledby");
  if (labelled) {
    const t = labelled.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ");
    if (clean(t)) return clean(t);
  }
  const h = el as HTMLElement;
  const s = clean(h.innerText || h.textContent || "") || el.getAttribute("title") || el.getAttribute("placeholder") || el.getAttribute("alt") || "";
  return clean(s).slice(0, 300);
}

/* ---------------------------------------------------------------- efeitos */

export interface PageEffects {
  apply(p: A11yPrefs): void;
  setAccent(accent: string): void;
  /** liga o modo "clique num texto": o callback recebe o texto escolhido */
  setPicker(cb: ((text: string, el: HTMLElement) => void) | null): void;
  /** leitura de foco (Tab) para o leitor de texto */
  setFocusReader(cb: ((text: string) => void) | null): void;
  destroy(): void;
}

export function createPageEffects(overlayRoot: HTMLElement, accent: string): PageEffects {
  const html = document.documentElement;
  const style = document.createElement("style");
  style.setAttribute(UI_ATTR, "a11y-style");
  style.textContent = docCss(accent);
  (document.head || html).appendChild(style);

  const scaler = createTextScaler();
  const originalFilter = html.style.getPropertyValue("filter");
  let filtersSvg: SVGSVGElement | null = null;
  let fontLink: HTMLLinkElement | null = null;

  // máscara e régua: dentro do Shadow DOM do widget (não herdam o CSS do site)
  const maskTop = document.createElement("div");
  const maskBot = document.createElement("div");
  const guide = document.createElement("div");
  maskTop.className = "mask mask-top";
  maskBot.className = "mask mask-bot";
  guide.className = "guide";
  for (const el of [maskTop, maskBot, guide]) {
    el.hidden = true;
    overlayRoot.appendChild(el);
  }
  let pointerY = typeof innerHeight === "number" ? innerHeight / 2 : 300;
  let maskOn = false;
  let guideOn = false;
  const BAND = 120;
  function place() {
    if (maskOn) {
      maskTop.style.height = `${Math.max(0, pointerY - BAND / 2)}px`;
      maskBot.style.top = `${pointerY + BAND / 2}px`;
    }
    if (guideOn) guide.style.top = `${pointerY + 14}px`;
  }
  const onMove = (e: PointerEvent | TouchEvent) => {
    const y = "touches" in e ? e.touches[0]?.clientY : (e as PointerEvent).clientY;
    if (typeof y === "number") {
      pointerY = y;
      place();
    }
  };
  let tracking = false;
  function track(on: boolean) {
    if (on === tracking) return;
    tracking = on;
    if (on) {
      document.addEventListener("pointermove", onMove as EventListener, { passive: true });
      document.addEventListener("touchmove", onMove as EventListener, { passive: true });
    } else {
      document.removeEventListener("pointermove", onMove as EventListener);
      document.removeEventListener("touchmove", onMove as EventListener);
    }
  }

  function ensureFilters() {
    if (filtersSvg) return;
    const ns = "http://www.w3.org/2000/svg";
    filtersSvg = document.createElementNS(ns, "svg");
    filtersSvg.setAttribute(UI_ATTR, "a11y-filters");
    filtersSvg.setAttribute("aria-hidden", "true");
    filtersSvg.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
    filtersSvg.innerHTML = (["protan", "deutan", "tritan"] as const)
      .map((m) => `<filter id="lu-a11y-cb-${m}" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="${colorBlindMatrix(m).join(" ")}"/></filter>`)
      .join("");
    (document.body || html).appendChild(filtersSvg);
  }

  function ensureFont() {
    if (fontLink) return;
    fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = FONT_HREF;
    fontLink.setAttribute(UI_ATTR, "a11y-font");
    (document.head || html).appendChild(fontLink);
  }

  /* escolha de texto (leitor de texto e Libras) */
  let pickCb: ((text: string, el: HTMLElement) => void) | null = null;
  let hovered: HTMLElement | null = null;
  const unhover = () => {
    hovered?.classList.remove("lu-a11y-pick");
    hovered = null;
  };
  const onOver = (e: Event) => {
    const t = e.target as Element;
    if (t.closest?.(INTERACTIVE)) return unhover();
    const el = readableFrom(t);
    if (el === hovered) return;
    unhover();
    if (el) {
      hovered = el;
      el.classList.add("lu-a11y-pick");
    }
  };
  const onClick = (e: Event) => {
    const t = e.target as Element;
    if (!pickCb || t.closest?.(INTERACTIVE) || t.closest?.(`[${UI_ATTR}]`)) return;
    const el = readableFrom(t);
    if (!el) return;
    const text = clean(el.innerText || el.textContent || "");
    if (text) pickCb(text, el);
  };
  let focusCb: ((text: string) => void) | null = null;
  const onFocus = (e: Event) => {
    const t = e.target as Element;
    if (!focusCb || !t || t.closest?.(`[${UI_ATTR}]`)) return;
    const name = accessibleName(t);
    if (name) focusCb(name);
  };

  let current: A11yPrefs | null = null;

  return {
    apply(p) {
      current = p;
      html.classList.toggle(CLASS.font, p.legibleFont);
      if (p.legibleFont) ensureFont();
      html.classList.toggle(CLASS.spacing, p.spacing);
      html.classList.toggle(CLASS.links, p.highlightLinks);
      html.classList.toggle(CLASS.headings, p.highlightHeadings);
      html.classList.toggle(CLASS.still, p.stopAnimations);
      html.classList.toggle(CLASS.cursor, p.bigCursor);
      html.classList.toggle(CLASS.focus, p.focusRing);
      html.classList.toggle(CLASS.dark, p.contrast === "dark");

      const filters: string[] = [];
      if (p.contrast === "high") filters.push("contrast(1.35)");
      if (p.contrast === "dark") filters.push("invert(1) hue-rotate(180deg)");
      if (p.saturation === "low") filters.push("saturate(.45)");
      if (p.saturation === "high") filters.push("saturate(1.8)");
      if (p.saturation === "mono") filters.push("grayscale(1)");
      if (p.colorBlind !== "off") {
        ensureFilters();
        filters.push(`url(#lu-a11y-cb-${p.colorBlind})`);
      }
      if (filters.length) html.style.setProperty("filter", filters.join(" "), "important");
      else if (originalFilter) html.style.setProperty("filter", originalFilter);
      else html.style.removeProperty("filter");

      scaler.set(TEXT_SIZES[p.textSize] / 100);

      maskOn = p.readingMask;
      guideOn = p.readingGuide;
      maskTop.hidden = maskBot.hidden = !maskOn;
      guide.hidden = !guideOn;
      track(maskOn || guideOn);
      place();
    },
    setAccent(accent) {
      style.textContent = docCss(accent);
    },
    setPicker(cb) {
      pickCb = cb;
      html.classList.toggle(CLASS.pick, !!cb);
      if (cb) {
        document.addEventListener("mouseover", onOver, true);
        document.addEventListener("click", onClick, true);
      } else {
        document.removeEventListener("mouseover", onOver, true);
        document.removeEventListener("click", onClick, true);
        unhover();
      }
    },
    setFocusReader(cb) {
      focusCb = cb;
      if (cb) document.addEventListener("focusin", onFocus, true);
      else document.removeEventListener("focusin", onFocus, true);
    },
    destroy() {
      if (current) {
        for (const c of Object.values(CLASS)) html.classList.remove(c);
      }
      scaler.destroy();
      track(false);
      this.setPicker(null);
      this.setFocusReader(null);
      if (originalFilter) html.style.setProperty("filter", originalFilter);
      else html.style.removeProperty("filter");
      style.remove();
      filtersSvg?.remove();
      fontLink?.remove();
      maskTop.remove();
      maskBot.remove();
      guide.remove();
    },
  };
}
