/**
 * Intérprete Luumu (beta): catálogo dos personagens 3D e o visual que o painel configura.
 *
 * Módulo PURO (painel, SDK e testes). Os modelos ficam em public/a11y/libras3d/modelos/<id>.glb
 * (Microsoft Rocketbox, licença MIT, convertidos para GLB com 20 expressões ARKit) e as
 * miniaturas em public/a11y/libras3d/miniaturas/<id>.png.
 */

/** Faixa de cor da roupa de cima na textura do personagem (matiz em graus; S e L de 0 a 1). */
export interface ShirtRule {
  h: [number, number];
  s: [number, number];
  l: [number, number];
  /** onde o logo cai na posição "automática" (cm a partir do centro do peito) e escala */
  logo?: { dx?: number; dy?: number; scale?: number };
}

export interface Interpreter {
  id: string;
  name: string;
  hint: string;
  shirt: ShirtRule;
}

const NAVY: ShirtRule = { h: [200, 250], s: [0.2, 1], l: [0.03, 0.45] };

export const INTERPRETERS: Interpreter[] = [
  { id: "f11", name: "Morena", hint: "Cabelo preso", shirt: { ...NAVY, logo: { dy: -10 } } },
  { id: "f17", name: "Loira", hint: "Cabelo preso", shirt: { ...NAVY, logo: { dy: -9 } } },
  { id: "f15", name: "Ruiva", hint: "Cabelo longo", shirt: { h: [205, 265], s: [0.08, 1], l: [0.3, 0.9], logo: { dx: 8, dy: -1, scale: 0.6 } } },
  { id: "f08", name: "Morena", hint: "Cabelo longo", shirt: { ...NAVY, logo: { dy: -6 } } },
  { id: "m04", name: "Moreno", hint: "Cabelo crespo", shirt: { h: [170, 205], s: [0.25, 1], l: [0.25, 0.9] } },
  { id: "m16", name: "Loiro", hint: "Camisa lisa", shirt: NAVY },
  { id: "m11", name: "Ruivo", hint: "Cabelo curto", shirt: { h: [40, 110], s: [0.05, 0.6], l: [0.05, 0.55] } },
  { id: "m09", name: "Moreno", hint: "Cabelo liso", shirt: NAVY },
  { id: "jf1", name: "Jovem", hint: "Menina loira", shirt: NAVY },
  { id: "jf2", name: "Jovem", hint: "Menina ruiva", shirt: NAVY },
  { id: "jm1", name: "Jovem", hint: "Menino", shirt: NAVY },
  { id: "jm2", name: "Jovem", hint: "Menino negro", shirt: NAVY },
];
export const INTERPRETER_IDS = INTERPRETERS.map((i) => i.id);
export const interpreterById = (id: string) => INTERPRETERS.find((i) => i.id === id) ?? INTERPRETERS[0];

/** Onde o logo fica, em cm a partir do centro do peito (x para a direita de quem olha). */
export const LOGO_SPOTS = {
  auto: null,
  centro: { x: 0, y: 0 },
  esquerdo: { x: 8, y: 1 },
  direito: { x: -8, y: 1 },
  baixo: { x: 0, y: -9 },
} as const;
export type LogoSpot = keyof typeof LOGO_SPOTS | "custom";
export const LOGO_SPOT_OPTIONS: { value: Exclude<LogoSpot, "custom">; label: string }[] = [
  { value: "auto", label: "Automática" },
  { value: "centro", label: "Centro do peito" },
  { value: "esquerdo", label: "Peito esquerdo" },
  { value: "direito", label: "Peito direito" },
  { value: "baixo", label: "Barriga" },
];
export const LOGO_X = [-14, 14] as const;
export const LOGO_Y = [-18, 10] as const;

export const BACKGROUNDS = {
  lavanda: { label: "Lavanda", css: "radial-gradient(120% 90% at 50% 18%,#FFFFFF 0%,#E9E2FF 55%,#D9CEFB 100%)" },
  branco: { label: "Branco", css: "#FFFFFF" },
  cinza: { label: "Cinza", css: "linear-gradient(180deg,#F4F5F8,#DDE0E8)" },
  menta: { label: "Menta", css: "radial-gradient(120% 90% at 50% 18%,#E3F4EC 0%,#C6E7D7 100%)" },
  marinho: { label: "Marinho", css: "radial-gradient(120% 90% at 50% 18%,#3A4A86 0%,#1F2A5A 60%,#141B3D 100%)" },
  grafite: { label: "Grafite", css: "radial-gradient(120% 90% at 50% 18%,#4A4D57 0%,#2A2C33 100%)" },
} as const;
export type BackgroundId = keyof typeof BACKGROUNDS;

export const SHIRT_COLORS = ["#1F2A5A", "#5B2BD9", "#0F766E", "#4D7C0F", "#B91C1C", "#111827", "#E5E7EB"];

/** Visual do intérprete Luumu (painel → Libras). */
export interface InterpreterLook {
  interpreter: string;
  /** "" = cor original da roupa */
  shirtColor: string;
  /** "brand" = logo do painel (Aparência); "custom" = logoUrl; "none" = sem logo */
  logo: "none" | "brand" | "custom";
  logoUrl: string;
  logoSpot: LogoSpot;
  /** usado quando logoSpot = "custom" */
  logoX: number;
  logoY: number;
  /** 0–100 */
  logoOpacity: number;
  /** 7–20 cm */
  logoSize: number;
  /** id de BACKGROUNDS ou cor #RRGGBB */
  background: string;
}

export const DEFAULT_LOOK: InterpreterLook = {
  interpreter: "f11",
  shirtColor: "#1F2A5A",
  logo: "brand",
  logoUrl: "",
  logoSpot: "auto",
  logoX: 0,
  logoY: 0,
  logoOpacity: 100,
  logoSize: 13,
  background: "lavanda",
};

const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null);
const num = (v: unknown, [a, b]: readonly [number, number], d: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(b, Math.max(a, Math.round(n))) : d;
};
const safeUrl = (v: unknown) => {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (/^https:\/\/[^\s"'<>()]+$/i.test(s) && s.length <= 500) return s;
  if (/^\/[\w\-./]+$/.test(s) && s.length <= 200) return s;
  return "";
};

export function normalizeLook(input: unknown): InterpreterLook {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_LOOK;
  const spot = typeof o.logoSpot === "string" && (o.logoSpot === "custom" || o.logoSpot in LOGO_SPOTS) ? (o.logoSpot as LogoSpot) : d.logoSpot;
  const bg = typeof o.background === "string" && o.background in BACKGROUNDS ? o.background : hex(o.background) ?? d.background;
  return {
    interpreter: typeof o.interpreter === "string" && INTERPRETER_IDS.includes(o.interpreter) ? o.interpreter : d.interpreter,
    shirtColor: o.shirtColor === "" ? "" : hex(o.shirtColor) ?? d.shirtColor,
    logo: o.logo === "none" || o.logo === "custom" || o.logo === "brand" ? o.logo : d.logo,
    logoUrl: safeUrl(o.logoUrl),
    logoSpot: spot,
    logoX: num(o.logoX, LOGO_X, d.logoX),
    logoY: num(o.logoY, LOGO_Y, d.logoY),
    logoOpacity: num(o.logoOpacity, [0, 100], d.logoOpacity),
    logoSize: num(o.logoSize, [7, 20], d.logoSize),
    background: bg,
  };
}

/** Posição do logo em cm (null = automática do personagem). */
export function logoPosition(look: Pick<InterpreterLook, "logoSpot" | "logoX" | "logoY">): { x: number; y: number } | null {
  if (look.logoSpot === "custom") return { x: look.logoX, y: look.logoY };
  const p = LOGO_SPOTS[look.logoSpot];
  return p ? { ...p } : null;
}

/** CSS do fundo (preset ou cor). */
export function backgroundCss(bg: string): string {
  return bg in BACKGROUNDS ? BACKGROUNDS[bg as BackgroundId].css : hex(bg) ?? BACKGROUNDS.lavanda.css;
}
