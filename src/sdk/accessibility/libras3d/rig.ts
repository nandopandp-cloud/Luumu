/*
  Esqueleto de controle do VLibras (Armature.001) em Three.js e transferência do movimento para o
  esqueleto Biped dos personagens (Bip01_*), osso a osso, em espaço de mundo:

    alvo_mundo(t) = [ fonte_mundo(t) · fonte_repouso⁻¹ ] · alvo_repouso_alinhado

  alvo_repouso_alinhado = repouso do alvo girado para apontar cada osso como o repouso da fonte.
  Nas mãos o alinhamento usa duas direções (dedos e palma). Validado no protótipo (/prototipos/libras).
  Unity é mão esquerda e o Three.js mão direita: espelha X na posição e Y/Z no quatérnio.
*/
import * as THREE from "three";
import type { SignClip } from "../../../lib/accessibility/libras3d/sign";

export type SkeletonNode = { name: string; p: number[]; q: number[]; s: number[]; c: SkeletonNode[] };
export const u2tPos = (p: number[]) => new THREE.Vector3(-p[0], p[1], p[2]);
export const u2tQuat = (q: number[]) => new THREE.Quaternion(q[0], -q[1], -q[2], q[3]);

export interface Source {
  root: THREE.Bone;
  bones: Record<string, THREE.Bone>;
  rest(): void;
}

export function buildSource(tree: SkeletonNode): Source {
  const bones: Record<string, THREE.Bone> = {};
  const restQ = new Map<THREE.Bone, THREE.Quaternion>();
  const restP = new Map<THREE.Bone, THREE.Vector3>();
  const make = (n: SkeletonNode): THREE.Bone => {
    const b = new THREE.Bone();
    b.name = n.name;
    b.position.copy(u2tPos(n.p));
    b.quaternion.copy(u2tQuat(n.q));
    b.scale.set(n.s[0], n.s[1], n.s[2]);
    bones[n.name] = b;
    restQ.set(b, b.quaternion.clone());
    restP.set(b, b.position.clone());
    n.c.forEach((c) => b.add(make(c)));
    return b;
  };
  const root = make(tree);
  return {
    root,
    bones,
    rest() {
      for (const [b, q] of restQ) b.quaternion.copy(q);
      for (const [b, p] of restP) b.position.copy(p);
    },
  };
}

const frames = (clip: SignClip) => Math.max(2, Math.round(clip.duration * clip.fps) + 1);

/** Aplica o quadro do tempo t (s) do sinal no esqueleto de controle; devolve as expressões (0–1). */
export function sampleClip(src: Source, clip: SignClip, t: number): Record<string, number> {
  const n = frames(clip);
  const f = Math.min(n - 1, Math.max(0, t * clip.fps));
  const i = Math.floor(f), a = f - i;
  for (const name in clip.rot) {
    const b = src.bones[name], seq = clip.rot[name];
    if (!b) continue;
    if (seq.length === 1) { b.quaternion.copy(u2tQuat(seq[0])); continue; }
    const j = Math.min(i, seq.length - 1), k = Math.min(i + 1, seq.length - 1);
    b.quaternion.copy(u2tQuat(seq[j]).slerp(u2tQuat(seq[k]), a));
  }
  for (const name in clip.pos) {
    const b = src.bones[name], seq = clip.pos[name];
    if (!b) continue;
    const j = Math.min(i, seq.length - 1), k = Math.min(i + 1, seq.length - 1);
    b.position.copy(u2tPos(seq[j]).lerp(u2tPos(seq[k]), a));
  }
  const face: Record<string, number> = {};
  for (const name in clip.face) {
    const seq = clip.face[name];
    const j = Math.min(i, seq.length - 1), k = Math.min(i + 1, seq.length - 1);
    face[name] = (seq[j] + (seq[k] - seq[j]) * a) / 100;
  }
  return face;
}

/* ---------------------------------------------------------------- transferência para o Biped */
function boneMap(): [string, string, string | null, string | null][] {
  const m: [string, string, string | null, string | null][] = [
    ["BnCol-01", "Bip01_Spine", null, null],
    ["BnCol-02", "Bip01_Spine1", null, null],
    ["BnCol-03", "Bip01_Spine2", null, null],
    ["BnPescoco", "Bip01_Neck", null, null],
    ["BnCabeca", "Bip01_Head", null, null],
  ];
  for (const s of ["L", "R"]) {
    m.push([`BnOmbro.${s}`, `Bip01_${s}_Clavicle`, `BnBraco.${s}`, `Bip01_${s}_UpperArm`]);
    m.push([`BnBraco.${s}`, `Bip01_${s}_UpperArm`, `BnAntBraco.${s}`, `Bip01_${s}_Forearm`]);
    m.push([`BnAntBraco.${s}`, `Bip01_${s}_Forearm`, `BnMao.${s}`, `Bip01_${s}_Hand`]);
    m.push([`BnMao.${s}`, `Bip01_${s}_Hand`, "HAND", "HAND"]);
    // [base, meio, ponta] na fonte → FingerN, FingerN1, FingerN2 no alvo (0 = polegar)
    const fingers: [string, string, string, number][] = [
      [`BnDedo.1.${s}.004`, `BnDedo.1.${s}.014`, `BnDedo.1.${s}.013`, 0],
      [`BnDedo.1.${s}.003`, `BnDedo.1.${s}.012`, `BnDedo.1.${s}.011`, 1],
      [`BnDedo.1.${s}.002`, `BnDedo.1.${s}.010`, `BnDedo.1.${s}.009`, 2],
      [`BnDedo.1.${s}.001`, `BnDedo.1.${s}.008`, `BnDedo.1.${s}.007`, 3],
      [`BnDedo.1.${s}`, `BnDedo.1.${s}.006`, `BnDedo.1.${s}.005`, 4],
    ];
    for (const [a, b, c, n] of fingers) {
      m.push([a, `Bip01_${s}_Finger${n}`, b, `Bip01_${s}_Finger${n}1`]);
      m.push([b, `Bip01_${s}_Finger${n}1`, c, `Bip01_${s}_Finger${n}2`]);
      m.push([c, `Bip01_${s}_Finger${n}2`, "SAME", "SAME"]);
    }
  }
  return m;
}

const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
const wq = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());
function frame(forward: THREE.Vector3, lateral: THREE.Vector3) {
  const x = forward.clone().normalize();
  const y = lateral.clone().sub(x.clone().multiplyScalar(lateral.dot(x))).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
function handFrame(get: (n: string) => THREE.Object3D, hand: string, middle: string, index: string, pinky: string) {
  const h = wp(get(hand));
  return frame(wp(get(middle)).sub(h), wp(get(index)).sub(wp(get(pinky))));
}

export class Retargeter {
  private pairs: { sb: THREE.Object3D; tb: THREE.Object3D; sRestInv: THREE.Quaternion; tAligned: THREE.Quaternion }[] = [];
  private tmp = new THREE.Quaternion();
  constructor(private src: Source, target: THREE.Object3D) {
    const S = (n: string) => src.bones[n] as THREE.Object3D;
    const T = (n: string) => target.getObjectByName(n) as THREE.Object3D;
    src.root.updateMatrixWorld(true);
    target.updateMatrixWorld(true);
    let last = new THREE.Quaternion();
    for (const [s, t, sc, tc] of boneMap()) {
      const sb = S(s), tb = T(t);
      if (!sb || !tb) continue;
      let align: THREE.Quaternion;
      if (sc === "HAND") {
        const side = s.endsWith("L") ? "L" : "R";
        const fs = handFrame(S, s, `BnDedo.1.${side}.002`, `BnDedo.1.${side}.003`, `BnDedo.1.${side}`);
        const ft = handFrame(T, t, `Bip01_${side}_Finger2`, `Bip01_${side}_Finger1`, `Bip01_${side}_Finger4`);
        align = fs.multiply(ft.invert());
      } else if (sc === "SAME") {
        align = last.clone();
      } else if (sc && tc) {
        align = new THREE.Quaternion().setFromUnitVectors(wp(T(tc)).sub(wp(tb)).normalize(), wp(S(sc)).sub(wp(sb)).normalize());
      } else {
        align = new THREE.Quaternion();
      }
      last = align;
      this.pairs.push({ sb, tb, sRestInv: wq(sb).invert(), tAligned: align.clone().multiply(wq(tb)) });
    }
  }
  apply() {
    this.src.root.updateMatrixWorld(true);
    for (const p of this.pairs) {
      const want = wq(p.sb).multiply(p.sRestInv).multiply(p.tAligned);
      const parent = p.tb.parent!;
      parent.updateWorldMatrix(true, false);
      parent.getWorldQuaternion(this.tmp);
      p.tb.quaternion.copy(this.tmp.invert().multiply(want));
      p.tb.updateMatrixWorld(true);
    }
  }
}

/** Gira o esqueleto do VLibras para olhar na mesma direção do personagem (frente = olhos − cabeça). */
export function alignFacing(holder: THREE.Object3D, src: Source, target: THREE.Object3D) {
  const fwd = (h: THREE.Object3D, l: THREE.Object3D, r: THREE.Object3D) => {
    const v = wp(l).add(wp(r)).multiplyScalar(0.5).sub(wp(h));
    v.y = 0;
    return v.normalize();
  };
  holder.quaternion.identity();
  holder.updateMatrixWorld(true);
  target.updateMatrixWorld(true);
  const ft = fwd(target.getObjectByName("Bip01_Head")!, target.getObjectByName("Bip01_LEye")!, target.getObjectByName("Bip01_REye")!);
  const fs = fwd(src.bones.BnCabeca, src.bones["BnOlho.L"], src.bones["BnOlho.R"]);
  holder.quaternion.setFromUnitVectors(fs, ft);
  holder.updateMatrixWorld(true);
}
