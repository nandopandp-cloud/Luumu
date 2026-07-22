"use client";

import { useState } from "react";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  AlertTriangle,
  MousePointer2,
  Bug,
  ArrowRightLeft,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { replayEvents } from "@/lib/mock/sessions";

const eventIcon: Record<string, React.ReactNode> = {
  pageview: <FileText className="size-3.5" />,
  click: <MousePointer2 className="size-3.5" />,
  navigation: <ArrowRightLeft className="size-3.5" />,
  rage: <MousePointer2 className="size-3.5" />,
  error: <Bug className="size-3.5" />,
  form: <FileText className="size-3.5" />,
  conversion: <CheckCircle2 className="size-3.5" />,
};

const toneClass: Record<string, string> = {
  info: "text-info bg-info/10",
  neutral: "text-fg-soft bg-fg/10",
  error: "text-erro bg-erro/10",
  success: "text-sucesso bg-sucesso/10",
};

const speeds = [1, 1.5, 2, 4] as const;

export function ReplayPlayer() {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof speeds)[number]>(1);
  const [progress] = useState(38);
  const [tab, setTab] = useState<"eventos" | "console" | "network">("eventos");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      {/* Viewport + controles */}
      <Card padded={false} className="overflow-hidden">
        {/* Viewport mock */}
        <div className="relative aspect-video bg-bg-sunken">
          <div className="absolute inset-0 space-y-3 p-8 opacity-60">
            <div className="h-6 w-32 rounded bg-border" />
            <div className="h-28 rounded-xl bg-border" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-16 rounded-lg bg-border" />
              <div className="h-16 rounded-lg bg-border" />
              <div className="h-16 rounded-lg bg-border" />
            </div>
          </div>
          {/* cursor fantasma */}
          <MousePointer2
            className="absolute size-6 text-luumu-roxo drop-shadow-lg transition-all duration-700"
            style={{ left: "46%", top: "52%" }}
            fill="currentColor"
          />
          <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[11px] font-semibold text-white">
            {playing ? "▶ reproduzindo" : "⏸ pausado"} · {speed}x
          </div>
        </div>

        {/* Timeline */}
        <div className="border-t border-line p-4">
          <div className="relative h-2 rounded-full bg-bg-sunken">
            <div
              className="absolute inset-y-0 left-0 rounded-full [background:var(--grad-marca)]"
              style={{ width: `${progress}%` }}
            />
            {/* marcadores de evento */}
            {replayEvents.map((e, i) => (
              <span
                key={i}
                className={cn(
                  "absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full ring-2 ring-bg-elev",
                  e.tone === "error" ? "bg-erro" : e.tone === "success" ? "bg-sucesso" : "bg-luumu-roxo-claro"
                )}
                style={{ left: `${(i / (replayEvents.length - 1)) * 96 + 2}%` }}
              />
            ))}
            <span
              className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-luumu-roxo shadow-[var(--shadow-md)]"
              style={{ left: `${progress}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button className="grid size-9 place-items-center rounded-full text-fg-soft hover:bg-bg-sunken" aria-label="Voltar">
                <SkipBack className="size-4" />
              </button>
              <button
                onClick={() => setPlaying((p) => !p)}
                className="grid size-11 place-items-center rounded-full text-white shadow-[var(--shadow-glow)] [background:var(--grad-roxo)]"
                aria-label={playing ? "Pausar" : "Reproduzir"}
              >
                {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
              </button>
              <button className="grid size-9 place-items-center rounded-full text-fg-soft hover:bg-bg-sunken" aria-label="Avançar">
                <SkipForward className="size-4" />
              </button>
            </div>

            <div className="font-mono text-xs text-fg-mut">1:34 / 4:12</div>

            <div className="flex items-center gap-1 rounded-full border border-line bg-bg-sunken p-1">
              {speeds.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-mono text-xs font-semibold transition",
                    speed === s ? "bg-bg-elev text-accent shadow-[var(--shadow-sm)]" : "text-fg-mut"
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Painel lateral: eventos / console / network */}
      <Card padded={false} className="flex flex-col overflow-hidden">
        <div className="flex border-b border-line">
          {(["eventos", "console", "network"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative flex-1 px-3 py-2.5 text-sm font-semibold capitalize transition",
                tab === t ? "text-accent" : "text-fg-mut hover:text-fg-soft"
              )}
            >
              {t}
              {tab === t && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full [background:var(--grad-marca)]" />
              )}
            </button>
          ))}
        </div>

        <div className="max-h-[440px] flex-1 overflow-y-auto p-3">
          {tab === "eventos" &&
            replayEvents.map((e, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-bg-sunken">
                <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-md", toneClass[e.tone])}>
                  {eventIcon[e.type]}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{e.label}</div>
                  <div className="font-mono text-[11px] text-fg-mut">{e.t}</div>
                </div>
              </div>
            ))}

          {tab === "console" && (
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-fg-soft">
              <span className="text-fg-mut">[1:05]</span> <span className="text-aviso">warn</span>: slow event handler (120ms){"\n"}
              <span className="text-fg-mut">[1:12]</span> <span className="text-erro">error</span>: TypeError: cannot read 'id' of undefined{"\n"}
              <span className="text-fg-mut">[2:40]</span> <span className="text-sucesso">log</span>: survey.submit ok
            </pre>
          )}

          {tab === "network" && (
            <div className="flex flex-col gap-1.5 font-mono text-[11px]">
              {[
                ["GET", "/api/surveys", "200", "84ms"],
                ["POST", "/api/track", "200", "22ms"],
                ["POST", "/api/surveys", "500", "310ms"],
                ["GET", "/api/me", "200", "40ms"],
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-bg-sunken px-2 py-1.5">
                  <span className="font-semibold text-accent">{r[0]}</span>
                  <span className="flex-1 truncate px-2 text-fg-soft">{r[1]}</span>
                  <span className={r[2] === "500" ? "text-erro" : "text-sucesso"}>{r[2]}</span>
                  <span className="ml-2 text-fg-mut">{r[3]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-line bg-erro/5 px-4 py-2.5 text-xs text-erro">
          <AlertTriangle className="mr-1 inline size-3.5" />
          2 erros e 1 rage click detectados nesta sessão.
        </div>
      </Card>
    </div>
  );
}
