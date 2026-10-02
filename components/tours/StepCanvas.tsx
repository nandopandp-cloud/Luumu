"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { computePosition } from "@/lib/tours/position";
import { cardWidth, esc, renderCard, tourCss } from "@/lib/tours/render";
import { deviceConfig } from "@/lib/tours/normalize";
import type { Device, TourAppearance, TourStep } from "@/lib/tours/types";

/** Viewport virtual de cada dispositivo (px "reais", escalados para caber no painel). */
export const DEVICE_VIEWPORT: Record<Device, { width: number; height: number }> = {
  desktop: { width: 1280, height: 760 },
  tablet: { width: 834, height: 720 },
  mobile: { width: 390, height: 740 },
};

/*
  Página-esqueleto do "produto" no preview. Neutra de propósito: o que importa é o card e o
  destaque, que são renderizados pelo MESMO código do runtime (lib/tours/render + position).
  O elemento alvo do passo vira um item real dessa página, no lugar que o tipo dele sugere.
*/
const MOCK_CSS = `
:host { all: initial; }
.mk { position: absolute; inset: 0; background: #F6F7FB; font-family: 'Plus Jakarta Sans','Inter',system-ui,sans-serif; color: #0D0F1A; overflow: hidden; display: flex; }
.mk-side { width: 220px; background: #1B1D33; padding: 22px 14px; display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
.mk-brand { display: flex; align-items: center; gap: 9px; color: #fff; font-weight: 800; font-size: 15px; margin: 0 6px 18px; }
.mk-brand i { width: 24px; height: 24px; border-radius: 8px; background: rgba(255,255,255,.18); }
.mk-nav { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; color: #B6B9D6; font-size: 13.5px; font-weight: 600; }
.mk-nav i { width: 16px; height: 16px; border-radius: 5px; background: currentColor; opacity: .5; }
.mk-nav.on { background: rgba(255,255,255,.08); color: #fff; }
.mk-main { flex: 1; padding: 26px 30px; display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.mk-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.mk-h { font-size: 24px; font-weight: 800; letter-spacing: -.02em; }
.mk-sub { font-size: 13px; color: #6B7080; margin-top: 4px; }
.mk-btn { background: #fff; border: 1px solid #E3E5EF; color: #0D0F1A; border-radius: 10px; padding: 10px 16px; font-weight: 700; font-size: 13.5px; white-space: nowrap; }
.mk-btn.solid { background: #2B2E4A; color: #fff; border-color: #2B2E4A; }
.mk-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.mk-card { background: #fff; border: 1px solid #E8EAF2; border-radius: 14px; padding: 16px; }
.mk-k { font-size: 12px; color: #6B7080; font-weight: 600; }
.mk-v { font-size: 24px; font-weight: 800; margin-top: 6px; }
.mk-line { height: 9px; border-radius: 6px; background: #ECEEF5; margin-top: 10px; }
.mk-chart { flex: 1; min-height: 120px; background: #fff; border: 1px solid #E8EAF2; border-radius: 14px; padding: 16px; position: relative; overflow: hidden; }
.mk-chart svg { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 70%; }
.mk-input { background: #fff; border: 1px solid #E3E5EF; border-radius: 10px; padding: 11px 14px; font-size: 13.5px; color: #6B7080; }
.mk-tabs { position: absolute; left: 0; right: 0; bottom: 0; height: 64px; background: #fff; border-top: 1px solid #E8EAF2; display: flex; justify-content: space-around; align-items: center; }
.mk-tab { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: #6B7080; padding: 6px 10px; border-radius: 10px; }
.mk-tab i { width: 18px; height: 18px; border-radius: 6px; background: currentColor; opacity: .45; }
.mk.mobile { flex-direction: column; }
.mk.mobile .mk-main { padding: 20px 16px 84px; gap: 14px; }
.mk.mobile .mk-grid { grid-template-columns: 1fr 1fr; }
.mk.mobile .mk-h { font-size: 20px; }
.mk.tablet .mk-side { width: 180px; }
[data-target] { position: relative; z-index: 1; }
.lt-root { position: absolute; inset: 0; pointer-events: none; }
.lt-root .lt-card, .lt-root .lt-backdrop, .lt-root .lt-hole, .lt-root .lt-ring { position: absolute; }
.lt-root .lt-card { pointer-events: auto; }
`;

const NAV = ["Dashboard", "Projetos", "Relatórios", "Equipe", "Configurações"];

function mockPage(step: TourStep | undefined, device: Device): string {
  const t = step && step.type !== "modal" ? step.target : null;
  const label = esc((t?.label || "Elemento").slice(0, 40));
  const kind = t?.kind ?? "other";
  const mark = (html: string, on: boolean) => (on ? html.replace(/^<(\w+)/, '<$1 data-target="1"') : html);
  const navTarget = !!t && (kind === "navigation" || kind === "menu" || kind === "tab");
  const btnTarget = !!t && (kind === "button" || kind === "link" || kind === "other" || kind === "select");
  const inputTarget = !!t && kind === "input";
  const cardTarget = !!t && kind === "card";
  const navItems = NAV.map((n, i) =>
    navTarget && i === 1 ? mark(`<div class="mk-nav on"><i></i>${label}</div>`, true) : `<div class="mk-nav${i === 0 && !navTarget ? " on" : ""}"><i></i>${n}</div>`
  );

  const main = `<div class="mk-main">
    <div class="mk-top"><div><div class="mk-h">Dashboard</div><div class="mk-sub">Acompanhe os principais indicadores</div></div>
      ${btnTarget ? mark(`<div class="mk-btn solid">${label}</div>`, true) : '<div class="mk-btn">Últimos 30 dias</div>'}</div>
    ${inputTarget ? mark(`<div class="mk-input">${label}</div>`, true) : ""}
    <div class="mk-grid">
      ${mark('<div class="mk-card"><div class="mk-k">' + (cardTarget ? label : "Respostas") + '</div><div class="mk-v">1.482</div><div class="mk-line"></div></div>', cardTarget)}
      <div class="mk-card"><div class="mk-k">Satisfação</div><div class="mk-v">4.6</div><div class="mk-line"></div></div>
      ${device === "mobile" ? "" : '<div class="mk-card"><div class="mk-k">Comentários</div><div class="mk-v">320</div><div class="mk-line"></div></div>'}
    </div>
    <div class="mk-chart"><div class="mk-k">Evolução</div>
      <svg viewBox="0 0 300 80" preserveAspectRatio="none"><path d="M0 70 L40 66 L80 58 L120 60 L160 44 L200 46 L240 30 L300 12" fill="none" stroke="#B9BCD6" stroke-width="2"/></svg></div>
  </div>`;

  if (device === "mobile") {
    const tabs = ["Início", "Projetos", "Relatórios", "Mais"].map((n, i) =>
      navTarget && i === 1 ? mark(`<div class="mk-tab"><i></i>${label}</div>`, true) : `<div class="mk-tab"><i></i>${n}</div>`
    );
    return `<div class="mk mobile">${main}<div class="mk-tabs">${tabs.join("")}</div></div>`;
  }
  return `<div class="mk ${device}"><div class="mk-side"><div class="mk-brand"><i></i>Seu Produto</div>${navItems.join("")}</div>${main}</div>`;
}

export function StepCanvas({
  steps,
  index,
  appearance,
  device,
  url,
  onAction,
}: {
  steps: TourStep[];
  index: number;
  appearance: TourAppearance;
  device: Device;
  url: string;
  onAction?: (action: "next" | "back" | "close") => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const vp = DEVICE_VIEWPORT[device];
  const step = steps[index];

  // escala para caber na largura disponível
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 2) / vp.width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vp.width]);

  // desenha página + passo no Shadow DOM (mesmo HTML/CSS do runtime)
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    if (!step) {
      root.innerHTML = `<style>${MOCK_CSS}</style>${mockPage(undefined, device)}`;
      return;
    }
    const cfg = deviceConfig(step, device);
    const hasTarget = step.type !== "modal" && !!step.target && cfg.placement !== "center";
    const width = cardWidth(step.type, device === "mobile" && cfg.width == null && hasTarget ? vp.width - 32 : cfg.width, vp.width);
    const spotlight = hasTarget && (step.type === "spotlight" || step.highlight === "spotlight");
    const ring = hasTarget && !spotlight && step.highlight === "ring";
    // o CSS do mock vem por último: troca o `position: fixed` do runtime por absolute no canvas
    root.innerHTML = `<style>${tourCss(appearance)}${MOCK_CSS}</style>
      ${mockPage(step, device)}
      <div class="lt-root">${!hasTarget ? '<div class="lt-backdrop" style="inset:0"></div>' : ""}${spotlight ? '<div class="lt-hole"></div>' : ""}${
        ring ? '<div class="lt-ring"></div>' : ""
      }${renderCard(step, { index, total: steps.length, appearance, side: hasTarget ? "bottom" : "center", arrow: null, width })}</div>`;

    const card = root.querySelector(".lt-card") as HTMLElement | null;
    const target = root.querySelector("[data-target]") as HTMLElement | null;
    if (!card) return;
    // posição no viewport virtual: desconta o deslocamento e a escala do preview
    const hostBox = host.getBoundingClientRect();
    const k = hostBox.width / vp.width || 1;
    const rect = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { x: (r.left - hostBox.left) / k, y: (r.top - hostBox.top) / k, width: r.width / k, height: r.height / k };
    };
    const anchor = hasTarget && target ? rect(target) : null;
    const pos = computePosition(anchor, { width: card.offsetWidth, height: card.offsetHeight }, vp, hasTarget ? cfg.placement : "center", {
      offset: 14,
      margin: 12,
    });
    card.style.left = `${pos.x}px`;
    card.style.top = `${pos.y}px`;
    card.style.animation = "none";
    if (anchor && pos.side !== "center" && pos.arrow !== null) {
      const a = document.createElement("div");
      a.className = `lt-arrow lt-${pos.side}`;
      a.setAttribute("style", pos.side === "top" || pos.side === "bottom" ? `left:${pos.arrow - 7}px` : `top:${pos.arrow - 7}px`);
      card.insertBefore(a, card.firstChild);
    }
    for (const sel of [".lt-hole", ".lt-ring"]) {
      const box = root.querySelector(sel) as HTMLElement | null;
      if (!box || !anchor) continue;
      box.style.cssText = `left:${anchor.x - 6}px;top:${anchor.y - 6}px;width:${anchor.width + 12}px;height:${anchor.height + 12}px`;
    }
    const onClick = (e: Event) => {
      const a = (e.target as Element).closest("[data-lt]")?.getAttribute("data-lt");
      if (a === "next" || a === "back") onAction?.(a);
      else if (a) onAction?.("close");
    };
    card.addEventListener("click", onClick);
    return () => card.removeEventListener("click", onClick);
  }, [step, index, steps.length, appearance, device, vp, onAction, scale]);

  let shownUrl = url;
  try {
    const u = new URL(url);
    shownUrl = u.host + (step?.route ?? u.pathname);
  } catch {
    shownUrl = step?.route ? `seuproduto.com${step.route}` : "seuproduto.com";
  }

  return (
    <div ref={wrapRef} className="w-full">
      <div
        className="mx-auto overflow-hidden rounded-2xl border border-line bg-[#1B1D33] shadow-[var(--shadow-lg)]"
        style={{ width: vp.width * scale + 2 }}
      >
        <div className="flex items-center gap-3 bg-bg-elev px-3 py-2">
          <span className="flex gap-1.5" aria-hidden>
            <i className="size-2.5 rounded-full bg-[#FF5F57]" />
            <i className="size-2.5 rounded-full bg-[#FEBC2E]" />
            <i className="size-2.5 rounded-full bg-[#28C840]" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg bg-bg-sunken px-3 py-1 font-mono text-[11px] text-fg-mut">
            <Lock className="size-3 shrink-0" />
            <span className="truncate">{shownUrl}</span>
          </span>
        </div>
        <div style={{ width: vp.width * scale, height: vp.height * scale }} className="relative overflow-hidden">
          <div
            ref={hostRef}
            role="img"
            aria-label={step ? `Pré-visualização do passo: ${step.title}` : "Pré-visualização"}
            style={{ width: vp.width, height: vp.height, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute" }}
          />
        </div>
      </div>
    </div>
  );
}
