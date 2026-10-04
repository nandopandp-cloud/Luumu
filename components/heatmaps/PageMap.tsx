"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImageOff, Loader2, Monitor, Smartphone, Tablet } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Mascot } from "@/components/ui/Mascot";
import { cn } from "@/lib/utils";
import { reachAt, reachCurve, splitPath, type HeatmapDevice, type HeatmapMode, type Section } from "@/lib/heatmaps/core";
import { boxOf, detectSections, docSize, drawHeat, drawScroll, expandScrollers, freezeLayout, makeLocator, sanitizeSnapshot, settle, type Box, type HeatPoint } from "@/lib/heatmaps/draw";
import { relativeTime } from "@/lib/search/core";
import type { HeatmapReport } from "@/lib/db/heatmaps";

const FRAME_H = 470;

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
/** largura máxima de exibição do print por aparelho (px de tela) */
const DEVICE_MAX_W = { desktop: Infinity, tablet: 580, mobile: 340 } as const;

export interface MapStats {
  /** cliques que não acharam o elemento na cópia (a página mudou) */
  unplaced: number;
  sections: Section[];
}

/** O que é desenhado por cima do print, em coordenadas da PÁGINA (px da página original). */
interface Layer {
  heat: HeatPoint[];
  /** raio da mancha em px de TELA (não encolhe com a página) */
  radius: number;
  opacity: number;
  curves: { d: string; width: number; opacity: number }[];
  markers: { x: number; y: number; n: number }[];
  ring: Box | null;
}

/**
 * A página do cliente como um PRINT de página inteira, com o mapa do modo escolhido por cima.
 *
 * A cópia (sem scripts) é carregada num iframe na largura e altura de tela de quem visitou,
 * congelada (freezeLayout) e esticada até a altura total. A partir daí ela é só o "papel":
 * não reage a nada (sem hover, sem links) e quem rola é o quadro do painel. As camadas
 * (calor, faixas, caminhos, marcadores) ficam FORA do iframe, por cima dele, na resolução da
 * tela — textos e marcadores continuam legíveis mesmo com a página reduzida.
 */
export function PageMap({
  mode,
  page,
  device,
  devices = [],
  report,
  highlight,
  onStats,
}: {
  mode: HeatmapMode;
  page: { host: string; path: string };
  device: HeatmapDevice | null;
  /** com "Todos os dispositivos": os que têm visitas, para trocar o mapa */
  devices?: HeatmapDevice[];
  report: HeatmapReport;
  highlight: string | null;
  onStats: (s: MapStats) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const heatCanvas = useRef<HTMLCanvasElement>(null);
  const [snap, setSnap] = useState<Snapshot | "loading" | "missing">("loading");
  const [srcDoc, setSrcDoc] = useState("");
  const [width, setWidth] = useState(0);
  /** altura do print (px da página); null enquanto monta */
  const [printH, setPrintH] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [layer, setLayer] = useState<Layer | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

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
  /*
    Escala do print: desktop ocupa a largura do quadro; celular e tablet aparecem num aparelho
    centralizado, no máximo do tamanho real (esticar um celular até 850px deixava tudo
    gigante e ilegível). Nunca amplia além de 100%.
  */
  const framed = !!s && s.device !== "desktop";
  const dispW = s && width ? Math.min(width - (framed ? 48 : 0), DEVICE_MAX_W[s.device], s.width) : 0;
  const k = s && dispW > 0 ? dispW / s.width : 0;
  const curve = useMemo(() => reachCurve(report.scrollHist), [report.scrollHist]);

  // 1) carregou na altura de tela: espera imagens/fontes, congela e mede a página inteira
  const onLoad = useCallback(async () => {
    const doc = frame.current?.contentDocument;
    if (!doc?.body) return;
    await settle(doc);
    expandScrollers(doc);
    freezeLayout(doc);
    setPrintH(docSize(doc).h);
  }, []);

  // 2) esticou: confere a altura final (algo pode ter crescido) e libera o desenho
  useEffect(() => {
    if (printH === null || ready) return;
    const id = window.setTimeout(() => {
      const doc = frame.current?.contentDocument;
      if (!doc) return;
      const h = docSize(doc).h;
      if (h > printH + 2) setPrintH(h);
      else setReady(true);
    }, 60);
    return () => window.clearTimeout(id);
  }, [printH, ready]);

  // 3) com o print pronto, calcula as camadas a partir dos elementos da página
  useEffect(() => {
    if (!ready) return;
    const doc = frame.current?.contentDocument;
    if (!doc?.body) return;
    const locate = makeLocator(doc);
    const box = (sel: string) => {
      const el = locate(sel);
      return el ? boxOf(el) : null;
    };
    let unplaced = 0;
    const next: Layer = { heat: [], radius: 30, opacity: 0.85, curves: [], markers: [], ring: null };

    if (mode === "clicks") {
      for (const b of report.clickBins) {
        const bx = box(b.s);
        if (!bx) {
          unplaced += b.n;
          continue;
        }
        next.heat.push({ x: bx.x + ((b.x * 50 + 25) / 1000) * bx.w, y: bx.y + ((b.y * 50 + 25) / 1000) * bx.h, w: b.n });
      }
    } else if (mode === "moves") {
      next.radius = 42;
      next.opacity = 0.72;
      for (const b of report.moveBins) {
        const bx = box(b.s);
        if (bx) next.heat.push({ x: bx.x + ((b.gx + 0.5) / 10) * bx.w, y: bx.y + ((b.gy + 0.5) / 10) * bx.h, w: b.n });
      }
      Object.assign(next, pathsLayer(report, box));
    }
    if (highlight) next.ring = box(highlight);

    setLayer(next);
    onStats({ unplaced, sections: detectSections(doc) });
  }, [ready, mode, report, highlight, onStats]);

  // 4) pinta o canvas por cima do print, na resolução da tela
  useEffect(() => {
    const c = heatCanvas.current;
    if (!c || !layer || !s || !printH || !k) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // teto de pixels: páginas muito longas ficam com um canvas mais leve
    const scale = Math.min(k * dpr, 9000 / printH);
    c.width = Math.ceil(s.width * scale);
    c.height = Math.ceil(printH * scale);
    if (mode === "scroll") {
      c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
      drawScroll(c, curve);
    } else {
      drawHeat(c, layer.heat, { radius: layer.radius / k, scale, opacity: layer.opacity });
    }
  }, [layer, mode, curve, s, printH, k]);

  // destaque: leva o quadro até o elemento
  const ring = layer?.ring ?? null;
  useEffect(() => {
    if (ring && k) wrap.current?.scrollTo({ top: Math.max(0, ring.y * k - FRAME_H / 3), behavior: "smooth" });
  }, [ring, k]);

  // dica ao passar o mouse no modo scroll: quantos chegaram até aquela altura
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "scroll" || !ready || !k || !printH) return;
    const r = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - r.top) / k;
    setTip({
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      text: `${Math.round(reachAt(curve, (y / printH) * 100) * 100)}% dos visitantes chegaram até aqui`,
    });
  };

  const DevIcon = s ? DEVICE_ICON[s.device] : Monitor;
  const H = printH ?? (s?.viewportH || 800);
  const fold = mode === "scroll" && report.avgViewportH && report.avgDocH ? (report.avgViewportH / report.avgDocH) * H * k : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-bg-sunken" style={{ height: FRAME_H }}>
        <div
          ref={wrap}
          className={cn(
            "hm-print-scroll absolute inset-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]",
            framed && "bg-[radial-gradient(circle,rgba(107,43,217,.10)_1px,transparent_1px)] [background-size:18px_18px]"
          )}
        >
          {s && k > 0 && (
            <div className={cn(framed && "flex justify-center px-6 py-6")}>
            <div
              className={cn(
                "relative shrink-0 select-none",
                framed && "overflow-hidden rounded-[30px] bg-white ring-[7px] ring-[#17122b] shadow-[0_24px_60px_rgba(20,10,50,.35)]"
              )}
              style={{ width: dispW, height: H * k }}
              onMouseMove={onMove}
              onMouseLeave={() => setTip(null)}
            >
              {framed && s.device === "mobile" && (
                <span className="pointer-events-none absolute left-1/2 top-2 z-20 h-[18px] w-[86px] -translate-x-1/2 rounded-full bg-[#17122b]" aria-hidden />
              )}
              <iframe
                ref={frame}
                title="Print da página"
                sandbox="allow-same-origin"
                srcDoc={srcDoc}
                onLoad={onLoad}
                tabIndex={-1}
                aria-hidden
                className={cn(
                  "pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white transition-opacity duration-300",
                  ready ? "opacity-100" : "opacity-0"
                )}
                style={{ width: s.width, height: H, transform: `scale(${k})` }}
              />
              {ready && (
                <div className="pointer-events-none absolute inset-0" aria-hidden>
                  <canvas ref={heatCanvas} className="absolute left-0 top-0 h-full w-full" />
                  {layer && layer.curves.length > 0 && (
                    <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${s.width} ${H}`} preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="hm-path" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0" stopColor="#8B5CF6" />
                          <stop offset="1" stopColor="#22D3EE" />
                        </linearGradient>
                        <filter id="hm-glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="2.5" result="b" />
                          <feMerge>
                            <feMergeNode in="b" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      {layer.curves.map((c, i) => (
                        <path
                          key={i}
                          d={c.d}
                          fill="none"
                          stroke="url(#hm-path)"
                          strokeLinecap="round"
                          strokeWidth={c.width}
                          opacity={c.opacity}
                          vectorEffect="non-scaling-stroke"
                          filter="url(#hm-glow)"
                        />
                      ))}
                    </svg>
                  )}
                  {layer?.markers.map((m) => (
                    <span
                      key={m.n}
                      className="absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[2.5px] border-white bg-[#111024] text-[13px] font-extrabold text-white shadow-[0_6px_16px_rgba(0,0,0,.35)]"
                      style={{ left: m.x * k, top: m.y * k }}
                    >
                      {m.n}
                    </span>
                  ))}
                  {mode === "scroll" &&
                    [0, 25, 50, 75, 100].map((p) => {
                      const y = (p / 100) * H * k;
                      return (
                        <div key={p}>
                          {p > 0 && p < 100 && <div className="absolute inset-x-0 border-t-2 border-dashed border-[rgba(17,16,36,.45)]" style={{ top: y }} />}
                          <span
                            className="absolute left-2.5 rounded-full bg-[#111024] px-2.5 py-1 text-xs font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,.3)]"
                            style={{ top: p === 0 ? 10 : p === 100 ? y - 34 : y - 13 }}
                          >
                            {p}%
                          </span>
                        </div>
                      );
                    })}
                  {/* régua: % EXATO de visitantes que chegaram a cada 10% da página */}
                  {mode === "scroll" &&
                    [10, 20, 30, 40, 50, 60, 70, 80, 90].map((p) => (
                      <span
                        key={`r${p}`}
                        className="absolute right-2 -translate-y-1/2 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[#111024] shadow-sm"
                        style={{ top: (p / 100) * H * k }}
                        title={`${Math.round(reachAt(curve, p) * 100)}% dos visitantes chegaram a ${p}% da página`}
                      >
                        {Math.round(reachAt(curve, p) * 100)}%
                      </span>
                    ))}
                  {fold !== null && fold > 40 && fold < H * k - 40 && (
                    <div className="absolute inset-x-0 border-t-2 border-white/90" style={{ top: fold }}>
                      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#111024] shadow">
                        {framed ? "Dobra média" : "Dobra média: o que aparece sem rolar"}
                      </span>
                    </div>
                  )}
                  {ring && (
                    <div
                      className="absolute rounded-xl border-[3px] border-[#6B2BD9] shadow-[0_0_0_5px_rgba(107,43,217,.22),0_10px_30px_rgba(107,43,217,.35)] animate-[luumuFade_.2s_ease-out]"
                      style={{ left: ring.x * k - 5, top: ring.y * k - 5, width: ring.w * k + 10, height: ring.h * k + 10 }}
                    />
                  )}
                </div>
              )}
              {tip && (
                <div
                  className="pointer-events-none absolute z-10 whitespace-nowrap rounded-full bg-[#140b2e] px-3 py-1.5 text-[13px] font-semibold text-white shadow-lg"
                  style={{ left: Math.max(8, Math.min(tip.x + 14, dispW - 290)), top: tip.y - 36 }}
                >
                  {tip.text}
                </div>
              )}
            </div>
            </div>
          )}
        </div>
        {(snap === "loading" || (s && !ready)) && (
          <div className="absolute inset-0 grid place-items-center bg-bg-sunken">
            <div className="flex flex-col items-center gap-3 text-sm text-fg-mut">
              <Loader2 className="size-6 animate-spin text-accent" /> Montando o print da página…
            </div>
          </div>
        )}
        {snap === "missing" && <MissingSnapshot mode={mode} />}

      </div>
      {s && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-fg-mut">
          <span className="inline-flex items-center gap-1.5">
            <Camera className="size-3.5" /> Página capturada {relativeTime(s.capturedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <DevIcon className="size-3.5" /> {DEVICE_NAME[s.device]} · {s.width}px
          </span>
          <span>Role o quadro para ver a página inteira.</span>
          {ready && (mode === "scroll" ? <ScrollLegend /> : <Legend />)}
          {devices.length > 1 && <DeviceSwitch current={s.device} devices={devices} />}
        </div>
      )}
    </div>
  );
}

/** Curvas entre os elementos dos caminhos mais comuns + marcadores numerados (até 6). */
function pathsLayer(report: HeatmapReport, box: (sel: string) => Box | null): Pick<Layer, "curves" | "markers"> {
  const top = report.paths.slice(0, 5);
  const curves: Layer["curves"] = [];
  const order: string[] = [];
  if (!top.length) return { curves, markers: [] };
  const max = top[0].n;
  const center = (sel: string) => {
    const b = box(sel);
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
      // arco por cima, sem sair do topo da página
      const cy = Math.max(12, Math.min(a.y, b.y) - Math.min(160, Math.abs(dx) * 0.3 + 40));
      curves.push({
        d: `M${a.x},${a.y} C${a.x + dx * 0.25},${cy} ${b.x - dx * 0.25},${cy} ${b.x},${b.y}`,
        width: 2 + 3 * (p.n / max),
        opacity: 0.55 + 0.45 * (p.n / max),
      });
    }
    for (const sel of steps) if (!order.includes(sel) && center(sel)) order.push(sel);
  }
  const markers = order.slice(0, 6).map((sel, i) => ({ ...center(sel)!, n: i + 1 }));
  return { curves, markers };
}

/** Troca o dispositivo do mapa (vira o filtro de dispositivo da página). */
function DeviceSwitch({ current, devices }: { current: HeatmapDevice; devices: HeatmapDevice[] }) {
  const sp = useSearchParams();
  const pathname = usePathname();
  return (
    <span className="ml-auto inline-flex items-center gap-1.5">
      Mapa do
      {devices.map((d) => {
        const Icon = DEVICE_ICON[d];
        const q = new URLSearchParams(sp.toString());
        q.set("device", d);
        return (
          <Link
            key={d}
            href={`${pathname}?${q.toString()}`}
            scroll={false}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold transition",
              d === current ? "border-accent bg-surface-brand text-accent" : "border-line text-fg-mut hover:border-accent/50 hover:text-accent"
            )}
          >
            <Icon className="size-3" /> {DEVICE_NAME[d]}
          </Link>
        );
      })}
    </span>
  );
}

function ScrollLegend() {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold">
      Chegaram: todos
      <span className="h-1.5 w-16 rounded-full" style={{ background: "linear-gradient(90deg,#ff2828,#ffdc00,#28dc5a,#00c8ff,#283cff)" }} />
      quase ninguém
    </span>
  );
}

function Legend() {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold">
      Menos
      <span className="h-1.5 w-16 rounded-full" style={{ background: "linear-gradient(90deg,#283cff,#00c8ff,#28dc5a,#ffdc00,#ff2828)" }} />
      Mais
    </span>
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
