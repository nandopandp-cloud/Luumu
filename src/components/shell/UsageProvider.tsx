"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { WorkspaceUsage } from "@/lib/db/workspace";

const UsageContext = createContext<WorkspaceUsage | null>(null);

/** Uso do plano da workspace (null enquanto carrega). */
export const useWorkspaceUsage = () => useContext(UsageContext);

/** atualização periódica com a aba visível (cada uma é uma Edge Request + invocação) */
const POLL_MS = 5 * 60_000;
/** trocar de página só refaz a consulta se a última tiver mais de 2 min */
const NAV_MIN_MS = 2 * 60_000;
const unlimited = (n: number | null) => (n === null ? Infinity : n);

async function fetchUsage(): Promise<WorkspaceUsage | null> {
  try {
    const res = await fetch("/api/usage", { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      ...d,
      limits: {
        responses: unlimited(d.limits.responses),
        activeSurveys: unlimited(d.limits.activeSurveys),
        members: unlimited(d.limits.members),
        events: unlimited(d.limits.events ?? null),
      },
      // resposta de uma versão anterior da rota (sem eventos) durante o deploy
      usage: { ...d.usage, events: d.usage?.events ?? 0 },
    };
  } catch {
    return null;
  }
}

/**
 * Mantém o uso da workspace sempre atual sem atrasar a página: o primeiro valor vem do
 * layout (promise, sem await) e depois é recarregado a cada navegação, ao voltar para a aba
 * e a cada minuto com a aba visível. O layout em si não renderiza de novo ao navegar, então
 * sem isto uma pesquisa publicada ou uma resposta nova só apareceria após recarregar.
 */
export function UsageProvider({ initial, children }: { initial?: Promise<WorkspaceUsage | null>; children?: React.ReactNode }) {
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const pathname = usePathname();
  const first = useRef(true);
  // 0 até o valor do layout chegar (marcado no efeito abaixo)
  const lastFetch = useRef(0);
  const refresh = useRef(async () => {
    lastFetch.current = Date.now();
    const u = await fetchUsage();
    if (u) setUsage(u);
  });

  useEffect(() => {
    let alive = true;
    lastFetch.current = Date.now();
    initial?.then((u) => alive && u && setUsage((cur) => cur ?? u));
    return () => {
      alive = false;
    };
  }, [initial]);

  useEffect(() => {
    // na primeira renderização o valor do layout basta
    if (first.current) {
      first.current = false;
      return;
    }
    if (Date.now() - lastFetch.current < NAV_MIN_MS) return;
    void refresh.current();
  }, [pathname]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch.current >= POLL_MS) void refresh.current();
    };
    const back = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch.current >= NAV_MIN_MS) void refresh.current();
    };
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", back);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", back);
    };
  }, []);

  return <UsageContext.Provider value={usage}>{children}</UsageContext.Provider>;
}
