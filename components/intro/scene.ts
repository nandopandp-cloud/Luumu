/*
  Coreografia da animação de entrada da Luumu (os 12 quadros aprovados em
  prototypes/luumu-flow.html). Tudo é função do tempo: render(t) posiciona cada peça da cena.

    1 Início · 2 Ameixa ganha vida · 3 Boas-vindas · 4 Explorando a plataforma ·
    5 CSAT e Pesquisas · 6 Dados, Insights e Produtos · 7 Outros recursos ·
    8 Tudo em movimento · 9 Transição · 10 Carregamento · (11 Quase pronto, se demorar) ·
    12 Página carregada (o véu sobre o app real some)
*/

const NS = "http://www.w3.org/2000/svg";
const C = { x: 480, y: 240 };
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a));
const eo = (p: number) => 1 - (1 - p) ** 3;
const ei = (p: number) => p * p * p;
const eio = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const back = (p: number, s = 1.7) => (p <= 0 ? 0 : 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2);
const wob = (t: number, t0: number, amp: number, f = 14, k = 6) =>
  !(t > t0) || !isFinite(t0) ? 0 : amp * Math.exp(-k * (t - t0)) * Math.sin(f * (t - t0));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

const K = { dot: [0, 0.35], life: [0.35, 0.85], exit: [3.6, 4.4], logo: 4.3 } as const;
/** a página aparece depois que o logo entrou (quadro 10) */
export const INTRO_MIN_END = K.logo + 0.8;
const END_FADE = 0.8;

/* ------------------------------------------------------------------ cards (flat) */
const ink = "#2b1a5e";
const txt = (x: number, y: number, s: number, c = ink) =>
  `<text x="${x}" y="${y}" font-size="${s}" font-weight="700" fill="${c}" font-family="ui-sans-serif, system-ui, sans-serif">`;
const box = (w: number, h: number, r = 15) => `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${r}" fill="#fff" filter="url(#fCard)"/>`;
const bullets = (x: number, y: number, n = 2, w = 50) =>
  Array.from({ length: n }, (_, i) => `<rect x="${x}" y="${y - 4 + i * 14}" width="9" height="8" rx="2.5" fill="#a78bfa"/><rect x="${x + 14}" y="${y - 3 + i * 14}" width="${i ? w - 14 : w}" height="7" rx="3.5" fill="#ddd2fb"/>`).join("");
const barsIco = (x: number, y: number, s = 1, c = ["#5b7cff", "#3f63ff", "#2f53f0"]) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-16" y="-2" width="9" height="16" rx="2.5" fill="${c[0]}"/><rect x="-4" y="-12" width="9" height="26" rx="2.5" fill="${c[1]}"/><rect x="8" y="-20" width="9" height="34" rx="2.5" fill="${c[2]}"/></g>`;
const smiley = (x: number, y: number) =>
  `<circle cx="${x}" cy="${y}" r="15" fill="#7b3ff2"/><circle cx="${x - 5}" cy="${y - 3}" r="2.2" fill="#fff"/><circle cx="${x + 5}" cy="${y - 3}" r="2.2" fill="#fff"/><path d="M${x - 7} ${y + 3} Q ${x} ${y + 10} ${x + 7} ${y + 3}" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const greenBars = (x: number, y: number) =>
  `<rect x="${x}" y="${y + 6}" width="7" height="10" rx="2" fill="#5cc443"/><rect x="${x + 10}" y="${y}" width="7" height="16" rx="2" fill="#4cae3c"/><rect x="${x + 20}" y="${y - 7}" width="7" height="23" rx="2" fill="#3f9c34"/>`;
const pie = (x: number, y: number, r = 17) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#6a3ef0"/><path d="M${x} ${y} L${x} ${y - r} A${r} ${r} 0 0 1 ${x + r * 0.95} ${y + r * 0.3}Z" fill="#ff6fa3"/>`;
const heart = (s = 1) => `<path transform="scale(${s})" d="M0 13 C -19 1 -16 -14 -7 -14 C -3 -14 0 -10 0 -8 C 0 -10 3 -14 7 -14 C 16 -14 19 1 0 13Z" fill="#ff5d8f"/>`;
const people = (x: number, y: number, c = "#7b3ff2", c2 = "#b39af7") =>
  `<circle cx="${x - 5}" cy="${y - 6}" r="7.5" fill="${c}"/><path d="M${x - 18} ${y + 14} C ${x - 18} ${y + 2} ${x + 8} ${y + 2} ${x + 8} ${y + 14}Z" fill="${c}"/><circle cx="${x + 12}" cy="${y - 3}" r="5.5" fill="${c2}"/><path d="M${x + 4} ${y + 14} C ${x + 4} ${y + 6} ${x + 22} ${y + 6} ${x + 22} ${y + 14}Z" fill="${c2}"/>`;
const sparkle = (x: number, y: number, s = 1, c = "#8b5cf6") =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -16 C 2 -5 5 -2 16 0 C 5 2 2 5 0 16 C -2 5 -5 2 -16 0 C -5 -2 -2 -5 0 -16Z" fill="${c}"/>`;
const cube = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><path d="M-13 -7 L0 -14 L13 -7 L13 8 L0 15 L-13 8Z" fill="#3f63ff"/><path d="M-13 -7 L0 0 L13 -7 L0 -14Z" fill="#8aa2ff"/><path d="M0 0 L0 15 L13 8 L13 -7Z" fill="#2f4fe0"/></g>`;

const KIND: Record<string, () => string> = {
  barsCard: () => box(66, 66) + barsIco(0, 2),
  heartCard: () => box(58, 58) + heart(1.05),
  pesqMini: () => box(112, 62) + txt(-42, -10, 11.5, "#7b3ff2") + `Pesquisas</text>` + bullets(-42, 8, 2, 46),
  csat: () => box(128, 92) + txt(-50, -22, 12.5) + `CSAT</text>` + txt(6, -22, 12.5, "#d7cdf3") + `CSAT</text>` + smiley(-30, 12) + greenBars(4, 6),
  pesquisas: () => box(132, 84) + txt(-50, -14, 14) + `Pesquisas</text>` + bullets(-50, 6, 2, 64),
  dados: () =>
    box(130, 80) + txt(-50, -20, 9, "#c8bdf0") + `CSAT</text>` + txt(-14, -14, 14) + `Dados</text>` + barsIco(-38, 10, 0.85) +
    `<rect x="-12" y="4" width="50" height="7" rx="3.5" fill="#e3e9ff"/><rect x="-12" y="16" width="36" height="7" rx="3.5" fill="#eef1ff"/>`,
  insights: () => box(112, 92) + txt(-40, -22, 14) + `Insights</text>` + sparkle(0, 14, 1.1) + `<circle cx="22" cy="2" r="3" fill="#c4b0f7"/>`,
  produtos: () => box(136, 62) + cube(-38, 0) + txt(-12, 5, 14) + `Produtos</text>`,
  relatorios: () =>
    box(124, 104) + txt(-48, -26, 14) + `Relatórios</text>` + pie(-16, 16) +
    `<rect x="10" y="6" width="32" height="7" rx="3.5" fill="#efe9fd"/><rect x="10" y="18" width="22" height="7" rx="3.5" fill="#efe9fd"/>`,
  usuarios: () => box(118, 92) + txt(-44, -20, 14) + `Usuários</text>` + people(-4, 16),
  barsSoft: () => box(60, 60) + barsIco(0, 0, 0.9, ["#c9bdf6", "#b5a4f2", "#a08cee"]),
  heartSoft: () => box(56, 56) + heart(0.95),
  peopleSoft: () => box(60, 60) + people(-2, -1, "#5b7cff", "#8fa6ff"),
  pieSoft: () => box(60, 60) + pie(0, 0, 15),
};

interface Card {
  k: string;
  in: number;
  out: number;
  x: number;
  y: number;
  r: number;
  orbit?: number;
}
const CARDS: Card[] = [
  { k: "barsCard", in: 1.3, out: 1.82, x: 288, y: 118, r: -8 },
  { k: "heartCard", in: 1.38, out: 1.82, x: 690, y: 92, r: 9 },
  { k: "pesqMini", in: 1.46, out: 1.82, x: 735, y: 200, r: 10 },
  { k: "csat", in: 1.75, out: 2.22, x: 268, y: 182, r: -9, orbit: 0 },
  { k: "pesquisas", in: 1.84, out: 2.22, x: 712, y: 196, r: 9, orbit: 1 },
  { k: "dados", in: 2.15, out: 2.66, x: 282, y: 120, r: -8 },
  { k: "insights", in: 2.23, out: 2.66, x: 690, y: 112, r: 10 },
  { k: "produtos", in: 2.31, out: 2.66, x: 700, y: 318, r: -5, orbit: 2 },
  { k: "relatorios", in: 2.6, out: 3.02, x: 272, y: 132, r: -10, orbit: 3 },
  { k: "usuarios", in: 2.68, out: 3.02, x: 692, y: 118, r: 12 },
];
const ORBIT_A = [-2.62, -0.52, 2.62, 0.52];
const TRAIL = [
  { k: "barsSoft", x: 225, y: 168, r: -10 },
  { k: "heartSoft", x: 372, y: 186, r: 8 },
  { k: "peopleSoft", x: 520, y: 200, r: -4 },
  { k: "pieSoft", x: 236, y: 300, r: 6 },
];
type PartKind = "leaf" | "dot" | "dashY" | "dashG";
const PARTS: [number, number, number, number, number, PartKind][] = [
  [0.5, 640, 150, 40, -30, "leaf"], [0.55, 340, 300, -36, 20, "dot"], [0.95, 330, 170, -30, -10, "dot"],
  [1.4, 185, 210, -30, 10, "leaf"], [1.5, 610, 250, 20, 6, "dot"], [1.9, 400, 330, -20, 14, "dot"],
  [2.15, 150, 230, -24, 6, "leaf"], [2.2, 392, 210, -14, -6, "dashY"], [2.25, 420, 290, -18, 8, "dashG"], [2.3, 600, 160, 14, -10, "dashY"], [2.35, 360, 250, -20, 0, "dashG"],
  [2.65, 395, 275, -16, 4, "dashG"], [2.7, 420, 300, -18, 10, "dashY"], [2.75, 560, 190, 14, -6, "dashY"],
  [3.1, 780, 130, 26, -20, "leaf"], [3.2, 300, 330, -20, 10, "leaf"],
  [3.75, 95, 196, -30, -10, "leaf"], [3.85, 600, 150, 30, -20, "dot"],
];

const waveD = (x0: number, x1: number, yA: number, yB: number, amp: number, ph: number) => {
  let d = "";
  for (let i = 0; i <= 44; i++) {
    const p = i / 44;
    d += (i ? " L" : "M") + lerp(x0, x1, p).toFixed(1) + " " + (lerp(yA, yB, p) + Math.sin(p * Math.PI * 1.6 + ph) * amp).toFixed(1);
  }
  return d;
};

/**
 * Monta a cena dentro de `svg` e devolve render(t, doneAt): `doneAt` é quando o app pode
 * aparecer (Infinity enquanto não). O véu sobre o app real é atualizado junto.
 */
export function createIntroScene(svg: SVGSVGElement, veil: HTMLElement) {
  const $ = (id: string) => svg.querySelector<SVGElement>(`#${id}`)!;
  const attr = (id: string, name: string, v: string | number) => $(id).setAttribute(name, String(v));
  const show = (id: string, on: boolean) => ($(id).style.display = on ? "" : "none");
  const mk = (k: string, parent: SVGElement) => {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = KIND[k]!();
    parent.appendChild(g);
    return g;
  };
  const cardEls = CARDS.map((c) => mk(c.k, $("cardsFront")));
  const trailEls = TRAIL.map((c) => mk(c.k, $("cardsFront")));
  const partEls = PARTS.map(([, , , , , k]) => {
    const g = document.createElementNS(NS, "g");
    g.innerHTML =
      k === "leaf"
        ? `<use href="#leafShape" transform="scale(1.1)"/>`
        : k === "dot"
          ? `<circle r="3.6" fill="#a98bf3"/>`
          : `<rect x="-6" y="-2" width="12" height="4" rx="2" fill="${k === "dashY" ? "#ffc233" : "#5cc443"}"/>`;
    $("parts").appendChild(g);
    return g;
  });
  const dots = Array.from($("dots").children);

  return function render(t: number, doneAt: number) {
    // 12: o app real (atrás do véu) fica nítido
    const end = seg(t, doneAt, doneAt + END_FADE);
    veil.style.opacity = (1 - eo(end)).toFixed(3);
    veil.style.setProperty("--intro-blur", `${(8 * (1 - eo(end))).toFixed(2)}px`);

    // 1 Início
    const pDot = seg(t, K.dot[0], K.dot[1]);
    attr("dot", "opacity", (eo(pDot) * (1 - seg(t, 0.42, 0.52))).toFixed(3));
    attr("dotCore", "r", (10 * back(pDot)).toFixed(2));
    attr("dotHalo", "r", (17 * eo(pDot)).toFixed(2));

    // 2 Ameixa ganha vida
    const pLife = seg(t, K.life[0], K.life[1]);
    attr("orbit0", "opacity", (seg(t, 0.35, 0.55) * (1 - seg(t, 0.9, 1.15))).toFixed(3));
    attr("orb2", "stroke-dashoffset", (-t * 70).toFixed(1));
    attr("orb3", "stroke-dashoffset", (t * 50).toFixed(1));

    let x = C.x;
    let y = C.y;
    let rot = 0;
    let sc = pLife <= 0 ? 0 : lerp(0.16, 1, back(pLife, 1.25));
    y += wob(t, 0.85, -9, 15, 6);
    y += Math.sin(t * 3.4) * 3 * seg(t, 1.2, 1.5);
    const pEx = seg(t, K.exit[0], K.exit[1]);
    if (pEx > 0) {
      const a = eio(seg(pEx, 0, 0.5));
      const b = ei(seg(pEx, 0.55, 1));
      x = lerp(C.x, 760, a) + (1260 - 760) * b;
      y += -30 * a;
      rot = 10 * a + 6 * b;
      sc *= 1 - 0.1 * a;
    }
    attr("plum", "opacity", clamp(seg(t, 0.35, 0.42)).toFixed(3));
    attr("plum", "transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${(sc * 1.12).toFixed(3)})`);
    attr("shadow", "cx", x.toFixed(1));
    attr("shadow", "rx", (lerp(20, 64, clamp(sc)) * (pEx > 0 ? 1 - 0.3 * pEx : 1)).toFixed(1));
    attr("shadow", "cy", pEx > 0 ? 332 - 40 * eio(seg(pEx, 0, 0.5)) : 332);
    attr("shadow", "opacity", (clamp(pDot * 2) * (1 - seg(pEx, 0.5, 1))).toFixed(3));

    // folhas
    const lR = seg(t, 0.55, 0.82);
    const lL = seg(t, 0.88, 1.1);
    const sway = Math.sin(t * 3.2) * 4 + wob(t, 0.9, 12, 13, 5) + (pEx > 0 ? Math.sin(t * 12) * 6 : 0);
    attr("leaves", "opacity", clamp(lR * 3).toFixed(3));
    attr("leafR", "transform", `rotate(${(sway + (1 - back(lR)) * 60).toFixed(1)} 4 -60) scale(${Math.max(0, back(lR)).toFixed(3)})`);
    attr("leafL", "opacity", clamp(lL * 3).toFixed(3));
    attr("leafL", "transform", `rotate(${(-sway - (1 - back(lL)) * 50).toFixed(1)} 0 -58) scale(${Math.max(0, back(lL)).toFixed(3)})`);

    // rosto: 3 ^^ · 4–6 piscadinha · 7 calmo · 8 piscadinha · 9 ^^
    attr("face", "opacity", seg(t, 0.9, 1.06).toFixed(3));
    const calm = t >= 2.6 && t < 3.0;
    const happy = t < 1.3 || t >= 3.6;
    const wink = !happy && !calm;
    show("happyL", happy);
    show("happyR", happy || wink);
    show("calmL", calm);
    show("calmR", calm);
    show("eyesOpenL", wink);
    show("eyesOpenR", false);
    show("mouthOpen", !calm);
    show("mouthCalm", calm);
    const armIn = back(seg(t, 1.25, 1.45), 2);
    const wave = t > 1.25 && t < 1.7 ? Math.sin((t - 1.25) * 22) * 14 - 18 : 0;
    attr("armR", "opacity", clamp(armIn * 2).toFixed(3));
    attr("armL", "opacity", clamp(armIn * 2).toFixed(3));
    attr("armR", "transform", `rotate(${(wave + (pEx > 0 ? -50 : 0)).toFixed(1)} 50 16) translate(${(50 * (1 - armIn)).toFixed(1)} 0) scale(${Math.max(0, armIn).toFixed(3)})`);
    attr("armL", "transform", `rotate(${(pEx > 0 ? 30 : Math.sin(t * 4) * 6).toFixed(1)} -50 20) translate(${(-50 * (1 - armIn)).toFixed(1)} 0) scale(${Math.max(0, armIn).toFixed(3)})`);
    attr("sparks", "opacity", (seg(t, 0.95, 1.1) * (1 - seg(t, 3.0, 3.1)) * (0.85 + 0.15 * Math.sin(t * 16))).toFixed(3));

    // fita, cards translúcidos ao fundo e anel
    const bandOp = seg(t, 1.25, 1.55) * (1 - seg(t, 2.92, 3.08)) + clamp(pEx * 5) * (1 - seg(t, 4.2, 4.45));
    attr("band", "opacity", clamp(bandOp).toFixed(3));
    const inExit = pEx > 0;
    const bx1 = inExit ? x - 20 : 1040;
    const yA = inExit ? 250 : 370;
    const yB = inExit ? y + 10 : 205;
    const ph = t * 1.5;
    attr("bandA", "d", waveD(-80, bx1, yA, yB, 30, ph));
    attr("bandA2", "d", waveD(-80, bx1, yA + 10, yB + 4, 37.5, ph + 1.1));
    attr("bandB", "d", waveD(-80, bx1, yA - 8, yB - 6, 30, ph + 0.15));
    attr("bandC", "d", waveD(-80, bx1, yA + 22, yB + 16, 30, ph - 0.2));
    attr("ghosts", "opacity", (seg(t, 2.6, 2.8) * (1 - seg(t, 2.95, 3.1))).toFixed(3));
    attr("ring", "opacity", (seg(t, 2.95, 3.2) * (1 - seg(t, 3.58, 3.75))).toFixed(3));
    attr("ring2", "stroke-dashoffset", (-t * 30).toFixed(1));

    // cards em ondas (4–7) → anel (8)
    CARDS.forEach((c, i) => {
      const pin = seg(t, c.in, c.in + 0.3);
      const pout = seg(t, c.out, c.out + 0.22);
      let cx = lerp(C.x + (c.x - C.x) * 0.5, c.x + Math.sin(t * 2.6 + i) * 3.5, eo(pin));
      let cy = lerp(C.y + (c.y - C.y) * 0.5, c.y + Math.cos(t * 2.2 + i) * 3.5, eo(pin));
      let s = back(pin, 2) * (1 - 0.12 * pout);
      let o = clamp(pin * 2) * (1 - pout);
      let r = c.r * (1 + 0.6 * (1 - pin));
      if (c.orbit !== undefined && t >= 2.98) {
        const a = ORBIT_A[c.orbit]! + (t - 3.3) * 0.35;
        const pin8 = seg(t, 2.98, 3.24);
        cx = C.x + Math.cos(a) * 262;
        cy = 238 + Math.sin(a) * 118;
        s = back(pin8, 2) * (1 - 0.15 * seg(t, 3.6, 3.8));
        o = clamp(pin8 * 2) * (1 - seg(t, 3.6, 3.78));
        r = Math.cos(a) * -8;
      }
      cardEls[i]!.setAttribute("opacity", o.toFixed(3));
      cardEls[i]!.setAttribute("transform", `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${r.toFixed(1)}) scale(${Math.max(0, s).toFixed(3)})`);
    });
    // 9: cards de ícone se enfileiram atrás da ameixa e saem com ela
    TRAIL.forEach((c, i) => {
      const pin = seg(t, 3.62 + i * 0.05, 3.9 + i * 0.05);
      const go = ei(seg(t, 4.0 + i * 0.03, 4.4));
      const cx = lerp(C.x, c.x, eo(pin)) + 900 * go;
      const cy = lerp(C.y, c.y, eo(pin)) + Math.sin(t * 3 + i) * 3;
      trailEls[i]!.setAttribute("opacity", (clamp(pin * 2) * (1 - seg(t, 4.2, 4.4))).toFixed(3));
      trailEls[i]!.setAttribute("transform", `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${c.r}) scale(${Math.max(0, back(pin, 1.6) * 0.95).toFixed(3)})`);
    });
    PARTS.forEach(([t0, px, py, dx, dy], i) => {
      const a = seg(t, t0, t0 + 0.75);
      partEls[i]!.setAttribute("opacity", (a > 0 && a < 1 ? Math.sin(a * Math.PI) : 0).toFixed(3));
      partEls[i]!.setAttribute("transform", `translate(${(px + dx * eo(a)).toFixed(1)} ${(py + dy * eo(a)).toFixed(1)}) rotate(${(i * 41 + a * 70 - 20).toFixed(1)})`);
    });

    // 10–11: logo, mensagem e pontos em progressão
    const lin = seg(t, K.logo, K.logo + 0.4);
    attr("logo", "opacity", (eo(lin) * (1 - seg(t, doneAt, doneAt + 0.4))).toFixed(3));
    const lift = 8 * (1 - eo(lin));
    attr("wm", "transform", `translate(360 ${(180 + lift).toFixed(1)})`);
    const msg = t < 5.3 ? "Organizando tudo para você..." : "Quase lá...";
    if ($("msg").textContent !== msg) $("msg").textContent = msg;
    const mIn = t < 5.3 ? seg(t, 4.5, 4.85) : seg(t, 5.3, 5.6);
    attr("msg", "y", (262 + lift).toFixed(1));
    attr("msg", "opacity", (t > 5.1 && t < 5.3 ? 1 - seg(t, 5.1, 5.3) : mIn).toFixed(3));
    const head = (t * 2.2) % 5;
    dots.forEach((d, i) => {
      const fill = clamp(head - i);
      d.setAttribute("cy", (298 + lift).toFixed(1));
      d.setAttribute("class", fill >= 0.99 ? "intro-dot-on" : fill > 0.01 ? "intro-dot-half" : "intro-dot-off");
      d.setAttribute("r", (6.5 + (fill > 0.01 && fill < 0.99 ? 0.8 : 0)).toFixed(2));
    });

    return end >= 1;
  };
}
