"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImageOff, Loader2, Monitor, Smartphone, Tablet } from "lucide-react";
import { Mascot } from "@/components/ui/Mascot";
import { reachAt, reachCurve, splitPath, type HeatmapDevice, type HeatmapMode, type Section } from "@/lib/heatmaps/core";
import { boxOf, detectSections, docSize, drawHeat, drawScroll, makeLocator, sanitizeSnapshot, type HeatPoint } from "@/lib/heatmaps/draw";
import { relativeTime } from "@/lib/search/core";
import type { HeatmapReport } from "@/lib/db/heatmaps";

const FRAME_H = 470;
const OVERLAY_ID = "__luumu_hm";

interface Snapshot {
  html: string;
  device: HeatmapDevice;
  width: number;
  height: number;
  viewportH: number;
  capturedAt: string;
}

const DEVICE_ICON = { desktop: Monitor, tablet: Tablet, mobile: Smartphone } as const;
const DEVICE_NAME = { desktop: "Desktop", tablet: "Tablet", mobile: "Celular" } as const;

export interface MapStats {
  /** cliques que não acharam o elemento na cópia (a página mudou) */
  unplaced: number;
  sections: Section[];
}

/**
 * A página do cliente (cópia sem scripts) com o mapa do modo escolhido por cima. As camadas
 * são desenhadas DENTRO do documento do iframe, então rolam junto com a página.
 */
export function PageMap({
  mode,
  page,
  device,
  report,
  highlight,
  onStats,
}: {
  mode: HeatmapMode;
  page: { host: string; path: string };
  device: HeatmapDevice | null;
  report: HeatmapReport;
  highlight: string | null;
  onStats: (s: MapStats) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [snap, setSnap] = useState<Snapshot | "loading" | "missing">("loading");
  const [srcDoc, setSrcDoc] = useState("");
  const [width, setWidth] = useState(0);
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams({ host: page.host, path: page.path, ...(device ? { device } : {}) });
    fetch(`/api/heatmaps/snapshot?${q}`)
      .then(async (r) => (r.ok ? ((await r.json()) as Snapshot) : null))
      .then((s) => {
        if (!alive) return;
        if (!s) return setSnap("missing");
        setSrcDoc(sanitizeSnapshot(s.html));
        setSnap(s);
      })
      .catch(() => alive && setSnap("missing"));
    return () => {
      alive = false;
    };
  }, [page.host, page.path, device]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const s = typeof snap === "object" ? snap : null;
  const k = s && width ? width / s.width : 0;
  const frameH = k ? Math.round(FRAME_H / k) : 0;
  const curve = useMemo(() => reachCurve(report.scrollHist), [report.scrollHist]);

  const draw = useCallback(() => {
    const doc = frame.current?.contentDocument;
    if (!doc?.body) return;
    doc.getElementById(OVERLAY_ID)?.remove();
    const { w, h } = docSize(doc);
    const root = doc.createElement("div");
    root.id = OVERLAY_ID;
    root.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;pointer-events:none;z-index:2147483646;font-family:Inter,system-ui,sans-serif;`;
    doc.documentElement.appendChild(root);
    const locate = makeLocator(doc);
    const scale = Math.min(0.6, 5000 / h);
    const canvas = doc.createElement("canvas");
    canvas.width = Math.ceil(w * scale);
    canvas.height = Math.ceil(h * scale);
    canvas.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;`;
    root.appendChild(canvas);

    let unplaced = 0;
    if (mode === "clicks") {
      const pts: HeatPoint[] = [];
      for (const b of report.clickBins) {
        const el = locate(b.s);
        const box = el && boxOf(el);
        if (!box) {
          unplaced += b.n;
          continue;
        }
        pts.push({ x: box.x + ((b.x * 50 + 25) / 1000) * box.w, y: box.y + ((b.y * 50 + 25) / 1000) * box.h, w: b.n });
      }
      drawHeat(canvas, pts, { radius: 26, scale });
    } else if (mode === "moves") {
      const pts: HeatPoint[] = [];
      for (const b of report.moveBins) {
        const box = (() => {
          const el = locate(b.s);
          return el && boxOf(el);
        })();
        if (!box) continue;
        pts.push({ x: box.x + ((b.gx + 0.5) / 10) * box.w, y: box.y + ((b.gy + 0.5) / 10) * box.h, w: b.n });
      }
      drawHeat(canvas, pts, { radius: 44, scale, opacity: 0.7 });
      drawPaths(doc, root, report, locate, w, h);
    } else {
      drawScroll(canvas, curve);
      drawDepthMarkers(doc, root, h, report);
    }

    if (highlight) {
      const el = locate(highlight);
      const box = el && boxOf(el);
      if (box) {
        const ring = doc.createElement("div");
        ring.style.cssText = `position:absolute;left:${box.x - 6}px;top:${box.y - 6}px;width:${box.w + 12}px;height:${box.h + 12}px;border:3px solid #6B2BD9;border-radius:12px;box-shadow:0 0 0 6px rgba(107,43,217,.22),0 10px 30px rgba(107,43,217,.35);`;
        root.appendChild(ring);
        const win = doc.defaultView;
        win?.scrollTo({ top: Math.max(0, box.y - (frameH || 600) / 3), behavior: "smooth" });
      }
    }

    onStats({ unplaced, sections: detectSections(doc) });
  }, [mode, report, curve, highlight, onStats, frameH]);

  // carregou a cópia: bloqueia navegação/formulários e redesenha quando o layout assentar
  const onLoad = useCallback(() => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const stop = (e: Event) => e.preventDefault();
    doc.addEventListener("click", stop, true);
    doc.addEventListener("submit", stop, true);
    doc.addEventListener("auxclick", stop, true);
    setLoaded((n) => n + 1);
    // imagens e fontes mudam a altura da página: redesenha uma vez quando tudo carregar
    const imgs = Array.from(doc.images).filter((i) => !i.complete);
    let pending = imgs.length;
    const done = () => --pending === 0 && setLoaded((n) => n + 1);
    imgs.forEach((i) => {
      i.addEventListener("load", done, { once: true });
      i.addEventListener("error", done, { once: true });
    });
    doc.fonts?.ready.then(() => setLoaded((n) => n + 1)).catch(() => {});
  }, []);

  useEffect(() => {
    if (loaded) draw();
  }, [loaded, draw]);

  // dica ao passar o mouse: no scroll, quantos chegaram até ali
  useEffect(() => {
    const doc = frame.current?.contentDocument;
    if (!doc || !loaded || mode !== "scroll") return;
    const tip = doc.createElement("div");
    tip.style.cssText =
      "position:absolute;left:0;z-index:2147483647;pointer-events:none;display:none;padding:6px 10px;border-radius:999px;background:#140b2e;color:#fff;font:600 13px Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);white-space:nowrap;";
    doc.documentElement.appendChild(tip);
    const { h } = docSize(doc);
    const move = (e: MouseEvent) => {
      const y = e.pageY;
      tip.style.display = "block";
      tip.style.top = `${y - 34}px`;
      tip.style.left = `${e.pageX + 14}px`;
      tip.textContent = `${Math.round(reachAt(curve, (y / h) * 100) * 100)}% dos visitantes chegaram até aqui`;
    };
    const leave = () => (tip.style.display = "none");
    doc.addEventListener("mousemove", move);
    doc.addEventListener("mouseleave", leave);
    return () => {
      doc.removeEventListener("mousemove", move);
      doc.removeEventListener("mouseleave", leave);
      tip.remove();
    };
  }, [loaded, mode, curve]);

  const DevIcon = s ? DEVICE_ICON[s.device] : Monitor;

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={wrap}
        className="relative overflow-hidden rounded-2xl border border-line bg-bg-sunken"
        style={{ height: FRAME_H }}
      >
        {snap === "loading" && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-3 text-sm text-fg-mut">
              <Loader2 className="size-6 animate-spin text-accent" /> Montando o mapa da página…
            </div>
          </div>
        )}
        {snap === "missing" && <MissingSnapshot mode={mode} />}
        {s && k > 0 && (
          <iframe
            ref={frame}
            title="Cópia da página com o mapa de calor"
            sandbox="allow-same-origin"
            srcDoc={srcDoc}
            onLoad={onLoad}
            className="absolute left-0 top-0 origin-top-left border-0 bg-white"
            style={{ width: s.width, height: frameH, transform: `scale(${k})` }}
          />
        )}
        {mode === "clicks" && s && <Legend />}
      </div>
      {s && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-fg-mut">
          <span className="inline-flex items-center gap-1.5">
            <Camera className="size-3.5" /> Página capturada {relativeTime(s.capturedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <DevIcon className="size-3.5" /> {DEVICE_NAME[s.device]} · {s.width}px
          </span>
          <span>Role dentro do mapa para ver a página inteira.</span>
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-[rgba(20,11,46,.78)] px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur">
      Menos
      <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(90deg,#283cff,#00c8ff,#28dc5a,#ffdc00,#ff2828)" }} />
      Mais
    </div>
  );
}

function MissingSnapshot({ mode }: { mode: HeatmapMode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <div className="relative">
        <Mascot name="Trabalhando" size={104} />
        <span className="absolute -right-2 bottom-1 grid size-8 place-items-center rounded-full bg-bg-elev text-fg-mut shadow">
          <ImageOff className="size-4" />
        </span>
      </div>
      <p className="mt-3 font-display font-bold">Ainda não temos a imagem desta página</p>
      <p className="mt-1 max-w-sm text-sm text-fg-mut">
        Ela é capturada automaticamente numa das próximas visitas. Enquanto isso, os números {mode === "scroll" ? "de rolagem" : "dos elementos"} ao lado já são reais.
      </p>
    </div>
  );
}

/* ---------- caminhos (modo movimento) ---------- */

const SVG_NS = "http://www.w3.org/2000/svg";

function drawPaths(doc: Document, root: HTMLElement, report: HeatmapReport, locate: (s: string) => Element | null, w: number, h: number) {
  const top = report.paths.slice(0, 5);
  if (!top.length) return;
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  svg.setAttribute("style", "position:absolute;left:0;top:0;overflow:visible;");
  const defs = doc.createElementNS(SVG_NS, "defs");
  defs.innerHTML =
    '<linearGradient id="lhg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#22D3EE"/></linearGradient><filter id="lhglow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  svg.appendChild(defs);
  root.appendChild(svg);

  const max = top[0].n;
  const order: string[] = [];
  const center = (sel: string) => {
    const el = locate(sel);
    const b = el && boxOf(el);
    return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null;
  };
  for (const p of top) {
    const steps = splitPath(p.key);
    const pts = steps.map(center);
    for (let i = 0; i < steps.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const lift = Math.min(160, Math.abs(dx) * 0.35 + 40);
      const path = doc.createElementNS(SVG_NS, "path");
      path.setAttribute("d", `M${a.x},${a.y} C${a.x + dx * 0.25},${a.y - lift} ${b.x - dx * 0.25},${b.y - lift} ${b.x},${b.y}`);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "url(#lhg)");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-width", String(2 + 3 * (p.n / max)));
      path.setAttribute("opacity", String(0.55 + 0.45 * (p.n / max)));
      path.setAttribute("filter", "url(#lhglow)");
      svg.appendChild(path);
    }
    for (const s of steps) if (!order.includes(s) && center(s)) order.push(s);
  }
  // marcadores numerados nos elementos dos caminhos (até 6)
  order.slice(0, 6).forEach((sel, i) => {
    const c = center(sel);
    if (!c) return;
    const m = doc.createElement("div");
    m.textContent = String(i + 1);
    m.style.cssText = `position:absolute;left:${c.x - 15}px;top:${c.y - 15}px;width:30px;height:30px;border-radius:50%;background:#111024;color:#fff;font:800 14px Inter,system-ui,sans-serif;display:grid;place-items:center;border:3px solid #fff;box-shadow:0 6px 16px rgba(0,0,0,.35);`;
    root.appendChild(m);
  });
}

/* ---------- marcadores de profundidade (modo scroll) ---------- */

function drawDepthMarkers(doc: Document, root: HTMLElement, h: number, report: HeatmapReport) {
  for (const p of [0, 25, 50, 75, 100]) {
    const y = Math.min(h - 26, (p / 100) * h);
    if (p > 0 && p < 100) {
      const line = doc.createElement("div");
      line.style.cssText = `position:absolute;left:0;right:0;top:${y}px;border-top:2px dashed rgba(17,16,36,.45);`;
      root.appendChild(line);
    }
    const pill = doc.createElement("div");
    pill.textContent = `${p}%`;
    pill.style.cssText = `position:absolute;left:10px;top:${p === 0 ? 10 : y - 13}px;padding:4px 10px;border-radius:999px;background:#111024;color:#fff;font:700 13px Inter,system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3);`;
    root.appendChild(pill);
  }
  // dobra média: o que aparece sem rolar
  if (report.avgViewportH && report.avgDocH) {
    const y = (report.avgViewportH / report.avgDocH) * h;
    if (y > 40 && y < h - 40) {
      const fold = doc.createElement("div");
      fold.style.cssText = `position:absolute;left:0;right:0;top:${y}px;border-top:2px solid rgba(255,255,255,.9);`;
      const tag = doc.createElement("span");
      tag.textContent = "Dobra média: o que aparece sem rolar";
      tag.style.cssText =
        "position:absolute;right:12px;top:-14px;padding:3px 10px;border-radius:999px;background:#fff;color:#111024;font:600 12px Inter,system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.2);";
      fold.appendChild(tag);
      root.appendChild(fold);
    }
  }
}
