/*
  Camisa do intérprete Luumu: cor (mantendo luz e dobras do tecido) e logo no peito.

  A textura do corpo é um atlas (pele, roupa e calça na mesma imagem). A roupa de cima é separada
  pela faixa de cor do personagem (interpreters.ts → shirt). O peito na textura é achado com três
  raios contra o tórax 3D (centro, direita e baixo): dá posição, escala e orientação do logo em
  qualquer personagem. Validado no protótipo (/prototipos/libras).
*/
import * as THREE from "three";
import type { ShirtRule } from "../../../lib/accessibility/libras3d/interpreters";

const SIZE = 2048;

function hsl(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  const s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (mx !== mn) {
    h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}
const inRange = (v: number, [a, b]: [number, number]) => (a <= b ? v >= a && v <= b : v >= a || v <= b);
export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export interface Shirt {
  root: THREE.Object3D;
  mats: THREE.MeshStandardMaterial[];
  ctx: CanvasRenderingContext2D;
  base: ImageData;
  index: Uint32Array;
  ratio: Float32Array;
  mask: Uint8Array;
  texture: THREE.CanvasTexture;
  medianLum: number;
  rule: ShirtRule;
  frame: { c: THREE.Vector2; ax: THREE.Vector2; ay: THREE.Vector2 } | null;
}

export function prepareShirt(root: THREE.Object3D, rule: ShirtRule): Shirt | null {
  const mats = new Set<THREE.MeshStandardMaterial>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of ([] as THREE.Material[]).concat(m.material)) if (/body/i.test(mat.name) && (mat as THREE.MeshStandardMaterial).map) mats.add(mat as THREE.MeshStandardMaterial);
  });
  if (!mats.size) return null;
  const first = [...mats][0];
  const img = first.map!.image as CanvasImageSource;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const base = ctx.getImageData(0, 0, SIZE, SIZE);
  const idx: number[] = [], lum: number[] = [];
  const d = base.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const [h, s, l] = hsl(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
    if (inRange(h, rule.h) && s >= rule.s[0] && s <= rule.s[1] && l >= rule.l[0] && l <= rule.l[1]) {
      idx.push(p);
      lum.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    }
  }
  if (idx.length < 500) return null;
  const sorted = Float32Array.from(lum).sort();
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  // a luz da cena clareia: compensa para a cor sair fiel
  const ratio = Float32Array.from(lum, (v) => Math.min(1.9, Math.max(0.25, v / median)) * 0.74);
  const mask = new Uint8Array(SIZE * SIZE);
  const index = Uint32Array.from(idx);
  for (const p of index) mask[p] = 1;
  const texture = new THREE.CanvasTexture(canvas);
  const orig = first.map!;
  texture.flipY = orig.flipY;
  texture.colorSpace = orig.colorSpace;
  texture.wrapS = orig.wrapS;
  texture.wrapT = orig.wrapT;
  texture.channel = orig.channel;
  texture.anisotropy = 4;
  return { root, mats: [...mats], ctx, base, index, ratio, mask, texture, medianLum: median, rule, frame: null };
}

/** Ponto neutro do peito (centro, abaixo da base do pescoço), no mundo. */
export function chestBase(root: THREE.Object3D): THREE.Vector3 {
  const W = (n: string) => root.getObjectByName(n)!.getWorldPosition(new THREE.Vector3());
  const neck = W("Bip01_Neck"), spine2 = W("Bip01_Spine2");
  return new THREE.Vector3(neck.x, neck.y - Math.max(7, (neck.y - spine2.y) * 0.42), neck.z);
}

/** Centro e eixos do logo na textura. pos em cm (null = automática do personagem). */
export function locateChest(shirt: Shirt, pos: { x: number; y: number } | null) {
  const root = shirt.root;
  root.updateMatrixWorld(true);
  root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.update(); });
  const off = shirt.rule.logo || {};
  const center = chestBase(root).add(new THREE.Vector3(pos ? pos.x : off.dx || 0, pos ? pos.y : off.dy || 0, 0));
  const ray = new THREE.Raycaster();
  const targets: THREE.Object3D[] = [];
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && shirt.mats.includes(m.material as THREE.MeshStandardMaterial)) targets.push(m); });
  const uvAt = (p: THREE.Vector3) => {
    ray.set(new THREE.Vector3(p.x, p.y, p.z + 300), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObjects(targets, false)[0];
    return hit && hit.uv ? hit.uv.clone() : null;
  };
  for (const step of [5, 3, 2]) {
    const c = uvAt(center), r = uvAt(center.clone().add(new THREE.Vector3(step, 0, 0))), b = uvAt(center.clone().add(new THREE.Vector3(0, -step, 0)));
    if (c && r && b) {
      const px = (uv: THREE.Vector2) => new THREE.Vector2(uv.x * SIZE, (shirt.texture.flipY ? 1 - uv.y : uv.y) * SIZE);
      const C = px(c), R = px(r), B = px(b);
      shirt.frame = { c: C, ax: R.clone().sub(C).divideScalar(step), ay: B.clone().sub(C).divideScalar(step) };
      return shirt.frame;
    }
  }
  shirt.frame = null;
  return null;
}

export interface ShirtPaint {
  color: string;
  logo: HTMLImageElement | null;
  opacity: number;
  sizeCm: number;
  custom: boolean;
}

export function paintShirt(shirt: Shirt, st: ShirtPaint) {
  const { ctx, base, index, ratio, mask } = shirt;
  const out = new ImageData(new Uint8ClampedArray(base.data), SIZE, SIZE);
  const d = out.data;
  const rgb = hexToRgb(st.color);
  if (rgb) {
    for (let k = 0; k < index.length; k++) {
      const i = index[k] * 4, f = ratio[k];
      d[i] = rgb[0] * f; d[i + 1] = rgb[1] * f; d[i + 2] = rgb[2] * f;
    }
  }
  if (st.logo && shirt.frame && st.opacity > 0) {
    const { c, ax, ay } = shirt.frame;
    const w = st.logo.naturalWidth || st.logo.width || 512, h = st.logo.naturalHeight || st.logo.height || 512;
    const cm = st.sizeCm * (!st.custom && shirt.rule.logo?.scale ? shirt.rule.logo.scale : 1);
    const sw = w >= h ? cm : (cm * w) / h, sh = w >= h ? (cm * h) / w : cm;
    const layer = document.createElement("canvas");
    layer.width = layer.height = SIZE;
    const lc = layer.getContext("2d")!;
    lc.setTransform((ax.x * sw) / w, (ax.y * sw) / w, (ay.x * sh) / h, (ay.y * sh) / h, c.x - (ax.x * sw) / 2 - (ay.x * sh) / 2, c.y - (ax.y * sw) / 2 - (ay.y * sh) / 2);
    try {
      lc.drawImage(st.logo, 0, 0, w, h);
      const span = Math.ceil((Math.abs(ax.x) + Math.abs(ay.x) + Math.abs(ax.y) + Math.abs(ay.y)) * cm) + 4;
      const x0 = Math.max(0, Math.floor(c.x - span)), y0 = Math.max(0, Math.floor(c.y - span));
      const x1 = Math.min(SIZE, Math.ceil(c.x + span)), y1 = Math.min(SIZE, Math.ceil(c.y + span));
      if (x1 > x0 && y1 > y0) {
        const L = lc.getImageData(x0, y0, x1 - x0, y1 - y0).data; // lança se a imagem não liberar CORS
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const p = y * SIZE + x;
          if (!mask[p]) continue;
          const li = ((y - y0) * (x1 - x0) + (x - x0)) * 4;
          const a = (L[li + 3] / 255) * st.opacity;
          if (a <= 0) continue;
          const i = p * 4;
          const bl = 0.2126 * base.data[i] + 0.7152 * base.data[i + 1] + 0.0722 * base.data[i + 2];
          const shade = Math.min(1.25, Math.max(0.55, Math.sqrt(bl / (shirt.medianLum || bl || 1))));
          d[i] = d[i] * (1 - a) + L[li] * shade * a;
          d[i + 1] = d[i + 1] * (1 - a) + L[li + 1] * shade * a;
          d[i + 2] = d[i + 2] * (1 - a) + L[li + 2] * shade * a;
        }
      }
    } catch {
      // logo de outro domínio sem CORS: a camisa fica sem logo
    }
  }
  ctx.putImageData(out, 0, 0);
  shirt.texture.needsUpdate = true;
  for (const m of shirt.mats) if (m.map !== shirt.texture) { m.map = shirt.texture; m.needsUpdate = true; }
}
