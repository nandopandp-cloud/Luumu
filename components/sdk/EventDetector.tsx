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
      <ul className="flex flex-col gap-1.5">
        {status.events.map((e) => (
          <li key={e.name} className="flex items-center justify-between text-sm">
            <code className="font-mono text-[12.5px] text-fg-soft">{e.name}</code>
            <span className="font-mono text-xs text-fg-mut">
              {e.count} {e.count === 1 ? "vez" : "vezes"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
