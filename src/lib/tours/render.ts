/*
  HTML + CSS do card do tour. PURO (só strings): o runtime injeta num Shadow DOM no produto
  do cliente e o painel injeta num Shadow DOM do preview — o que o administrador vê no
  builder é exatamente o que o usuário final vê.

  Segurança: todo texto configurável passa por `esc`. Nada de HTML do cliente é interpretado.
*/
import type { Side } from "./position";
import type { StepType, TourAppearance, TourStep } from "./types";

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

interface Palette {
  bg: string;
  fg: string;
  mut: string;
  line: string;
  sunken: string;
  accent: string;
  accentFg: string;
  shadow: string;
}

export function palette(ap: TourAppearance): Palette {
  const accent = ap.theme === "minimal" ? "#111827" : ap.accent;
  if (ap.theme === "dark") {
    return {
      bg: "#14162A",
      fg: "#FAFAFB",
      mut: "#B4B9D1",
      line: "#2C3052",
      sunken: "#1C1F38",
      // o roxo padrão perde contraste no fundo escuro: usa a variação clara da marca
      accent: ap.accent === "#6B2BD9" ? "#8B5CF6" : ap.accent,
      accentFg: "#FFFFFF",
      shadow: "0 24px 60px rgba(0,0,0,.55)",
    };
  }
  return {
    bg: "#FFFFFF",
    fg: "#0D0F1A",
    mut: "#5B6072",
    line: ap.theme === "minimal" ? "#E5E7EB" : "#ECE6F8",
    sunken: ap.theme === "minimal" ? "#F3F4F6" : "#F6F2FE",
    accent,
    accentFg: "#FFFFFF",
    shadow:
      ap.theme === "minimal"
        ? "0 10px 30px rgba(17,24,39,.14)"
        : "0 24px 60px rgba(75,28,171,.20), 0 4px 12px rgba(13,15,26,.08)",
  };
}

/** CSS do card, escopado pelo prefixo `lt-` e pensado para rodar dentro de Shadow DOM. */
export function tourCss(ap: TourAppearance): string {
  const p = palette(ap);
  const r = ap.radius;
  return `
  :host { all: initial; }
  .lt-root, .lt-root * { box-sizing: border-box; }
  .lt-root { font-family: 'Plus Jakarta Sans','Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
    -webkit-font-smoothing: antialiased; color: ${p.fg}; }
  .lt-card { position: absolute; background: ${p.bg}; color: ${p.fg}; border: 1px solid ${p.line};
    border-radius: ${r}px; box-shadow: ${p.shadow}; padding: 20px 20px 16px; outline: none;
    pointer-events: auto; line-height: 1.45; animation: lt-in .32s cubic-bezier(.16,1,.3,1); }
  .lt-card:focus-visible { box-shadow: ${p.shadow}, 0 0 0 3px ${p.accent}55; }
  .lt-card.lt-modal { padding: 28px 28px 22px; text-align: left; }
  @keyframes lt-in { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .lt-card { animation: none; } }
  .lt-arrow { position: absolute; width: 14px; height: 14px; background: ${p.bg}; border: 1px solid ${p.line};
    transform: rotate(45deg); }
  .lt-arrow.lt-top { bottom: -8px; border-top: 0; border-left: 0; }
  .lt-arrow.lt-bottom { top: -8px; border-bottom: 0; border-right: 0; }
  .lt-arrow.lt-left { right: -8px; border-bottom: 0; border-left: 0; }
  .lt-arrow.lt-right { left: -8px; border-top: 0; border-right: 0; }
  /* a imagem respeita o próprio tamanho: nunca estica além do natural, só encolhe para caber */
  .lt-media { display: flex; align-items: center; justify-content: center; margin: 0 0 14px; padding: 12px;
    background: ${p.sunken}; border-radius: ${Math.max(6, r - 6)}px; }
  .lt-img { display: block; width: auto; height: auto; max-width: 100%; max-height: 120px; object-fit: contain; }
  .lt-modal .lt-img { max-height: 180px; }
  .lt-modal .lt-media { margin-bottom: 18px; padding: 16px; }
  .lt-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; min-height: 20px; }
  .lt-count { font-size: 12px; font-weight: 600; color: ${p.mut}; letter-spacing: .02em; }
  .lt-dots { display: flex; gap: 5px; flex: 1; max-width: 160px; }
  .lt-dots i { display: block; height: 4px; flex: 1; border-radius: 4px; background: ${p.line}; }
  .lt-dots i.lt-on { background: ${p.accent}; }
  .lt-x { margin-left: auto; display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 8px;
    background: transparent; color: ${p.mut}; cursor: pointer; font-size: 18px; line-height: 1; }
  .lt-x:hover { background: ${p.sunken}; color: ${p.fg}; }
  .lt-title { margin: 0 0 6px; font-size: 17px; font-weight: 800; letter-spacing: -.01em; line-height: 1.3; }
  .lt-modal .lt-title { font-size: 22px; }
  .lt-body { margin: 0; font-size: 14px; color: ${p.mut}; white-space: pre-line; }
  .lt-modal .lt-body { font-size: 15px; }
  .lt-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  .lt-links { display: flex; gap: 12px; }
  .lt-link { border: 0; background: none; padding: 0; color: ${p.mut}; font: inherit; font-size: 12.5px; font-weight: 600;
    cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  .lt-link:hover { color: ${p.fg}; }
  .lt-actions { display: flex; gap: 8px; margin-left: auto; }
  .lt-btn { font: inherit; font-size: 14px; font-weight: 700; border-radius: 12px; padding: 9px 18px; cursor: pointer;
    border: 1px solid transparent; transition: filter .15s, background .15s; display: inline-flex; align-items: center; gap: 6px; }
  .lt-btn:focus-visible { outline: 3px solid ${p.accent}55; outline-offset: 2px; }
  .lt-primary { background: ${p.accent}; color: ${p.accentFg}; }
  .lt-primary:hover { filter: brightness(1.08); }
  .lt-secondary { background: ${p.sunken}; color: ${p.fg}; border-color: ${p.line}; }
  .lt-secondary:hover { filter: brightness(.98); }
  .lt-backdrop { position: fixed; inset: 0; background: rgba(13,15,26,${ap.backdropOpacity}); pointer-events: auto; }
  .lt-hole { position: fixed; border-radius: 10px; pointer-events: none;
    box-shadow: 0 0 0 9999px rgba(13,15,26,${ap.backdropOpacity}); transition: all .2s ease; }
  .lt-ring { position: fixed; border-radius: 10px; pointer-events: none; box-shadow: 0 0 0 3px ${p.accent}, 0 0 0 8px ${p.accent}33;
    transition: all .2s ease; }
  .lt-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `;
}

export interface CardContext {
  index: number; // posição entre os passos visíveis (0-based)
  total: number;
  appearance: TourAppearance;
  side: Side | "center";
  arrow: number | null;
  width: number;
}

const arrowStyle = (side: Side, offset: number) =>
  side === "top" || side === "bottom" ? `left:${offset - 7}px` : `top:${offset - 7}px`;

/** HTML do card de um passo. Ações via data-lt: next | back | close | skip | never. */
export function renderCard(step: TourStep, ctx: CardContext): string {
  const ap = ctx.appearance;
  const isModal = step.type === "modal" || ctx.side === "center";
  const last = ctx.index >= ctx.total - 1;
  const parts: string[] = [];

  if (!isModal && ctx.arrow !== null && ctx.side !== "center") {
    parts.push(`<div class="lt-arrow lt-${ctx.side}" style="${arrowStyle(ctx.side, ctx.arrow)}"></div>`);
  }
  if (step.imageUrl) parts.push(`<div class="lt-media"><img class="lt-img" src="${esc(step.imageUrl)}" alt="" /></div>`);

  const progress =
    ap.progress === "count" && ctx.total > 1
      ? `<span class="lt-count">${ctx.index + 1} de ${ctx.total}</span>`
      : ap.progress === "dots" && ctx.total > 1
      ? `<span class="lt-dots" aria-hidden="true">${Array.from({ length: ctx.total }, (_, i) => `<i class="${i <= ctx.index ? "lt-on" : ""}"></i>`).join("")}</span><span class="lt-sr">Passo ${ctx.index + 1} de ${ctx.total}</span>`
      : "<span></span>";
  const close = ap.allowDismiss ? `<button type="button" class="lt-x" data-lt="close" aria-label="Fechar tour">×</button>` : "";
  parts.push(`<div class="lt-head">${progress}${close}</div>`);
  parts.push(`<h2 class="lt-title" id="lt-title">${esc(step.title)}</h2>`);
  if (step.body) parts.push(`<p class="lt-body" id="lt-body">${esc(step.body)}</p>`);

  const links: string[] = [];
  if (step.buttons.showSkip && !last) links.push(`<button type="button" class="lt-link" data-lt="skip">${esc(step.buttons.skip)}</button>`);
  if (ap.dontShowAgain) links.push(`<button type="button" class="lt-link" data-lt="never">Não mostrar novamente</button>`);
  const actions: string[] = [];
  if (step.buttons.showBack && ctx.index > 0) {
    actions.push(`<button type="button" class="lt-btn lt-secondary" data-lt="back">${esc(step.buttons.back)}</button>`);
  } else if (step.buttons.showBack && ctx.index === 0 && ap.allowDismiss && isModal) {
    // no primeiro passo "voltar" vira "agora não" (dispensar)
    actions.push(`<button type="button" class="lt-btn lt-secondary" data-lt="close">${esc(step.buttons.back)}</button>`);
  }
  if (step.advance !== "click_target") {
    actions.push(`<button type="button" class="lt-btn lt-primary" data-lt="next">${esc(step.buttons.next)}${last ? "" : " →"}</button>`);
  }
  parts.push(`<div class="lt-foot"><div class="lt-links">${links.join("")}</div><div class="lt-actions">${actions.join("")}</div></div>`);

  const kind: StepType = step.type;
  return `<div class="lt-card lt-${isModal ? "modal" : kind}" role="dialog" aria-modal="${isModal}" aria-labelledby="lt-title"${
    step.body ? ' aria-describedby="lt-body"' : ""
  } tabindex="-1" style="width:${ctx.width}px">${parts.join("")}</div>`;
}

/** Largura do card: configurada, ou padrão por tipo; sempre cabe na tela. */
export function cardWidth(type: StepType, configured: number | null, viewportWidth: number, margin = 16): number {
  const max = viewportWidth - margin * 2;
  const base = configured ?? (type === "modal" ? 440 : 340);
  return Math.max(200, Math.min(base, max));
}
