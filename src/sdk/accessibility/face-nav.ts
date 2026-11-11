/*
  Navegação por rosto: a câmera vira o mouse.

   - mover: o nariz é o ponteiro. A posição de repouso é calibrada nos primeiros quadros e o
     movimento é amplificado (ninguém precisa girar muito a cabeça) e suavizado.
   - clicar: parar sobre um elemento clicável por PAUSA_MS, ou abrir a boca.
   - rolar: levar o cursor às bordas de cima ou de baixo.

  O rastreamento usa o FaceLandmarker do MediaPipe, baixado SÓ quando o estudante aceita usar
  a câmera (nada pesa para quem não usa). A imagem é processada no navegador: nenhum quadro
  sai do dispositivo, e a câmera é desligada ao parar, ao fechar a aba ou ao desativar.
*/
import { icon } from "./icons";

const VISION_VERSION = "0.10.14";
const VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const DWELL_MS = 1200;
const COOLDOWN_MS = 900;
const GAIN_X = 4.2;
const GAIN_Y = 5.4;
const SMOOTH = 0.28;
const EDGE = 72;
const JAW_OPEN = 0.42;
const CLICKABLE = "a[href],button,input:not([type=hidden]),select,textarea,summary,label,[role=button],[role=link],[role=tab],[role=menuitem],[role=switch],[role=checkbox],[tabindex]:not([tabindex='-1'])";

type Landmark = { x: number; y: number };
type Vision = {
  FilesetResolver: { forVisionTasks(url: string): Promise<unknown> };
  FaceLandmarker: {
    createFromOptions(fs: unknown, o: object): Promise<{
      detectForVideo(v: HTMLVideoElement, t: number): { faceLandmarks: Landmark[][]; faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[] };
      close(): void;
    }>;
  };
};

// import() de URL dinâmica fica fora do bundle (o esbuild não tenta resolver)
const importModule = (url: string): Promise<unknown> => import(/* @vite-ignore */ url);

export interface FaceNav {
  readonly active: boolean;
  openIntro(): void;
  stop(): void;
  setSide(side: "left" | "right"): void;
  destroy(): void;
}

export function createFaceNav(
  root: HTMLElement,
  opts: { side: "left" | "right"; toast: (m: string) => void; onChange: (active: boolean) => void; trapFocus: (el: HTMLElement) => () => void }
): FaceNav {
  let side = opts.side;
  let active = false;
  let starting = false;
  let stream: MediaStream | null = null;
  let landmarker: Awaited<ReturnType<Vision["FaceLandmarker"]["createFromOptions"]>> | null = null;
  let raf = 0;
  let intro: HTMLElement | null = null;
  let releaseTrap: (() => void) | null = null;
  let cam: HTMLElement | null = null;
  let cursor: HTMLElement | null = null;
  let video: HTMLVideoElement | null = null;

  let center: Landmark | null = null;
  let calib: Landmark[] = [];
  let x = innerWidth / 2;
  let y = innerHeight / 2;
  let dwellEl: Element | null = null;
  let dwellStart = 0;
  let lastClick = 0;
  let jawFrames = 0;

  function closeIntro() {
    releaseTrap?.();
    releaseTrap = null;
    intro?.remove();
    intro = null;
  }

  function openIntro() {
    if (intro) return;
    intro = document.createElement("div");
    intro.className = "mwrap";
    intro.innerHTML = `
<div class="modal" role="dialog" aria-modal="true" aria-labelledby="fn-t">
  <button type="button" class="x" data-f="close" aria-label="Fechar">${icon("close", 22)}</button>
  <div class="m-icon">${icon("face", 54, 1.8)}</div>
  <h2 class="m-title" id="fn-t">Navegue usando o rosto</h2>
  <p class="m-text">Use a câmera para controlar o cursor com movimentos da cabeça, sem precisar do mouse.</p>
  <div class="steps">
    <div class="step"><i>${icon("move", 20)}</i>Mova a cabeça devagar para levar o cursor até onde quiser.</div>
    <div class="step"><i>${icon("click", 20)}</i>Para clicar, pare sobre o botão por um instante ou abra a boca.</div>
    <div class="step"><i>${icon("updown", 20)}</i>Leve o cursor até a borda de cima ou de baixo para rolar a página.</div>
  </div>
  <p class="priv">${icon("shield", 20)}<span>A imagem da câmera é processada só no seu dispositivo e não é gravada nem enviada.</span></p>
  <div class="m-actions">
    <button type="button" class="btn ghost" data-f="close">Agora não</button>
    <button type="button" class="btn primary" data-f="start">${icon("camera", 20)}<span>Permitir câmera e começar</span></button>
  </div>
</div>`;
    intro.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t === intro) return closeIntro();
      const a = (t.closest("[data-f]") as HTMLElement | null)?.dataset.f;
      if (a === "close") closeIntro();
      if (a === "start") void start();
    });
    intro.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeIntro();
    });
    root.appendChild(intro);
    releaseTrap = opts.trapFocus(intro.querySelector(".modal") as HTMLElement);
  }

  function setStarting(on: boolean) {
    starting = on;
    const b = intro?.querySelector('[data-f="start"]') as HTMLButtonElement | null;
    if (b) {
      b.disabled = on;
      b.innerHTML = on ? `<i class="spin"></i><span>Preparando a câmera…</span>` : `${icon("camera", 20)}<span>Permitir câmera e começar</span>`;
    }
  }

  async function start() {
    if (starting || active) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      opts.toast("Este navegador não permite usar a câmera aqui.");
      return;
    }
    setStarting(true);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch {
      setStarting(false);
      opts.toast("Sem permissão para usar a câmera.");
      return;
    }
    try {
      const vision = (await importModule(VISION_URL)) as Vision;
      const files = await vision.FilesetResolver.forVisionTasks(WASM_URL);
      landmarker = await vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      });
    } catch {
      stopStream();
      setStarting(false);
      opts.toast("Não foi possível carregar o rastreamento do rosto.");
      return;
    }
    setStarting(false);
    closeIntro();
    mountUi();
    active = true;
    opts.onChange(true);
    opts.toast("Navegação por rosto ativada");
    loop();
  }

  function mountUi() {
    cam = document.createElement("div");
    cam.className = `fn-cam${side === "left" ? " left" : ""}`;
    cam.setAttribute("aria-label", "Câmera da navegação por rosto");
    cam.innerHTML = `<video muted playsinline autoplay></video>
<div class="fn-bar"><span><i class="dot"></i>Rosto</span><button type="button" data-f="recal">Centralizar</button><button type="button" data-f="stop">Parar</button></div>`;
    cam.addEventListener("click", (e) => {
      const a = ((e.target as Element).closest("[data-f]") as HTMLElement | null)?.dataset.f;
      if (a === "stop") stop();
      if (a === "recal") {
        center = null;
        calib = [];
      }
    });
    video = cam.querySelector("video");
    if (video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    }
    cursor = document.createElement("div");
    cursor.className = "fn-cursor";
    root.appendChild(cam);
    root.appendChild(cursor);
  }

  function targetAt(px: number, py: number): Element | null {
    const host = root.getRootNode() as ShadowRoot;
    // dentro do widget (botões do próprio painel) ou na página
    const own = host.elementFromPoint?.(px, py);
    const pageEl = document.elementFromPoint(px, py);
    const el = own && own !== cursor && root.contains(own) ? own : pageEl;
    return (el?.closest?.(CLICKABLE) as Element | null) ?? null;
  }

  function click(el: Element | null) {
    const now = Date.now();
    if (!el || now - lastClick < COOLDOWN_MS) return;
    lastClick = now;
    cursor?.classList.add("click");
    setTimeout(() => cursor?.classList.remove("click"), 160);
    (el as HTMLElement).focus?.();
    (el as HTMLElement).click?.();
    dwellEl = null;
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!landmarker || !video || video.readyState < 2) return;
    let res;
    try {
      res = landmarker.detectForVideo(video, performance.now());
    } catch {
      return;
    }
    const face = res.faceLandmarks?.[0];
    if (!face) return;
    const nose = face[1];
    if (!center) {
      calib.push(nose);
      if (calib.length < 12) return;
      center = { x: calib.reduce((s, p) => s + p.x, 0) / calib.length, y: calib.reduce((s, p) => s + p.y, 0) / calib.length };
    }
    // imagem espelhada: cabeça para a direita = nariz para a esquerda na imagem
    const tx = innerWidth / 2 + (center.x - nose.x) * innerWidth * GAIN_X;
    const ty = innerHeight / 2 + (nose.y - center.y) * innerHeight * GAIN_Y;
    x += (Math.min(innerWidth - 2, Math.max(2, tx)) - x) * SMOOTH;
    y += (Math.min(innerHeight - 2, Math.max(2, ty)) - y) * SMOOTH;
    if (cursor) cursor.style.transform = `translate(${x}px,${y}px)`;

    // rolagem pelas bordas
    if (y < EDGE) window.scrollBy(0, -Math.ceil((EDGE - y) / 4));
    else if (y > innerHeight - EDGE) window.scrollBy(0, Math.ceil((y - (innerHeight - EDGE)) / 4));

    const el = targetAt(x, y);
    const now = Date.now();
    if (el !== dwellEl) {
      dwellEl = el;
      dwellStart = now;
    }
    const p = el && now - lastClick > COOLDOWN_MS ? Math.min(1, (now - dwellStart) / DWELL_MS) : 0;
    cursor?.style.setProperty("--p", String(p));
    if (el && p >= 1) click(el);

    // boca aberta = clique
    const jaw = res.faceBlendshapes?.[0]?.categories.find((c) => c.categoryName === "jawOpen")?.score ?? 0;
    jawFrames = jaw > JAW_OPEN ? jawFrames + 1 : 0;
    if (jawFrames === 3) click(el ?? document.elementFromPoint(x, y));
  }

  function stopStream() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  function stop() {
    cancelAnimationFrame(raf);
    stopStream();
    try {
      landmarker?.close();
    } catch {}
    landmarker = null;
    cam?.remove();
    cursor?.remove();
    cam = cursor = null;
    video = null;
    center = null;
    calib = [];
    if (active) {
      active = false;
      opts.onChange(false);
      opts.toast("Navegação por rosto desativada");
    }
  }

  window.addEventListener("pagehide", stop);

  return {
    get active() {
      return active;
    },
    openIntro,
    stop,
    setSide(s) {
      side = s;
      cam?.classList.toggle("left", s === "left");
    },
    destroy() {
      closeIntro();
      stop();
      window.removeEventListener("pagehide", stop);
    },
  };
}
