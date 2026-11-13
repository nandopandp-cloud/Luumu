/*
  Intérprete Luumu (beta) — public/sdk-libras3d.js, carregado pelo widget de acessibilidade só
  quando o projeto usa este intérprete e o estudante abre Libras.

  Fluxo: o estudante clica num texto (ou seleciona um trecho) → a tradução oficial do VLibras
  devolve as glosas ("OI TUDO_BEM [INTERROGAÇÃO]") → cada glosa vira um sinal do dicionário do
  VLibras, convertido pela Luumu (/api/v1/accessibility/libras/sinal/:glosa, em cache na borda);
  sem sinal, a palavra é soletrada com o alfabeto manual → o personagem 3D (Three.js) toca a
  sequência com o movimento real do VLibras transferido para o seu esqueleto (rig.ts).

  Janela própria num Shadow DOM, presa ao canto oposto ao dos botões da Luumu.
*/
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { SignClip } from "../../../lib/accessibility/libras3d/sign";
import { backgroundCss, interpreterById, logoPosition, type InterpreterLook } from "../../../lib/accessibility/libras3d/interpreters";
import { alignFacing, buildSource, Retargeter, sampleClip, type SkeletonNode, type Source } from "./rig";
import { locateChest, paintShirt, prepareShirt, type Shirt } from "./shirt";

export const TRANSLATE_URL = "https://traducao2.vlibras.gov.br/translate";

export interface Libras3dOptions {
  /** origem da Luumu (assets em /a11y/libras3d/) */
  origin: string;
  /** base da API (…/api/v1) */
  api: string;
  look: InterpreterLook;
  /** URL já resolvida do logo da camisa ("" = sem logo) */
  logoUrl: string;
  /** lado da tela onde a janela fica */
  side: "left" | "right";
  /** prévia do painel: toca as boas-vindas e não escuta a página */
  preview?: boolean;
  onClose(): void;
  onError(message: string): void;
}
export interface Libras3dPlayer {
  update(look: InterpreterLook, logoUrl: string, side: "left" | "right"): void;
  translate(text: string): Promise<void>;
  destroy(): void;
}

type Base = { v: number; esqueleto: SkeletonNode; clips: Record<string, SignClip> };
type Item = { clip: SignClip; label: string; hold?: number; blend?: number; loop?: boolean; letter?: boolean };

const FACE_MAP: Record<string, [string, number][]> = {
  Sorriso: [["MouthSmileLeft", 0.75], ["MouthSmileRight", 0.75], ["CheekSquintLeft", 0.35], ["CheekSquintRight", 0.35], ["EyeSquintLeft", 0.15], ["EyeSquintRight", 0.15]],
  LevantaSobrancelhaDir: [["BrowOuterUpRight", 1], ["BrowInnerUp", 0.45]],
  LevantaSobrancelhaEsq: [["BrowOuterUpLeft", 1], ["BrowInnerUp", 0.45]],
  BaixaSobrancelhaDir: [["BrowDownRight", 1]],
  BaixaSobrancelhaEsq: [["BrowDownLeft", 1]],
  FranzirSobrancelha: [["BrowDownLeft", 0.8], ["BrowDownRight", 0.8], ["BrowInnerUp", 0.25]],
  SobrancelhaDirAberta: [["BrowOuterUpRight", 0.6], ["BrowInnerUp", 0.4]],
  SobrancelhaEsqAberta: [["BrowOuterUpLeft", 0.6], ["BrowInnerUp", 0.4]],
  Bico: [["MouthPucker", 1]],
  InflaBochecha: [["CheekPuff", 1]],
  BochechaInfladaDir: [["CheekPuff", 0.5]],
  BochechaInfladaEsq: [["CheekPuff", 0.5]],
  BochechaContraida: [["CheekSquintLeft", 0.6], ["CheekSquintRight", 0.6]],
  LabioSuperior: [["MouthUpperUpLeft", 0.8], ["MouthUpperUpRight", 0.8]],
  BaixaCantoBoca: [["MouthFrownLeft", 0.8], ["MouthFrownRight", 0.8]],
  baixaBocaCanto_dir: [["MouthFrownRight", 0.8]],
  correcaoAbreBoca: [["JawOpen", 0.6]],
};

const CSS = `
:host{all:initial}
*{box-sizing:border-box}
.win{position:fixed;bottom:20px;z-index:2147483646;width:min(320px,calc(100vw - 24px));height:min(440px,calc(100vh - 40px));display:flex;flex-direction:column;
  border-radius:22px;overflow:hidden;background:#fff;font:500 13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1B1838;
  box-shadow:0 26px 60px -20px rgba(30,20,80,.55),0 0 0 1px rgba(30,27,75,.08)}
.win.left{left:20px}.win.right{right:20px}
.win.big{width:min(560px,calc(100vw - 24px));height:min(720px,calc(100vh - 40px))}
header{display:flex;align-items:center;gap:6px;padding:8px 8px 8px 12px;background:var(--brand,#5B2BD9);color:#fff}
header b{flex:1;font-weight:800;font-size:14px}
header b small{font-weight:600;font-size:10px;opacity:.8;margin-left:6px;padding:2px 6px;border-radius:99px;background:rgba(255,255,255,.18);letter-spacing:.04em}
button{font:inherit;cursor:pointer;border:0}
header button{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;display:grid;place-items:center;font-weight:800;font-size:11px}
header button:hover{background:rgba(255,255,255,.28)}
button:focus-visible{outline:3px solid #fff;outline-offset:1px}
.stage{position:relative;flex:1;min-height:0;background:var(--bg)}
canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.cap{position:absolute;left:10px;right:10px;bottom:10px;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.9);box-shadow:0 6px 20px -12px rgba(40,20,90,.5);font-size:12.5px}
.cap b{display:block;font-size:14px;font-weight:800;min-height:1.3em}
.cap span{color:#6B6884}
.bar{height:3px;margin-top:6px;border-radius:3px;background:rgba(91,43,217,.15);overflow:hidden}
.bar i{display:block;height:100%;background:var(--brand,#5B2BD9);transform-origin:left;transform:scaleX(0)}
.load{position:absolute;inset:0;display:grid;place-items:center;color:#4A4766;font-weight:600}
.load::before{content:"";width:18px;height:18px;margin-right:8px;border-radius:50%;border:2.5px solid rgba(91,43,217,.25);border-top-color:var(--brand,#5B2BD9);animation:s .8s linear infinite;display:inline-block;vertical-align:-4px}
@keyframes s{to{transform:rotate(360deg)}}
.hl{position:fixed;z-index:2147483645;pointer-events:none;border:2px solid var(--brand,#5B2BD9);border-radius:6px;background:rgba(91,43,217,.08);display:none}
@media (prefers-reduced-motion:reduce){.load::before{animation:none}}
`;

const IC = {
  pause: '<svg width="14" height="14" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
  expand: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

const SPEEDS = [1, 0.75, 0.5];
const BLOCK = "p,h1,h2,h3,h4,h5,h6,li,td,th,dt,dd,figcaption,blockquote,caption,label,summary,span,strong,em,small,b,i";
const INTERACTIVE = "a,button,input,select,textarea,[role=button],[contenteditable=''],[contenteditable=true]";

function create(opts: Libras3dOptions): Libras3dPlayer {
  let look = opts.look, logoUrl = opts.logoUrl, side = opts.side;
  let destroyed = false;

  /* ------------------------------------------------------------ janela */
  const host = document.createElement("div");
  host.setAttribute("data-luumu-ui", "a11y-libras3d");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>${CSS}</style>
    <div class="win" role="dialog" aria-label="Intérprete de Libras">
      <header><b>Libras<small>BETA</small></b>
        <button type="button" data-a="pause" aria-label="Pausar" title="Pausar">${IC.pause}</button>
        <button type="button" data-a="speed" aria-label="Velocidade 1x" title="Velocidade">1×</button>
        <button type="button" data-a="expand" aria-label="Expandir" title="Expandir">${IC.expand}</button>
        <button type="button" data-a="close" aria-label="Fechar Libras" title="Fechar">${IC.close}</button>
      </header>
      <div class="stage"><div class="load">Carregando o intérprete…</div>
        <div class="cap" aria-live="polite"><b></b><span></span><div class="bar"><i></i></div></div>
      </div>
    </div><div class="hl"></div>`;
  const $ = <T extends Element>(s: string) => shadow.querySelector(s) as T;
  const win = $<HTMLElement>(".win"), stageEl = $<HTMLElement>(".stage"), loadEl = $<HTMLElement>(".load");
  const capWord = $<HTMLElement>(".cap b"), capHint = $<HTMLElement>(".cap span"), barEl = $<HTMLElement>(".bar i"), hl = $<HTMLElement>(".hl");
  document.body.appendChild(host);
  const hint = opts.preview ? "Prévia: na página, o estudante clica num texto para traduzir." : "Clique num texto da página (ou selecione um trecho) para traduzir.";
  capHint.textContent = hint;
  function applyChrome() {
    win.classList.toggle("left", side === "left");
    win.classList.toggle("right", side === "right");
    stageEl.style.setProperty("--bg", backgroundCss(look.background));
  }
  applyChrome();

  /* ------------------------------------------------------------ cena */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  stageEl.insertBefore(renderer.domElement, stageEl.firstChild);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight(0xfff4ea, 2.3); key.position.set(-90, 210, 240); scene.add(key);
  const fill = new THREE.DirectionalLight(0xdcd3ff, 0.9); fill.position.set(160, 120, 160); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xb9a2ff, 1.6); rim.position.set(40, 220, -260); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b5a9e, 0.35));
  const camera = new THREE.PerspectiveCamera(22, 1, 1, 5000);

  let base: Base | null = null;
  let src: Source | null = null;
  const holder = new THREE.Group();
  let current: { id: string; root: THREE.Object3D; meshes: THREE.Mesh[]; rt: Retargeter; shirt: Shirt | null; head: THREE.Vector3; top: number; bottom: number } | null = null;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const assets = `${opts.origin}/a11y/libras3d/`;

  function fit() {
    if (!current) return;
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    let dist = (current.top - current.bottom) / 2 / Math.tan(vfov / 2);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    dist = Math.max(dist, 80 / 2 / Math.tan(hfov / 2));
    const cy = (current.top + current.bottom) / 2;
    camera.position.set(current.head.x, cy + 4, current.head.z + dist);
    camera.lookAt(current.head.x, cy, current.head.z);
  }
  const ro = new ResizeObserver(fit);
  ro.observe(stageEl);

  async function loadBase() {
    if (base) return base;
    const r = await fetch(`${assets}base.json`);
    if (!r.ok) throw new Error("base");
    base = (await r.json()) as Base;
    src = buildSource(base.esqueleto);
    holder.add(src.root);
    return base;
  }

  async function loadInterpreter(id: string) {
    const r = await fetch(`${assets}modelos/${id}.glb`);
    if (!r.ok) throw new Error("modelo");
    const gltf = await loader.parseAsync(await r.arrayBuffer(), "");
    const root = gltf.scene;
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      if (m.morphTargetDictionary && Object.keys(m.morphTargetDictionary).length) meshes.push(m);
      m.material = ([] as THREE.Material[]).concat(m.material).map((mat) => {
        const std = mat as THREE.MeshStandardMaterial;
        if (std.transparent || std.alphaTest > 0) {
          std.alphaToCoverage = true; std.alphaTest = 0.4; std.transparent = false; std.side = THREE.DoubleSide;
        } else if (!std.roughnessMap) std.roughness = /head/i.test(std.name) ? 0.52 : 0.68;
        std.envMapIntensity = 0.9;
        if (!/head/i.test(std.name) || std.alphaTest > 0) return std;
        // pele com um leve "veludo", que suaviza o contorno do rosto
        const p = new THREE.MeshPhysicalMaterial();
        THREE.MeshStandardMaterial.prototype.copy.call(p, std);
        p.sheen = 0.35; p.sheenRoughness = 0.7; p.sheenColor = new THREE.Color(0xffd6c4);
        return p;
      }) as unknown as THREE.Material;
      const arr = m.material as unknown as THREE.Material[];
      if (arr.length === 1) m.material = arr[0];
    });
    src!.rest();
    alignFacing(holder, src!, root);
    const rt = new Retargeter(src!, root);
    if (current) {
      scene.remove(current.root);
      disposeTree(current.root);
    }
    scene.add(root);
    root.updateMatrixWorld(true);
    const W = (n: string) => root.getObjectByName(n)!.getWorldPosition(new THREE.Vector3());
    const head = W("Bip01_Head"), pelvis = W("Bip01_Pelvis");
    current = { id, root, meshes, rt, shirt: null, head, top: head.y + 34, bottom: pelvis.y - 4 };
    pose();
    rt.apply();
    current.shirt = prepareShirt(root, interpreterById(id).shirt);
    await paint();
    fit();
  }

  let logoImg: { url: string; img: HTMLImageElement | null } = { url: "", img: null };
  async function paint() {
    if (!current || !current.shirt) return;
    if (logoImg.url !== logoUrl) {
      logoImg = { url: logoUrl, img: null };
      if (logoUrl) {
        logoImg.img = await new Promise<HTMLImageElement | null>((ok) => {
          const im = new Image();
          im.crossOrigin = "anonymous"; // sem CORS no servidor do logo, a camisa fica sem logo
          im.onload = () => ok(im);
          im.onerror = () => ok(null);
          im.src = /^https?:/.test(logoUrl) ? logoUrl : opts.origin + logoUrl;
        });
      }
    }
    const pos = logoPosition(look);
    locateChest(current.shirt, pos);
    paintShirt(current.shirt, {
      color: look.shirtColor,
      logo: look.logo === "none" ? null : logoImg.img,
      opacity: look.logoOpacity / 100,
      sizeCm: look.logoSize,
      custom: look.logoSpot !== "auto",
    });
  }

  /* ------------------------------------------------------------ sequência de sinais */
  const st = { cur: null as Item | null, t: 0, queue: [] as Item[], from: null as [THREE.Bone, THREE.Quaternion, THREE.Vector3][] | null, fromFace: {} as Record<string, number>, blendT: 1, blendDur: 0.35, paused: false, speed: 1, face: {} as Record<string, number> };
  const idle = (): Item => ({ clip: base!.clips["[RELAXAR]"], label: "", loop: true });
  function snapshot() { return Object.values(src!.bones).map((b) => [b, b.quaternion.clone(), b.position.clone()] as [THREE.Bone, THREE.Quaternion, THREE.Vector3]); }
  function go(item: Item, blend = 0.35) {
    st.from = src ? snapshot() : null;
    st.fromFace = { ...st.face };
    st.blendT = 0;
    st.blendDur = blend;
    st.cur = item;
    st.t = 0;
    capWord.textContent = item.label;
    if (!item.loop) capHint.textContent = "";
  }
  function play(items: Item[]) {
    if (!items.length) return;
    st.queue = items.slice(1);
    go(items[0], items[0].blend ?? 0.35);
  }
  function tick(dt: number) {
    if (st.paused || !st.cur) return;
    const d = dt * st.speed;
    st.t += d;
    if (st.blendT < 1) st.blendT = Math.min(1, st.blendT + d / st.blendDur);
    const len = st.cur.hold ?? st.cur.clip.duration;
    if (st.t >= len) {
      if (st.cur.loop) st.t %= len || 1;
      else if (st.queue.length) { const n = st.queue.shift()!; go(n, n.blend ?? 0.35); }
      else { go(idle(), 0.5); capHint.textContent = hint; }
    }
    barEl.style.transform = `scaleX(${st.cur.loop ? 0 : Math.min(1, st.t / len)})`;
  }
  function pose() {
    if (!src || !st.cur) return;
    const raw = sampleClip(src, st.cur.clip, Math.min(st.t, st.cur.clip.duration));
    let face: Record<string, number> = {};
    for (const k in raw) for (const [m, w] of FACE_MAP[k] || []) face[m] = Math.min(1, (face[m] || 0) + raw[k] * w);
    if (st.blendT < 1 && st.from) {
      const w = st.blendT * st.blendT * (3 - 2 * st.blendT);
      for (const [b, q, p] of st.from) { b.quaternion.copy(q.clone().slerp(b.quaternion, w)); b.position.copy(p.clone().lerp(b.position, w)); }
      const keys = new Set([...Object.keys(face), ...Object.keys(st.fromFace)]);
      const mixed: Record<string, number> = {};
      for (const k of keys) mixed[k] = (st.fromFace[k] || 0) * (1 - w) + (face[k] || 0) * w;
      face = mixed;
    }
    st.face = face;
    holder.updateMatrixWorld(true);
  }
  const blink = { next: 2.5, t: -1 };
  function blinkValue(dt: number) {
    if (st.paused) return blink.t >= 0 ? 1 : 0;
    if (blink.t < 0) { blink.next -= dt; if (blink.next <= 0) blink.t = 0; return 0; }
    blink.t += dt;
    const v = blink.t < 0.08 ? blink.t / 0.08 : blink.t < 0.2 ? 1 - (blink.t - 0.08) / 0.12 : 0;
    if (blink.t >= 0.2) { blink.t = -1; blink.next = 2.2 + Math.random() * 3.5; }
    return v;
  }

  let raf = 0, last = performance.now();
  function loop(now: number) {
    if (destroyed) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    tick(dt);
    if (current && src) {
      pose();
      current.rt.apply();
      const bl = blinkValue(dt);
      for (const mesh of current.meshes) {
        const dict = mesh.morphTargetDictionary!, inf = mesh.morphTargetInfluences!;
        inf.fill(0);
        for (const k in st.face) if (dict[k] !== undefined) inf[dict[k]] = st.face[k];
        for (const k of ["EyeBlinkLeft", "EyeBlinkRight"]) if (dict[k] !== undefined) inf[dict[k]] = Math.max(inf[dict[k]], bl);
      }
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------ tradução */
  const signCache = new Map<string, Promise<SignClip | null>>();
  function sign(gloss: string): Promise<SignClip | null> {
    let p = signCache.get(gloss);
    if (!p) {
      p = fetch(`${opts.api}/accessibility/libras/sinal/${encodeURIComponent(gloss)}`)
        .then((r) => (r.ok ? (r.json() as Promise<SignClip & { missing?: boolean }>) : null))
        .then((s) => (s && !s.missing && s.rot ? s : null))
        .catch(() => null);
      signCache.set(gloss, p);
    }
    return p;
  }
  function spell(word: string): Item[] {
    const chars = [...word.toUpperCase().replace(/Ç/g, "\u0001").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\u0001/g, "Ç")];
    return chars
      .filter((ch) => base!.clips[ch])
      .map((ch) => ({ clip: base!.clips[ch], label: word, hold: ch === "Ç" ? 1.6 : /\d/.test(ch) ? 1 : 0.85, blend: 0.22, letter: true }));
  }
  let job = 0;
  async function translate(text: string) {
    const clean = text.replace(/\s+/g, " ").trim().slice(0, 500);
    if (!clean || !base) return;
    const my = ++job;
    capWord.textContent = "Traduzindo…";
    capHint.textContent = clean.length > 90 ? clean.slice(0, 90) + "…" : clean;
    let glosses: string[];
    try {
      const r = await fetch(TRANSLATE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: clean }) });
      if (!r.ok) throw new Error(String(r.status));
      glosses = (await r.text()).trim().split(/\s+/).filter(Boolean).slice(0, 80);
    } catch {
      if (my === job) { capWord.textContent = ""; capHint.textContent = "Não foi possível traduzir agora. Tente de novo."; }
      return;
    }
    if (my !== job) return;
    const lookups = glosses.map((g) => (base!.clips[g] ? Promise.resolve(base!.clips[g]) : /^\[.*\]$/.test(g) ? Promise.resolve(null) : sign(g)));
    const items: Item[] = [];
    let started = false;
    for (let i = 0; i < glosses.length; i++) {
      const g = glosses[i];
      const clip = await lookups[i];
      if (my !== job) return;
      const label = g.replace(/^\[|\]$/g, "").replace(/_/g, " ");
      const add = clip ? [{ clip, label }] : /^\[/.test(g) ? [] : spell(g.replace(/[^A-Za-zÀ-ÿÇç0-9]/g, ""));
      if (!started && add.length) {
        started = true;
        play(add);
      } else if (started) {
        st.queue.push(...add);
      } else items.push(...add);
    }
    if (!started && !items.length && my === job) { capWord.textContent = ""; capHint.textContent = hint; }
  }

  /* ------------------------------------------------------------ texto da página */
  const isOurs = (el: Element | null) => !!el && !!el.closest("[data-luumu-ui]");
  function textTarget(el: Element | null): HTMLElement | null {
    if (!el || isOurs(el) || el.closest(INTERACTIVE)) return null;
    let t = el.closest(BLOCK) as HTMLElement | null;
    if (!t) {
      const e = el as HTMLElement;
      t = e.innerText && e.innerText.trim().length <= 300 && e.children.length < 6 ? e : null;
    }
    return t && t.innerText.trim() ? t : null;
  }
  function onMove(e: MouseEvent) {
    const t = textTarget(e.target as Element);
    if (!t) { hl.style.display = "none"; return; }
    const r = t.getBoundingClientRect();
    Object.assign(hl.style, { display: "block", left: `${r.left - 4}px`, top: `${r.top - 3}px`, width: `${r.width + 8}px`, height: `${r.height + 6}px` });
  }
  function onClick(e: MouseEvent) {
    const sel = String(window.getSelection?.() || "").trim();
    if (sel.length > 1) return; // seleção é tratada no mouseup
    const t = textTarget(e.target as Element);
    if (t) void translate(t.innerText);
  }
  function onUp(e: MouseEvent) {
    if (isOurs(e.target as Element)) return;
    const sel = String(window.getSelection?.() || "").trim();
    if (sel.length > 1) void translate(sel);
  }
  if (!opts.preview) {
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("mouseup", onUp, true);
  }

  /* ------------------------------------------------------------ botões */
  shadow.addEventListener("click", (e) => {
    const b = (e.target as Element).closest("button[data-a]") as HTMLButtonElement | null;
    if (!b) return;
    const a = b.dataset.a;
    if (a === "close") return opts.onClose();
    if (a === "pause") {
      st.paused = !st.paused;
      b.innerHTML = st.paused ? IC.play : IC.pause;
      b.setAttribute("aria-label", st.paused ? "Continuar" : "Pausar");
      b.title = st.paused ? "Continuar" : "Pausar";
    }
    if (a === "speed") {
      st.speed = SPEEDS[(SPEEDS.indexOf(st.speed) + 1) % SPEEDS.length];
      b.textContent = `${String(st.speed).replace(".", ",")}×`;
      b.setAttribute("aria-label", `Velocidade ${st.speed}x`);
    }
    if (a === "expand") {
      const big = win.classList.toggle("big");
      b.setAttribute("aria-label", big ? "Reduzir" : "Expandir");
    }
  });

  /* ------------------------------------------------------------ início */
  (async () => {
    try {
      await loadBase();
      if (destroyed) return;
      go(idle(), 0.01);
      await loadInterpreter(look.interpreter);
      if (destroyed) return;
      loadEl.remove();
      raf = requestAnimationFrame(loop);
      // boas-vindas do player do VLibras na primeira abertura
      const w = base!.clips["[WLCM]BOAS_VINDAS_INI"];
      if (w) play([{ clip: w, label: "Olá!" }]);
    } catch {
      if (!destroyed) opts.onError("Não foi possível carregar o intérprete de Libras.");
    }
  })();

  function disposeTree(o: THREE.Object3D) {
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mat of ([] as THREE.Material[]).concat(m.material)) {
        for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
        mat.dispose();
      }
    });
  }

  return {
    update(next, nextLogo, nextSide) {
      const changed = next.interpreter !== look.interpreter;
      look = next; logoUrl = nextLogo; side = nextSide;
      applyChrome();
      if (!base) return;
      if (changed) void loadInterpreter(next.interpreter).then(() => loadEl.remove()).catch(() => opts.onError("Não foi possível carregar o intérprete de Libras."));
      else void paint();
    },
    translate,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mouseup", onUp, true);
      if (current) disposeTree(current.root);
      pmrem.dispose();
      renderer.dispose();
      host.remove();
    },
  };
}

(window as unknown as { __luumuLibras3d?: { create: typeof create } }).__luumuLibras3d = { create };
