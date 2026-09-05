"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Editor de recorte antes do upload: zoom, arraste (pan) e giro em 90°, com prévia exata
 * de como a imagem cabe no espaço do avatar/logo — sem depender de biblioteca externa,
 * só canvas nativo. Devolve um Blob PNG já recortado no tamanho final.
 *
 * Fluxo: o usuário escolhe o arquivo (fora deste componente) → abre aqui como modal →
 * ajusta → "Aplicar" resolve a Promise com o blob recortado, pronto para enviar.
 */

const OUTPUT_SIZE = 512; // px — resolução do avatar/logo final, independe do zoom da UI
const VIEWPORT = 280; // px — tamanho do círculo/quadrado de prévia na tela

export interface ImageCropperResult {
  blob: Blob;
  previewUrl: string;
}

export function useImageCropper() {
  const [file, setFile] = useState<File | null>(null);
  const resolverRef = useRef<((result: ImageCropperResult | null) => void) | null>(null);

  /** Abre o editor para este arquivo; resolve com o blob recortado, ou null se cancelado. */
  const open = useCallback((f: File): Promise<ImageCropperResult | null> => {
    setFile(f);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = useCallback((result: ImageCropperResult | null) => {
    setFile(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  return { file, open, close };
}

export function ImageCropper({
  file,
  shape,
  title,
  onDone,
}: {
  file: File;
  shape: "circle" | "square";
  title: string;
  onDone: (result: ImageCropperResult | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // dimensões em state (não ref): minZoom precisa delas para renderizar o slider,
  // e ler ref.current durante o render não é seguro (o valor pode não refletir o commit atual)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // graus, múltiplos de 90
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // pan em px de tela
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const ready = size !== null;

  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl]);

  // carrega a imagem uma vez
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      setSize({ w: img.width, h: img.height });
    };
    img.src = objectUrl;
  }, [objectUrl]);

  /** Zoom mínimo é o que garante que a imagem cobre o quadro inteiro em qualquer rotação. */
  const minZoom = useMemo(() => {
    if (!size) return 1;
    const swapped = rotation % 180 !== 0;
    const w = swapped ? size.h : size.w;
    const h = swapped ? size.w : size.h;
    return VIEWPORT / Math.min(w, h);
  }, [size, rotation]);

  // realinha o zoom quando o mínimo muda (imagem carregou, ou rotação alterou o mínimo) —
  // derivado durante o render, não em efeito, para não disparar uma renderização extra
  const effectiveZoom = Math.max(zoom, minZoom);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = VIEWPORT;
    canvas.height = VIEWPORT;
    ctx.clearRect(0, 0, VIEWPORT, VIEWPORT);

    ctx.save();
    ctx.translate(VIEWPORT / 2 + offset.x, VIEWPORT / 2 + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(effectiveZoom, effectiveZoom);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    // máscara: escurece fora da área que será exportada
    ctx.save();
    ctx.fillStyle = "rgba(15, 15, 20, 0.55)";
    ctx.beginPath();
    ctx.rect(0, 0, VIEWPORT, VIEWPORT);
    if (shape === "circle") {
      ctx.arc(VIEWPORT / 2, VIEWPORT / 2, VIEWPORT / 2, 0, Math.PI * 2, true);
    } else {
      const inset = 0; // logo usa o quadro inteiro (cantos arredondados só visualmente)
      ctx.rect(VIEWPORT - inset, inset, -(VIEWPORT - inset * 2), VIEWPORT - inset * 2);
    }
    ctx.fill("evenodd");
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (shape === "circle") {
      ctx.arc(VIEWPORT / 2, VIEWPORT / 2, VIEWPORT / 2 - 1, 0, Math.PI * 2);
    } else {
      ctx.rect(1, 1, VIEWPORT - 2, VIEWPORT - 2);
    }
    ctx.stroke();
  }, [effectiveZoom, rotation, offset, shape]);

  useEffect(() => {
    if (ready) draw();
  }, [ready, draw]);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom((z) => clamp(z + z * delta, minZoom, minZoom * 6));
  }

  function rotate(dir: 1 | -1) {
    setRotation((r) => (((r + dir * 90) % 360) + 360) % 360);
    setOffset({ x: 0, y: 0 }); // gira e recentraliza — evitar sair do quadro
  }

  function reset() {
    setZoom(minZoom);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  }

  function apply() {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement("canvas");
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    const scale = OUTPUT_SIZE / VIEWPORT;
    ctx.save();
    ctx.translate(OUTPUT_SIZE / 2 + offset.x * scale, OUTPUT_SIZE / 2 + offset.y * scale);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(effectiveZoom * scale, effectiveZoom * scale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    out.toBlob(
      (blob) => {
        if (!blob) return onDone(null);
        onDone({ blob, previewUrl: URL.createObjectURL(blob) });
      },
      "image/png",
      0.92
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onDone(null)} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-line bg-bg-elev p-6 shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button
            onClick={() => onDone(null)}
            className="rounded-full p-1.5 text-fg-mut hover:bg-surface hover:text-fg"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-fg-mut">Arraste para posicionar, ajuste o zoom e gire se precisar.</p>

        <div className="mt-4 flex justify-center">
          <canvas
            ref={canvasRef}
            width={VIEWPORT}
            height={VIEWPORT}
            className="cursor-grab touch-none rounded-xl bg-surface active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onWheel={onWheel}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ZoomOut className="size-4 shrink-0 text-fg-mut" />
          <input
            type="range"
            min={minZoom}
            max={minZoom * 6}
            step={(minZoom * 6 - minZoom) / 100 || 0.01}
            value={effectiveZoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-accent"
          />
          <ZoomIn className="size-4 shrink-0 text-fg-mut" />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => rotate(-1)} aria-label="Girar à esquerda">
              <RotateCcw className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => rotate(1)} aria-label="Girar à direita">
              <RotateCw className="size-4" />
            </Button>
          </div>
          <button onClick={reset} className="text-xs font-semibold text-fg-mut hover:text-accent">
            Restaurar
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onDone(null)}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={apply} disabled={!ready}>
            <Check className="size-4" />
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
