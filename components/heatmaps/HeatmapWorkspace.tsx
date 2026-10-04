"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowDownUp, MousePointerClick, Move } from "lucide-react";
import { cn } from "@/lib/utils";
import { biggestDrops, reachCurve, sectionStats, type HeatmapDevice, type HeatmapMode, type Section } from "@/lib/heatmaps/core";
import type { HeatmapReport } from "@/lib/db/heatmaps";
import { Mascot } from "@/components/ui/Mascot";
import { PageMap, type MapStats } from "./PageMap";
import {
  AbandonPanel,
  DevicesCard,
  GeneralBehavior,
  HoverElements,
  MoveDepth,
  ScrollDepthBars,
  ScrollDepthPanel,
  TimeOnPage,
  TopClickAreas,
  TopPaths,
  TopSections,
} from "./Panels";

const TABS: { id: HeatmapMode; label: string; icon: typeof Move; title: string; subtitle: string }[] = [
  { id: "clicks", label: "Cliques", icon: MousePointerClick, title: "Mapa de cliques", subtitle: "Visualize as áreas mais clicadas da sua página." },
  { id: "moves", label: "Movimento", icon: Move, title: "Mapa de movimento", subtitle: "Veja o fluxo de navegação e o caminho que os usuários mais realizam." },
  { id: "scroll", label: "Scroll", icon: ArrowDownUp, title: "Mapa de scroll", subtitle: "Veja até onde os usuários chegam e onde eles mais abandonam a página." },
];

/** Área principal: mapa + painel lateral + cards do modo escolhido. */
export function HeatmapWorkspace({
  mode,
  page,
  device,
  mapDevice,
  mapDevices,
  report,
  mapReport,
  compare,
}: {
  mode: HeatmapMode;
  page: { host: string; path: string } | null;
  device: HeatmapDevice | null;
  /** dispositivo cuja cópia e cujos dados desenham o mapa */
  mapDevice: HeatmapDevice | null;
  /** dispositivos com visitas nesta página (mais visitado primeiro) */
  mapDevices: HeatmapDevice[];
  report: HeatmapReport | null;
  /** dados só do mapDevice (as camadas do mapa) */
  mapReport: HeatmapReport | null;
  compare: boolean;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [highlight, setHighlight] = useState<string | null>(null);
  const [stats, setStats] = useState<MapStats | null>(null);
  const onStats = useCallback((s: MapStats) => setStats(s), []);

  // rolagem e seções medidas no MESMO layout do mapa
  const curve = useMemo(() => reachCurve((mapReport ?? report)?.scrollHist ?? []), [mapReport, report]);
  const moveCurve = useMemo(() => reachCurve(report?.moveHist ?? []), [report]);
  const secStats = useMemo(() => sectionStats(stats?.sections ?? ([] as Section[]), curve), [stats, curve]);
  const tab = TABS.find((t) => t.id === mode)!;

  const hrefFor = (m: HeatmapMode) => {
    const p = new URLSearchParams(sp.toString());
    if (m === "clicks") p.delete("mode");
    else p.set("mode", m);
    if (m !== "clicks") p.delete("compare");
    return `${pathname}?${p.toString()}`;
  };

  if (!page || !report || report.pageviews === 0) {
    return (
      <section className="flex flex-col items-center rounded-3xl border border-line bg-bg-elev px-6 py-14 text-center">
        <Mascot name="Pensativo" size={110} />
        <h2 className="mt-3 font-display text-xl font-bold">Nenhuma visita neste recorte</h2>
        <p className="mt-1 max-w-md text-sm text-fg-mut">Tente um período maior ou outro dispositivo. Os dados aparecem conforme as pessoas usam o seu produto.</p>
      </section>
    );
  }

  const unplacedShare = mode === "clicks" && stats && report.totalClicks ? stats.unplaced / report.totalClicks : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl border border-line bg-bg-elev p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[19px] font-bold tracking-tight">{tab.title}</h2>
              <p className="mt-0.5 text-sm text-fg-mut">{tab.subtitle}</p>
            </div>
            <nav aria-label="Tipo de mapa" className="inline-flex rounded-xl border border-line bg-bg-elev p-1">
              {TABS.map((t) => (
                <Link
                  key={t.id}
                  href={hrefFor(t.id)}
                  scroll={false}
                  aria-current={t.id === mode ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition",
                    t.id === mode ? "text-white shadow-[var(--shadow-glow)] [background:var(--grad-roxo)]" : "text-fg-soft hover:bg-bg-sunken"
                  )}
                >
                  <t.icon className="size-4" /> {t.label}
                </Link>
              ))}
            </nav>
          </div>
          <PageMap
            mode={mode}
            page={page}
            device={mapDevice}
            devices={device ? [] : mapDevices}
            report={mapReport ?? report}
            highlight={highlight}
            onStats={onStats}
          />
          {unplacedShare > 0.15 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-aviso">
              <AlertCircle className="size-3.5" /> {Math.round(unplacedShare * 100)}% dos cliques foram em elementos que não existem na imagem atual (a página mudou ou o conteúdo varia por usuário).
            </p>
          )}
        </section>

        <div className="flex flex-col gap-5">
          {mode === "clicks" && <TopClickAreas report={report} compare={compare} highlight={highlight} onHighlight={setHighlight} />}
          {mode === "moves" && <TopPaths report={report} />}
          {mode === "scroll" && (
            <>
              <ScrollDepthPanel curve={curve} total={report.pageviews} />
              <AbandonPanel drops={biggestDrops(secStats)} ready={!!stats} />
            </>
          )}
        </div>
      </div>

      {mode === "clicks" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <DevicesCard report={report} />
          <ScrollDepthBars curve={curve} />
          <TimeOnPage report={report} />
        </div>
      )}
      {mode === "moves" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <HoverElements report={report} onHighlight={setHighlight} />
          <DevicesCard report={report} />
          <MoveDepth moveCurve={moveCurve} />
        </div>
      )}
      {mode === "scroll" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <GeneralBehavior report={report} />
          <TopSections stats={secStats} ready={!!stats} />
        </div>
      )}
    </div>
  );
}
