"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Hand, LayoutTemplate, Megaphone, Monitor, MousePointer2, ScanFace, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicA11yConfig } from "@/lib/accessibility/config";

export type PreviewView = "launcher" | "panel" | "nudge" | "libras" | "face";

const VIEWS: { value: PreviewView; label: string; icon: React.ElementType }[] = [
  { value: "launcher", label: "Botões", icon: MousePointer2 },
  { value: "panel", label: "Painel", icon: LayoutTemplate },
  { value: "nudge", label: "Convite", icon: Megaphone },
  { value: "libras", label: "Libras", icon: Hand },
  { value: "face", label: "Rosto", icon: ScanFace },
];

const SIZES = { desktop: { w: 1280, h: 800 }, mobile: { w: 390, h: 780 } };

/**
 * Prévia fiel: um iframe com a plataforma de demonstração (/demo/accessibility?embed=1)
 * rodando o MESMO sdk-a11y.js do produto do cliente. A configuração em edição (ainda não
 * salva) vai por postMessage; o iframe é da mesma origem, e os dois lados conferem a origem.
 */
export function LivePreview({ config, view, onView }: { config: PublicA11yConfig; view: PreviewView; onView: (v: PreviewView) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [width, setWidth] = useState(640);
  const latest = useRef({ config, view });
  useEffect(() => {
    latest.current = { config, view };
  });

  const post = (msg: object) => frame.current?.contentWindow?.postMessage({ source: "luumu-a11y-admin", ...msg }, location.origin);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if ((e.data as { source?: string; ready?: boolean })?.source === "luumu-a11y-demo" && e.data.ready) {
        setReady(true);
        post({ config: latest.current.config, view: latest.current.view });
      }
    };
    addEventListener("message", onMsg);
    return () => removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (ready) post({ config });
  }, [config, ready]);

  useEffect(() => {
    if (ready) post({ view });
  }, [view, ready]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const size = SIZES[device];
  const scale = Math.min(1, width / size.w);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-bg-elev shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="O que mostrar na prévia">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={v.value}
                type="button"
                role="tab"
                aria-selected={view === v.value}
                onClick={() => {
                  onView(v.value);
                  // clicar de novo na mesma vista reabre (ex.: depois de fechar o painel na prévia)
                  if (view === v.value) post({ view: v.value });
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                  view === v.value ? "bg-surface-brand text-accent" : "text-fg-mut hover:text-fg-soft"
                )}
              >
                <Icon className="size-3.5" /> {v.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-line bg-bg-sunken p-1">
            <button type="button" onClick={() => setDevice("desktop")} className={cn("rounded-full p-1.5", device === "desktop" ? "bg-bg-elev text-accent shadow-sm" : "text-fg-mut")} aria-label="Computador" aria-pressed={device === "desktop"}>
              <Monitor className="size-4" />
            </button>
            <button type="button" onClick={() => setDevice("mobile")} className={cn("rounded-full p-1.5", device === "mobile" ? "bg-bg-elev text-accent shadow-sm" : "text-fg-mut")} aria-label="Celular" aria-pressed={device === "mobile"}>
              <Smartphone className="size-4" />
            </button>
          </div>
          <a href="/demo/accessibility" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-fg-mut hover:text-accent" title="Abrir a demonstração em tela cheia (configuração salva)">
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
      <div ref={box} className="relative bg-bg-sunken" style={{ height: size.h * scale }}>
        <iframe
          ref={frame}
          src="/demo/accessibility?embed=1"
          title="Prévia do plugin de acessibilidade no produto do cliente"
          className={cn("absolute left-1/2 top-0 origin-top border-0 bg-white transition-opacity", ready ? "opacity-100" : "opacity-0")}
          style={{ width: size.w, height: size.h, transform: `translateX(-50%) scale(${scale})` }}
          allow="camera; autoplay"
        />
        {!ready && <div className="absolute inset-0 grid place-items-center text-sm text-fg-mut">Carregando a prévia…</div>}
      </div>
    </div>
  );
}
