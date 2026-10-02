/*
  Posicionamento do card em relação ao alvo. PURO: recebe retângulos em coordenadas do
  viewport e devolve onde o card fica. Usado pelo runtime (SDK) e pelo preview do painel.

  Garantias: o card nunca sai da tela (clamp com margem), o lado é invertido quando não cabe
  (flip) e "auto" escolhe o lado com mais espaço.
*/
import type { Placement } from "./types";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Size {
  width: number;
  height: number;
}
export type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

export interface PositionResult {
  x: number;
  y: number;
  side: Side | "center";
  /** deslocamento da seta ao longo do lado do card (px); null = sem seta */
  arrow: number | null;
}

export interface PositionOptions {
  offset?: number; // distância entre alvo e card
  margin?: number; // distância mínima da borda da tela
}

const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const ARROW_PAD = 18;

function split(p: Placement): { side: Side | "auto" | "center"; align: Align } {
  if (p === "auto" || p === "center") return { side: p, align: "center" };
  const [side, align] = p.split("-") as [Side, Align | undefined];
  return { side, align: align ?? "center" };
}

/** Espaço livre em cada lado do alvo, já descontando offset e margem. */
function space(anchor: Rect, vp: Size, gap: number): Record<Side, number> {
  return {
    top: anchor.y - gap,
    bottom: vp.height - (anchor.y + anchor.height) - gap,
    left: anchor.x - gap,
    right: vp.width - (anchor.x + anchor.width) - gap,
  };
}

function fits(side: Side, card: Size, free: Record<Side, number>): boolean {
  return side === "top" || side === "bottom" ? free[side] >= card.height : free[side] >= card.width;
}

function clamp(v: number, min: number, max: number) {
  return max < min ? min : Math.min(max, Math.max(min, v));
}

export function center(card: Size, vp: Size, margin = 12): PositionResult {
  return {
    x: clamp((vp.width - card.width) / 2, margin, vp.width - card.width - margin),
    y: clamp((vp.height - card.height) / 2, margin, vp.height - card.height - margin),
    side: "center",
    arrow: null,
  };
}

/** Escolhe o lado: o pedido se couber, senão o oposto, senão o com mais espaço. */
export function resolveSide(placement: Placement, anchor: Rect, card: Size, vp: Size, gap: number): Side {
  const free = space(anchor, vp, gap);
  const { side } = split(placement);
  if (side !== "auto" && side !== "center") {
    if (fits(side, card, free)) return side;
    if (fits(OPPOSITE[side], card, free)) return OPPOSITE[side];
  }
  const order: Side[] = ["bottom", "top", "right", "left"];
  const fitting = order.find((s) => fits(s, card, free));
  if (fitting) return fitting;
  // nada cabe inteiro (tela pequena): o lado com mais espaço relativo
  return order.reduce((best, s) => {
    const ratio = (x: Side) => free[x] / (x === "top" || x === "bottom" ? card.height : card.width);
    return ratio(s) > ratio(best) ? s : best;
  }, order[0]);
}

export function computePosition(
  anchor: Rect | null,
  card: Size,
  vp: Size,
  placement: Placement,
  opts: PositionOptions = {}
): PositionResult {
  const offset = opts.offset ?? 12;
  const margin = opts.margin ?? 12;
  if (!anchor || placement === "center") return center(card, vp, margin);

  const side = resolveSide(placement, anchor, card, vp, offset + margin);
  const { align } = split(placement);
  let x: number;
  let y: number;

  if (side === "top" || side === "bottom") {
    y = side === "top" ? anchor.y - offset - card.height : anchor.y + anchor.height + offset;
    x =
      align === "start"
        ? anchor.x
        : align === "end"
        ? anchor.x + anchor.width - card.width
        : anchor.x + anchor.width / 2 - card.width / 2;
  } else {
    x = side === "left" ? anchor.x - offset - card.width : anchor.x + anchor.width + offset;
    y =
      align === "start"
        ? anchor.y
        : align === "end"
        ? anchor.y + anchor.height - card.height
        : anchor.y + anchor.height / 2 - card.height / 2;
  }

  x = clamp(x, margin, vp.width - card.width - margin);
  y = clamp(y, margin, vp.height - card.height - margin);

  // a seta aponta para o centro do alvo, mesmo depois do clamp deslocar o card
  const horizontal = side === "top" || side === "bottom";
  const anchorCenter = horizontal ? anchor.x + anchor.width / 2 : anchor.y + anchor.height / 2;
  const start = horizontal ? x : y;
  const length = horizontal ? card.width : card.height;
  const arrow = clamp(anchorCenter - start, ARROW_PAD, length - ARROW_PAD);

  return { x, y, side, arrow };
}

/** O alvo está (ao menos em parte) dentro do viewport? */
export function isInViewport(r: Rect, vp: Size, slack = 0): boolean {
  return r.y + r.height > -slack && r.y < vp.height + slack && r.x + r.width > -slack && r.x < vp.width + slack;
}
