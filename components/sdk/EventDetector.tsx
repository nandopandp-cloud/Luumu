"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, Radio } from "lucide-react";

interface EventRow {
  name: string;
  count: number;
  lastSeenAt: string;
}
interface Status {
  connected: boolean;
  total: number;
  events: EventRow[];
}

// classifica o nome pelo prefixo gerado pelo auto-tracking do SDK (sdk/luumu.ts)
function eventKind(name: string): { label: string; detail: string } {
  if (name.startsWith("page_view_")) return { label: "Página", detail: "/" + name.slice("page_view_".length).replace(/_/g, "/") };
  if (name.startsWith("click_")) return { label: "Clique", detail: name.slice("click_".length).replace(/_/g, " ") };
  if (name.startsWith("link_")) return { label: "Link", detail: name.slice("link_".length).replace(/_/g, " ") };
  return { label: "Manual", detail: name.replace(/_/g, " ") };
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

/**
 * Detecta ao vivo se o SDK instalado já está enviando eventos.
 * Faz polling em /api/events/status enquanto a aba está visível.
 * initial vem do server (SSR) para não piscar "aguardando" quando já há eventos.
 */
export function EventDetector({ initial }: { initial: Status }) {
  const [status, setStatus] = useState<Status>(initial);
  const [justArrived, setJustArrived] = useState(false);
  const prevTotal = useRef(initial.total);

  useEffect(() => {
    let alive = true;
    async function poll() {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/events/status", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const data: Status = await r.json();
        if (data.total > prevTotal.current) {
          setJustArrived(true);
          setTimeout(() => alive && setJustArrived(false), 2000);
        }
        prevTotal.current = data.total;
        setStatus(data);
      } catch {
        /* silencioso: rede intermitente não deve quebrar o onboarding */
      }
    }
    const id = setInterval(poll, 4000);
    poll();
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!status.connected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-bg-sunken px-4 py-3">
        <Loader2 className="size-5 shrink-0 animate-spin text-accent" />
        <div>
          <div className="text-sm font-semibold text-fg">Aguardando o primeiro evento…</div>
          <div className="text-xs text-fg-mut">
            Assim que o SDK enviar um evento do seu produto, ele aparece aqui automaticamente.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border px-4 py-3 transition-colors ${
        justArrived ? "border-sucesso bg-sucesso/10" : "border-line bg-bg-sunken"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        {justArrived ? (
          <Radio className="size-5 text-sucesso" />
        ) : (
          <CheckCircle2 className="size-5 text-sucesso" />
        )}
        <span className="text-sm font-semibold text-fg">
          SDK conectado — {status.total} {status.total === 1 ? "evento recebido" : "eventos recebidos"}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {status.events.map((e) => {
          const kind = eventKind(e.name);
          return (
            <li key={e.name} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded-full bg-surface-brand px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-accent">
                  {kind.label}
                </span>
                <code className="truncate font-mono text-[12.5px] text-fg-soft" title={e.name}>
                  {kind.detail}
                </code>
              </div>
              <div className="flex shrink-0 items-center gap-2 font-mono text-xs text-fg-mut">
                <span>{e.count}×</span>
                <span>{timeAgo(e.lastSeenAt)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
