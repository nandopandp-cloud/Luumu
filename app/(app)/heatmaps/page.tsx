"use client";

import { useState } from "react";
import { MousePointerClick, Move, ArrowDownUp, Eye, Monitor, Smartphone, Tablet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/Tabs";
import { SoonBanner } from "@/components/ui/SoonBanner";
import { cn } from "@/lib/utils";

type HeatType = "click" | "move" | "scroll" | "attention";
type Device = "desktop" | "tablet" | "mobile";

const hotspots = [
  { x: 22, y: 18, intensity: 0.9 },
  { x: 78, y: 16, intensity: 0.7 },
  { x: 50, y: 42, intensity: 1 },
  { x: 30, y: 66, intensity: 0.6 },
  { x: 72, y: 72, intensity: 0.85 },
  { x: 50, y: 88, intensity: 0.75 },
];

export default function HeatmapsPage() {
  const [type, setType] = useState<HeatType>("click");
  const [device, setDevice] = useState<Device>("desktop");

  const isScroll = type === "scroll";

  return (
    <div>
      <PageHeader
        eyebrow="Behavior"
        title="Heatmaps"
        description="Veja onde seus usuários clicam, movem o mouse, rolam e prestam atenção."
      />

      <SoonBanner className="mb-4">
        Heatmaps dependem de <strong>captura de interações</strong> (cliques, movimento, scroll) no produto
        do cliente — algo que o SDK ainda não coleta. O mapa abaixo é uma demonstração de layout, não dados
        do seu workspace.
      </SoonBanner>

      <div className="mb-4 flex flex-col gap-3 opacity-70 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl<HeatType>
          value={type}
          onChange={setType}
          options={[
            { value: "click", label: "Clique", icon: <MousePointerClick className="size-4" /> },
            { value: "move", label: "Movimento", icon: <Move className="size-4" /> },
            { value: "scroll", label: "Scroll", icon: <ArrowDownUp className="size-4" /> },
            { value: "attention", label: "Atenção", icon: <Eye className="size-4" /> },
          ]}
        />
        <SegmentedControl<Device>
          value={device}
          onChange={setDevice}
          size="sm"
          options={[
            { value: "desktop", label: "Desktop", icon: <Monitor className="size-4" /> },
            { value: "tablet", label: "Tablet", icon: <Tablet className="size-4" /> },
            { value: "mobile", label: "Mobile", icon: <Smartphone className="size-4" /> },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 opacity-70 lg:grid-cols-[1fr_280px]">
        {/* Preview com overlay de calor */}
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-erro/60" />
              <span className="size-2.5 rounded-full bg-aviso/60" />
              <span className="size-2.5 rounded-full bg-sucesso/60" />
            </div>
            <div className="ml-2 flex-1 rounded-md bg-bg-sunken px-3 py-1 font-mono text-xs text-fg-mut">
              app.luumu.com/checkout
            </div>
          </div>

          <div
            className={cn(
              "relative mx-auto bg-bg-elev transition-all",
              device === "desktop" && "w-full",
              device === "tablet" && "max-w-2xl",
              device === "mobile" && "max-w-sm"
            )}
          >
            {/* Wireframe de página */}
            <div className="space-y-4 p-8">
              <div className="mx-auto h-8 w-40 rounded-lg bg-bg-sunken" />
              <div className="h-40 rounded-2xl bg-bg-sunken" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-24 rounded-xl bg-bg-sunken" />
                <div className="h-24 rounded-xl bg-bg-sunken" />
                <div className="h-24 rounded-xl bg-bg-sunken" />
              </div>
              <div className="h-32 rounded-2xl bg-bg-sunken" />
              <div className="mx-auto h-10 w-48 rounded-full bg-bg-sunken" />
            </div>

            {/* Overlay de calor */}
            {!isScroll ? (
              <div className="pointer-events-none absolute inset-0">
                {hotspots.map((h, i) => (
                  <div
                    key={i}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${h.x}%`,
                      top: `${h.y}%`,
                      width: 140 * h.intensity + 70,
                      height: 140 * h.intensity + 70,
                      background: `radial-gradient(circle, rgba(239,68,68,${0.8 * h.intensity}) 0%, rgba(255,138,61,${0.6 * h.intensity}) 32%, rgba(255,200,61,${0.42 * h.intensity}) 52%, rgba(126,217,87,${0.28 * h.intensity}) 70%, transparent 82%)`,
                    }}
                  />
                ))}
              </div>
            ) : (
              // Scroll heatmap: faixas de profundidade
              <div className="pointer-events-none absolute inset-0 flex flex-col">
                {[0.95, 0.8, 0.55, 0.3, 0.12].map((op, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{ background: `rgba(107,43,217,${op * 0.28})` }}
                  >
                    <span className="ml-2 mt-1 inline-block font-mono text-[10px] font-semibold text-white/80">
                      {Math.round(op * 100)}% visível
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Filtros */}
        <Card>
          <div className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-wide text-fg-mut">
            Filtros
          </div>
          <div className="flex flex-col gap-3">
            {[
              ["Navegador", ["Todos", "Chrome", "Safari", "Firefox", "Edge"]],
              ["Sistema", ["Todos", "macOS", "Windows", "iOS", "Android"]],
              ["Campanha", ["Todas", "Google Ads", "Newsletter", "Orgânico"]],
              ["Segmento", ["Todos", "Novos", "Pagantes", "Trial"]],
              ["Período", ["Últimos 7 dias", "Últimos 30 dias", "Este trimestre"]],
            ].map(([label, opts]) => (
              <label key={label as string} className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-fg-soft">{label}</span>
                <Select>
                  {(opts as string[]).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
              </label>
            ))}
          </div>

          <div className="mt-5 rounded-xl bg-bg-sunken p-3 text-xs text-fg-mut">
            <div className="mb-1 font-semibold text-fg-soft">Amostra</div>
            <span className="font-mono text-lg font-bold text-accent">14.204</span> sessões neste período.
          </div>

          {/* Legenda */}
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-semibold text-fg-soft">Intensidade</div>
            <div className="h-2.5 rounded-full" style={{ background: "linear-gradient(90deg, #7ED957, #FFC83D, #FF8A3D, #EF4444)" }} />
            <div className="mt-1 flex justify-between font-mono text-[10px] text-fg-mut">
              <span>frio</span>
              <span>quente</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
