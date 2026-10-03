"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { WorkspaceUsage } from "@/lib/db/workspace";

const UsageContext = createContext<WorkspaceUsage | null>(null);

/** Uso do plano da workspace (null enquanto carrega). */
export const useWorkspaceUsage = () => useContext(UsageContext);

const POLL_MS = 60_000;
const unlimited = (n: number | null) => (n === null ? Infinity : n);

async function fetchUsage(): Promise<WorkspaceUsage | null> {
  try {
    const res = await fetch("/api/usage", { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      ...d,
      limits: { responses: unlimited(d.limits.responses), activeSurveys: unlimited(d.limits.activeSurveys), members: unlimited(d.limits.members) },
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
export function UsageProvider({ initial, children }: { initial?: Promise<WorkspaceUsage | null>; children: React.ReactNode }) {
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    let alive = true;
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
    let alive = true;
    fetchUsage().then((u) => alive && u && setUsage(u));
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") fetchUsage().then((u) => u && setUsage(u));
    };
    const id = window.setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return <UsageContext.Provider value={usage}>{children}</UsageContext.Provider>;
}
