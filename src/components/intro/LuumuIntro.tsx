"use client";

import { useEffect, useRef, useState } from "react";
import { INTRO_COOKIE } from "./cookie";
import { INTRO_SVG } from "./scene-svg";
import { INTRO_MIN_END, createIntroScene } from "./scene";

/*
  Animação de entrada da Luumu: toca uma vez logo depois do login, por cima do app real
  (desfocado atrás de um véu), e termina com a página nítida. "Pular" encurta para o final.
  Quem pede movimento reduzido no sistema não vê a animação.
*/
export function LuumuIntro() {
  const [on, setOn] = useState(true);
  const veil = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const now = useRef(0);
  const doneAt = useRef(INTRO_MIN_END);

  useEffect(() => {
    // uma vez só: recarregar a página não repete
    document.cookie = `${INTRO_COOKIE}=; path=/; max-age=0; samesite=lax`;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !svg.current || !veil.current) {
      setOn(false);
      return;
    }
    const render = createIntroScene(svg.current, veil.current);
    const start = performance.now();
    let raf = 0;
    const tick = (ts: number) => {
      now.current = (ts - start) / 1000;
      if (render(now.current, doneAt.current)) return setOn(false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!on) return null;
  return (
    <div ref={veil} className="luumu-intro" role="status" aria-label="Carregando a Luumu">
      <svg ref={svg} viewBox="0 0 960 480" preserveAspectRatio="xMidYMid meet" aria-hidden="true" dangerouslySetInnerHTML={{ __html: INTRO_SVG }} />
      <button type="button" className="luumu-intro-skip" onClick={() => (doneAt.current = Math.min(doneAt.current, now.current))}>
        Pular
      </button>
    </div>
  );
}
