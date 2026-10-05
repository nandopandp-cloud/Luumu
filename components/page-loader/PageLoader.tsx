"use client";

import { useEffect, useRef, useState } from "react";
import { LuumuLogo } from "@/components/ui/LuumuLogo";
import { usePageLoading } from "./store";

/*
  Loading entre páginas — a ameixa da Luumu corre pela área de conteúdo (protótipo aprovado:
  prototypes/page-loading.html, variação A, no ritmo da câmera lenta 3×).

    0–300     a área recebe um véu claro
    300–750   a ameixa entra correndo
    750–1350  CSAT → Pesquisa → Dados → Insights (~330 ms cada)
    1350–1800 cruza o centro com rastro lavanda
    1800–2100 sai da tela (e, se ainda carregando, volta a passar; após ~1,8 s, o nome da Luumu)

  Sem atrasar o produto: só aparece se a página demorar mais de 700 ms (antes disso, o esqueleto); quando a página
  fica pronta, a ameixa acelera e sai (fica no mínimo 600 ms na tela, para não piscar).
  Menu e topo continuam nítidos. Quem pede movimento reduzido não vê a animação.
*/
const K = 3;
// só quando a página demora de verdade: abaixo disso o esqueleto discreto basta
const SHOW_DELAY = 700;
const MIN_VISIBLE = 600;
const EXIT = 320;
const BLUR = 100 * K;
const PASS = 600 * K;
const CHIPS = [
  { k: "csat", label: "CSAT", at: 250 * K, x: 0.27, dy: -118 },
  { k: "pesq", label: "Pesquisa", at: 310 * K, x: 0.38, dy: 96 },
  { k: "dados", label: "Dados", at: 370 * K, x: 0.5, dy: -126 },
  { k: "ins", label: "Insights", at: 430 * K, x: 0.6, dy: 100 },
] as const;

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a));
const eo = (p: number) => 1 - (1 - p) ** 3;
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** posição da ameixa numa passada (fração da largura): rápida na entrada, visível no centro, acelera na saída */
const runX = (p: number) =>
  p < 0.25 ? lerp(-0.12, 0.3, eo(p / 0.25)) : p < 0.83 ? lerp(0.3, 0.68, (p - 0.25) / 0.58) : lerp(0.68, 1.15, ((p - 0.83) / 0.17) ** 1.6);

export function PageLoader() {
  const loading = usePageLoading();
  const [on, setOn] = useState(false);
  const loadingRef = useRef(loading);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadingRef.current = loading;
    if (!loading || on) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // carga rápida não mostra nada
    const id = setTimeout(() => loadingRef.current && setOn(true), SHOW_DELAY);
    return () => clearTimeout(id);
  }, [loading, on]);

  useEffect(() => {
    if (!on || !root.current) return;
    const el = root.current;
    const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
    const runner = q<HTMLDivElement>(".pl-runner");
    const shadow = q<HTMLDivElement>(".pl-shadow");
    const trails = [q<HTMLDivElement>(".pl-trail"), q<HTMLDivElement>(".pl-trail2")];
    const speeds = Array.from(el.querySelectorAll<HTMLDivElement>(".pl-speed"));
    const chips = Array.from(el.querySelectorAll<HTMLDivElement>(".pl-chip"));
    const brand = q<HTMLDivElement>(".pl-brand");
    const parts = {
      legF: q<SVGGElement>("[data-p=legF]"),
      legB: q<SVGGElement>("[data-p=legB]"),
      armF: q<SVGGElement>("[data-p=armF]"),
      armB: q<SVGGElement>("[data-p=armB]"),
      leafL: q<SVGGElement>("[data-p=leafL]"),
      leafR: q<SVGGElement>("[data-p=leafR]"),
    };
    const start = performance.now();
    let exitAt = -1;
    let exitFrom = 0;
    let raf = 0;

    const frame = (now: number) => {
      const t = now - start;
      const W = el.clientWidth;
      const cy = Math.min(el.clientHeight * 0.42, window.innerHeight * 0.36);
      if (exitAt < 0 && !loadingRef.current && t >= MIN_VISIBLE) exitAt = t;

      const inPass = t >= BLUR;
      const p = inPass ? ((t - BLUR) % PASS) / PASS : 0;
      const pass = Math.floor((t - BLUR) / PASS);
      let x = inPass ? runX(p) * W : -0.2 * W;
      if (exitAt >= 0) {
        // página pronta: acelera até sair
        if (exitFrom === 0) exitFrom = x;
        x = lerp(exitFrom, 1.2 * W, eo(seg(t, exitAt, exitAt + EXIT)));
      }
      const leaving = exitAt >= 0 ? seg(t, exitAt, exitAt + EXIT) : 0;

      el.style.setProperty("--pl-veil", (seg(t, 0, BLUR) * (1 - eo(leaving))).toFixed(3));

      const stride = (t / 1000) * 2 * Math.PI * (7 / K);
      const bob = -Math.abs(Math.sin(stride)) * 9;
      const sw = Math.sin(stride);
      runner.style.opacity = inPass ? "1" : "0";
      runner.style.transform = `translate(${x.toFixed(1)}px, ${(cy + bob).toFixed(1)}px) rotate(8deg) scale(1.1)`;
      parts.legF.setAttribute("transform", `rotate(${(sw * 28).toFixed(1)} 18 50) translate(${(sw * 6).toFixed(1)} ${(-Math.max(0, sw) * 6).toFixed(1)})`);
      parts.legB.setAttribute("transform", `rotate(${(-sw * 28).toFixed(1)} -14 50) translate(${(-sw * 6).toFixed(1)} ${(-Math.max(0, -sw) * 6).toFixed(1)})`);
      parts.armF.setAttribute("transform", `rotate(${(-sw * 22).toFixed(1)} 52 18)`);
      parts.armB.setAttribute("transform", `rotate(${(sw * 22).toFixed(1)} -50 16)`);
      parts.leafL.setAttribute("transform", `rotate(${(-6 - Math.sin(stride * 0.5) * 6).toFixed(1)} 0 -58)`);
      parts.leafR.setAttribute("transform", `rotate(${(-10 + Math.sin(stride * 0.5 + 1) * 6).toFixed(1)} 4 -60)`);
      shadow.style.opacity = inPass ? "0.9" : "0";
      shadow.style.transform = `translate(${x.toFixed(1)}px, ${(cy + 92).toFixed(1)}px) scale(${(1.1 + bob / 60).toFixed(3)})`;

      const vis = inPass ? 1 - leaving : 0;
      const trailLen = vis * lerp(180, 380, clamp((p - 0.15) / 0.5)) * (1 - 0.4 * seg(p, 0.85, 1));
      const tOp = vis * (0.55 + 0.45 * Math.sin(Math.PI * clamp((p - 0.3) / 0.6)));
      trails.forEach((tr, i) => {
        const L = trailLen * (i ? 0.8 : 1);
        tr.style.width = `${L.toFixed(1)}px`;
        tr.style.opacity = tOp.toFixed(3);
        tr.style.transform = `translate(${(x - L - 10).toFixed(1)}px, ${(cy + (i ? 16 : 22)).toFixed(1)}px)`;
      });
      speeds.forEach((sp, i) => {
        sp.style.opacity = (vis * 0.8 * Math.abs(Math.sin(stride * 0.5 + i))).toFixed(3);
        sp.style.transform = `translate(${(x - (i ? 50 : 70) - 70 - i * 20).toFixed(1)}px, ${(cy + (i ? 48 : -24)).toFixed(1)}px)`;
      });
      CHIPS.forEach((c, i) => {
        const a = pass === 0 && exitAt < 0 ? seg(t, c.at - 20 * K, c.at + 110 * K) : 0;
        const o = a > 0 && a < 1 ? Math.sin(a * Math.PI) ** 0.6 : 0;
        const s = 0.7 + 0.3 * eo(clamp(a * 2.2)) - 0.08 * seg(a, 0.7, 1);
        chips[i]!.style.opacity = o.toFixed(3);
        chips[i]!.style.transform = `translate(${(c.x * W - 50).toFixed(1)}px, ${(cy + c.dy - (1 - a) * 8).toFixed(1)}px) scale(${s.toFixed(3)})`;
      });
      // espera longa: o nome da Luumu
      brand.style.opacity = (seg(t, PASS, PASS + 250) * (1 - leaving)).toFixed(3);

      if (exitAt >= 0 && t >= exitAt + EXIT) return setOn(false);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [on]);

  if (!on) return null;
  return (
    <div ref={root} className="pl-root" role="status" aria-label="Carregando a página">
      <div className="pl-veil" />
      <div className="pl-speed" style={{ width: 70 }} />
      <div className="pl-speed" style={{ width: 50 }} />
      <div className="pl-trail" />
      <div className="pl-trail pl-trail2" />
      <div className="pl-shadow" />
      {CHIPS.map((c) => (
        <div key={c.k} className="pl-chip">
          <ChipIcon k={c.k} />
          {c.label}
        </div>
      ))}
      <div className="pl-runner">
        <RunningPlum />
      </div>
      <div className="pl-brand">
        <LuumuLogo size={34} wordmarkOnly />
        <p>Carregando sua experiência…</p>
      </div>
    </div>
  );
}

function ChipIcon({ k }: { k: string }) {
  if (k === "csat")
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="11" fill="#7b3ff2" />
        <circle cx="8.5" cy="10" r="1.6" fill="#fff" />
        <circle cx="15.5" cy="10" r="1.6" fill="#fff" />
        <path d="M7.5 14 Q12 18.5 16.5 14" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    );
  if (k === "pesq")
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="2" y="2" width="20" height="20" rx="6" fill="#ede6ff" />
        <rect x="6" y="7" width="3" height="3" rx="1" fill="#8b5cf6" />
        <rect x="11" y="7.5" width="8" height="2" rx="1" fill="#a78bfa" />
        <rect x="6" y="13" width="3" height="3" rx="1" fill="#8b5cf6" />
        <rect x="11" y="13.5" width="6" height="2" rx="1" fill="#a78bfa" />
      </svg>
    );
  if (k === "dados")
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="12" width="4.5" height="9" rx="1.5" fill="#5b7cff" />
        <rect x="9.75" y="7" width="4.5" height="14" rx="1.5" fill="#3f63ff" />
        <rect x="16.5" y="3" width="4.5" height="18" rx="1.5" fill="#2f53f0" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 1.5 C13 8 16 11 22.5 12 C16 13 13 16 12 22.5 C11 16 8 13 1.5 12 C8 11 11 8 12 1.5Z" fill="#8b5cf6" />
      <circle cx="20" cy="4" r="2" fill="#ffc233" />
    </svg>
  );
}

/** A ameixa flat correndo, com o celular dos dados na mão. */
function RunningPlum() {
  return (
    <svg viewBox="-90 -110 180 190" aria-hidden>
      <defs>
        <clipPath id="pl-body">
          <circle r="62" />
        </clipPath>
      </defs>
      <g data-p="legB">
        <ellipse cx="-14" cy="62" rx="16" ry="10" fill="#4f1db8" />
      </g>
      <g data-p="armB">
        <ellipse cx="-58" cy="20" rx="14" ry="17" fill="#5a22c7" />
      </g>
      <circle r="62" fill="#6a2fe0" />
      <circle cx="-9" cy="-10" r="58" fill="#7f45f2" clipPath="url(#pl-body)" />
      <ellipse cx="-30" cy="-30" rx="13" ry="7.5" fill="#a47cff" transform="rotate(-38 -30 -30)" />
      <circle cx="-43" cy="-14" r="3.6" fill="#a47cff" />
      <path d="M-9 -60 Q0 -54 9 -60" stroke="#5422b8" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M1 -57 C 1 -66 4 -72 9 -78" stroke="#8a3b34" strokeWidth="6" strokeLinecap="round" fill="none" />
      <g transform="translate(2 -58) scale(1.18) translate(-2 58)">
        <g data-p="leafL">
          <path d="M-2 -60 C -14 -82 -44 -90 -64 -76 C -48 -58 -22 -50 -2 -60Z" fill="#7fd34e" />
          <path d="M-2 -60 C -22 -64 -42 -70 -64 -76 C -48 -58 -22 -50 -2 -60Z" fill="#4cae3c" />
        </g>
        <g data-p="leafR">
          <path d="M5 -62 C 16 -94 52 -104 72 -88 C 60 -64 30 -54 5 -62Z" fill="#8ad95a" />
          <path d="M5 -62 C 28 -70 50 -78 72 -88 C 60 -64 30 -54 5 -62Z" fill="#52b541" />
        </g>
      </g>
      <ellipse cx="-36" cy="18" rx="11" ry="6.5" fill="#ff8dbd" />
      <ellipse cx="38" cy="18" rx="11" ry="6.5" fill="#ff8dbd" />
      <ellipse cx="-18" cy="-2" rx="12.5" ry="14" fill="#fff" />
      <ellipse cx="24" cy="-2" rx="12.5" ry="14" fill="#fff" />
      <circle cx="-13" cy="1" r="9" fill="#1c1033" />
      <circle cx="29" cy="1" r="9" fill="#1c1033" />
      <circle cx="-9.5" cy="-3" r="3.2" fill="#fff" />
      <circle cx="32.5" cy="-3" r="3.2" fill="#fff" />
      <path d="M-30 -24 Q -20 -30 -8 -24" stroke="#1c1033" strokeWidth="4.2" fill="none" strokeLinecap="round" />
      <path d="M14 -26 Q 24 -32 36 -26" stroke="#1c1033" strokeWidth="4.2" fill="none" strokeLinecap="round" />
      <path d="M-4 13 Q 10 34 22 13 Q 10 16 -4 13Z" fill="#2a0f4a" />
      <path d="M3 24 Q 10 30 16 24 Q 10 20 3 24Z" fill="#ff5d8f" />
      <g transform="translate(46 34) rotate(16)">
        <rect x="-20" y="-30" width="42" height="58" rx="9" fill="#fff" />
        <rect x="-14" y="6" width="7" height="14" rx="2" fill="#a78bfa" />
        <rect x="-4" y="-2" width="7" height="22" rx="2" fill="#8b5cf6" />
        <rect x="6" y="-10" width="7" height="30" rx="2" fill="#7c3aed" />
      </g>
      <g data-p="armF">
        <ellipse cx="62" cy="28" rx="13" ry="16" fill="#7238e6" />
      </g>
      <g data-p="legF">
        <ellipse cx="18" cy="62" rx="16" ry="10" fill="#5a22c7" />
      </g>
    </svg>
  );
}
