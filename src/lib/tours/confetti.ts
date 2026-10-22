/*
  Confete de conclusão do tour. Canvas puro, sem dependências: usado pelo runtime (no produto
  do cliente) e pelo preview do painel. Não bloqueia cliques (pointer-events: none), some
  sozinho e não roda para quem pede menos movimento no sistema.

  As peças nascem acima da tela, em ondas, e caem devagar como papel: velocidade terminal
  baixa, balanço lateral (cada peça com seu ritmo) e giro em 3D (achatamento pelo cosseno).
  A física usa o tempo real entre quadros, então a queda é igual em telas de 60 ou 120 Hz.
*/

const PALETTE = ["#7ED957", "#FFC93C", "#FF6B9A", "#4FC3F7", "#B794F6", "#FF8A4C"];

type Shape = "strip" | "circle" | "star" | "ribbon";

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: Shape;
  rot: number; // rotação no plano
  vrot: number;
  flip: number; // fase do giro 3D
  vflip: number;
  sway: number; // fase do balanço lateral
  vsway: number;
  swayAmp: number;
  terminal: number; // velocidade máxima de queda (px/s)
  delay: number; // ms até entrar em cena
}

const DURATION = 6500; // ms até o último confete sair
const FADE_MS = 1200;

function star(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Dispara o confete dentro de `container` (um elemento posicionado ou, com `fixed`, a tela
 * inteira). `accent` entra na paleta para combinar com a cor do tour.
 */
export function launchConfetti(container: HTMLElement | ShadowRoot, opts: { accent?: string; fixed?: boolean } = {}): void {
  try {
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const host = container instanceof HTMLElement ? container : (container.host as HTMLElement);
    const W = opts.fixed ? window.innerWidth : host.offsetWidth;
    const H = opts.fixed ? window.innerHeight : host.offsetHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = `position:${opts.fixed ? "fixed" : "absolute"};inset:0;width:${W}px;height:${H}px;pointer-events:none;z-index:2147483001;`;
    container.appendChild(canvas);
    ctx.scale(dpr, dpr);

    // a cor do tour aparece mais vezes que as outras
    const colors = opts.accent ? [opts.accent, opts.accent, ...PALETTE] : PALETTE;
    // densidade proporcional à largura: cheio no desktop, sem exagero no celular
    const count = Math.round(Math.min(260, Math.max(90, W / 5)));
    const scale = Math.min(1, Math.max(0.7, W / 1200));
    const shapes: Shape[] = ["strip", "strip", "strip", "circle", "star", "ribbon"];

    const pieces: Piece[] = Array.from({ length: count }, (_, i) => {
      // três ondas: a primeira cheia, as seguintes mais leves
      const wave = i < count * 0.55 ? 0 : i < count * 0.85 ? 1 : 2;
      return {
        x: Math.random() * W,
        y: -20 - Math.random() * H * 0.35,
        vx: (Math.random() - 0.5) * 60,
        vy: 40 + Math.random() * 90,
        size: (7 + Math.random() * 7) * scale,
        color: colors[(Math.random() * colors.length) | 0],
        shape: shapes[(Math.random() * shapes.length) | 0],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 3,
        flip: Math.random() * Math.PI * 2,
        vflip: 3 + Math.random() * 6,
        sway: Math.random() * Math.PI * 2,
        vsway: 1.2 + Math.random() * 1.8,
        swayAmp: 25 + Math.random() * 45,
        terminal: (90 + Math.random() * 110) * (0.8 + scale * 0.2),
        delay: wave * 650 + Math.random() * 900,
      };
    });

    const started = performance.now();
    let last = started;
    const frame = (now: number) => {
      const t = now - started;
      const dt = Math.min(0.05, (now - last) / 1000); // s; limita saltos de aba em segundo plano
      last = now;
      ctx.clearRect(0, 0, W, H);
      const fade = t > DURATION - FADE_MS ? Math.max(0, (DURATION - t) / FADE_MS) : 1;
      let alive = 0;

      for (const p of pieces) {
        if (t < p.delay) {
          alive++;
          continue;
        }
        // queda com resistência do ar: acelera até a velocidade terminal e para aí
        p.vy = Math.min(p.terminal, p.vy + 260 * dt);
        p.vx *= 1 - 0.8 * dt;
        p.sway += p.vsway * dt;
        p.flip += p.vflip * dt;
        p.rot += p.vrot * dt;
        p.x += (p.vx + Math.cos(p.sway) * p.swayAmp) * dt;
        p.y += p.vy * dt;
        if (p.y > H + 30) continue;
        alive++;

        const flat = Math.cos(p.flip); // -1..1: o "giro" que mostra frente e verso
        ctx.save();
        ctx.globalAlpha = fade * (0.85 + 0.15 * Math.abs(flat));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        const s = p.size;
        switch (p.shape) {
          case "strip":
            ctx.scale(1, flat);
            ctx.fillRect(-s * 0.35, -s * 0.75, s * 0.7, s * 1.5);
            break;
          case "circle":
            ctx.scale(Math.max(0.25, Math.abs(flat)), 1);
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
            ctx.fill();
            break;
          case "star":
            ctx.scale(Math.max(0.3, Math.abs(flat)), 1);
            star(ctx, s * 0.6);
            break;
          case "ribbon": {
            // serpentina: faixa ondulada que acompanha o balanço
            ctx.strokeStyle = p.color;
            ctx.lineWidth = s * 0.28;
            ctx.lineCap = "round";
            ctx.beginPath();
            for (let k = 0; k <= 6; k++) {
              const yy = -s + (k / 6) * s * 2.2;
              const xx = Math.sin(p.sway * 2 + k * 0.9) * s * 0.35;
              if (k === 0) ctx.moveTo(xx, yy);
              else ctx.lineTo(xx, yy);
            }
            ctx.stroke();
            break;
          }
        }
        ctx.restore();
      }

      if (t < DURATION && alive > 0) requestAnimationFrame(frame);
      else canvas.remove();
    };
    requestAnimationFrame(frame);
  } catch {
    /* efeito decorativo: falhar em silêncio */
  }
}
