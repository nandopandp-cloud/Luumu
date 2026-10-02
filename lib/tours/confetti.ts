/*
  Confete de conclusão do tour. Canvas puro, sem dependências: usado pelo runtime (no produto
  do cliente) e pelo preview do painel. Não bloqueia cliques (pointer-events: none), some
  sozinho em ~3s e não roda para quem pede menos movimento no sistema.
*/

const PALETTE = ["#7ED957", "#FFC93C", "#FF6B9A", "#4FC3F7", "#F3EDFF"];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  shape: 0 | 1; // retângulo | círculo
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

    const colors = opts.accent ? [opts.accent, ...PALETTE] : PALETTE;
    const pieces: Piece[] = [];
    // duas rajadas, dos cantos inferiores para o centro
    for (const side of [0, 1]) {
      for (let i = 0; i < 70; i++) {
        const angle = (side ? -1 : 1) * (Math.PI / 4 + Math.random() * (Math.PI / 5));
        const speed = 9 + Math.random() * 9;
        pieces.push({
          x: side ? W + 10 : -10,
          y: H * 0.85,
          vx: Math.sin(angle) * speed * (side ? 1 : 1),
          vy: -Math.cos(Math.abs(angle)) * speed - 4,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.35,
          w: 6 + Math.random() * 6,
          h: 8 + Math.random() * 8,
          color: colors[(Math.random() * colors.length) | 0],
          shape: Math.random() < 0.25 ? 1 : 0,
        });
      }
    }

    const started = performance.now();
    const DURATION = 2800;
    const frame = (now: number) => {
      const t = now - started;
      ctx.clearRect(0, 0, W, H);
      const fade = t > DURATION - 700 ? Math.max(0, (DURATION - t) / 700) : 1;
      for (const p of pieces) {
        p.vy += 0.32; // gravidade
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 2);
        }
        ctx.restore();
      }
      if (t < DURATION) requestAnimationFrame(frame);
      else canvas.remove();
    };
    requestAnimationFrame(frame);
  } catch {
    /* efeito decorativo: falhar em silêncio */
  }
}
