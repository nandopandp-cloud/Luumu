/**
 * Sinal de Libras no formato que o intérprete 3D toca: rotação de cada osso do esqueleto de
 * controle do VLibras amostrada a 30 quadros por segundo, posições que mudam e expressões.
 *
 * Módulo PURO (servidor, SDK e testes). Converte o AnimationClip lido por ./unity.ts com a mesma
 * conta do player do VLibras (curvas de Hermite, degraus quando a tangente é infinita).
 */
import { readAnimationClip } from "./unity";

export const SIGN_FPS = 30;

export interface SignClip {
  /** duração em segundos */
  duration: number;
  fps: number;
  /** quatérnio [x, y, z, w] por quadro (espaço do Unity); um só valor = osso parado */
  rot: Record<string, number[][]>;
  /** posição [x, y, z] por quadro, só dos ossos que se deslocam */
  pos: Record<string, number[][]>;
  /** expressões do VLibras (0–100) por quadro, só as usadas */
  face: Record<string, number[]>;
}

type Key<T> = { time: number; value: T; inSlope: T; outSlope: T };
type V4 = { x: number; y: number; z: number; w: number };
type V3 = { x: number; y: number; z: number };
type Curve<T> = { curve: { m_Curve: Key<T>[] }; path: string; attribute?: string };

function hermite1(a: Key<number>, b: Key<number>, t: number): number {
  const dt = b.time - a.time;
  if (dt <= 0) return b.value;
  const h = (t - a.time) / dt;
  const m0 = a.outSlope, m1 = b.inSlope;
  if (!Number.isFinite(m0) || !Number.isFinite(m1)) return h < 1 ? a.value : b.value; // degrau
  const h00 = 2 * h ** 3 - 3 * h ** 2 + 1, h10 = h ** 3 - 2 * h ** 2 + h, h01 = -2 * h ** 3 + 3 * h ** 2, h11 = h ** 3 - h ** 2;
  return h00 * a.value + h10 * dt * m0 + h01 * b.value + h11 * dt * m1;
}

function evaluate<T extends object | number>(keys: Key<T>[], t: number, comps: string[] | null): T {
  if (t <= keys[0].time) return keys[0].value;
  const last = keys[keys.length - 1];
  if (t >= last.time) return last.value;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (a.time <= t && t <= b.time) {
      if (!comps) return hermite1(a as Key<number>, b as Key<number>, t) as T;
      const out: Record<string, number> = {};
      for (const c of comps) {
        const pick = (k: Key<T>) => ({ time: k.time, value: (k.value as Record<string, number>)[c], inSlope: (k.inSlope as Record<string, number>)[c], outSlope: (k.outSlope as Record<string, number>)[c] });
        out[c] = hermite1(pick(a), pick(b), t);
      }
      return out as T;
    }
  }
  return last.value;
}

const r5 = (x: number) => Math.round(x * 1e5) / 1e5;
const r3 = (x: number) => Math.round(x * 1e3) / 1e3;
const bone = (path: string) => path.split("/").pop() || path;

/** AnimationClip (árvore de tipos lida do pacote) → SignClip. */
export function clipToSign(clip: Record<string, unknown>): SignClip {
  const rc = (clip.m_RotationCurves as Curve<V4>[]) || [];
  const pc = (clip.m_PositionCurves as Curve<V3>[]) || [];
  const fc = (clip.m_FloatCurves as Curve<number>[]) || [];
  const ends = rc.filter((c) => c.curve.m_Curve.length).map((c) => c.curve.m_Curve[c.curve.m_Curve.length - 1].time);
  const duration = ends.length ? Math.max(...ends) : 0;
  const n = Math.max(2, Math.round(duration * SIGN_FPS) + 1);
  const times = Array.from({ length: n }, (_, i) => i / SIGN_FPS);

  const rot: SignClip["rot"] = {};
  for (const c of rc) {
    const keys = c.curve.m_Curve;
    if (!keys.length) continue;
    const distinct = new Set(keys.map((k) => [k.value.x, k.value.y, k.value.z, k.value.w].map((x) => x.toFixed(4)).join()));
    if (distinct.size <= 1) {
      const v = keys[0].value;
      rot[bone(c.path)] = [[v.x, v.y, v.z, v.w]];
      continue;
    }
    rot[bone(c.path)] = times.map((t) => {
      const v = evaluate(keys, t, ["x", "y", "z", "w"]);
      const L = Math.hypot(v.x, v.y, v.z, v.w) || 1;
      return [r5(v.x / L), r5(v.y / L), r5(v.z / L), r5(v.w / L)];
    });
  }

  const pos: SignClip["pos"] = {};
  for (const c of pc) {
    const keys = c.curve.m_Curve;
    if (!keys.length) continue;
    const distinct = new Set(keys.map((k) => [k.value.x, k.value.y, k.value.z].map((x) => x.toFixed(4)).join()));
    if (distinct.size <= 1) continue;
    pos[bone(c.path)] = times.map((t) => {
      const v = evaluate(keys, t, ["x", "y", "z"]);
      return [r5(v.x), r5(v.y), r5(v.z)];
    });
  }

  const face: SignClip["face"] = {};
  for (const c of fc) {
    if (!c.attribute || !c.attribute.startsWith("blendShape.") || !c.curve.m_Curve.length) continue;
    const seq = times.map((t) => r3(evaluate(c.curve.m_Curve, t, null)));
    const mx = Math.max(...seq), mn = Math.min(...seq);
    if (mx - mn > 0.5 || mx > 0.5) face[c.attribute.slice("blendShape.".length)] = seq;
  }

  return { duration: Math.round(duration * 1e4) / 1e4, fps: SIGN_FPS, rot, pos, face };
}

/** Pacote do dicionário do VLibras → SignClip. */
export function signFromBundle(bundle: Uint8Array): SignClip {
  return clipToSign(readAnimationClip(bundle));
}

/** Glosa do VLibras válida para o dicionário (letras, números, _ e -). */
export function safeGloss(v: unknown): string {
  if (typeof v !== "string") return "";
  const g = v.trim().toUpperCase().normalize("NFC");
  return /^[A-ZÀ-ÜÇ0-9_\-&]{1,48}$/.test(g) ? g : "";
}
