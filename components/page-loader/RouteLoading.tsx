"use client";

import { useEffect } from "react";
import { beginPageLoad } from "./store";

/** Para loading.tsx: avisa o PageLoader que a rota está carregando e guarda o espaço da página. */
export function RouteLoading() {
  useEffect(() => beginPageLoad(), []);
  return <div className="min-h-[70vh]" aria-busy="true" aria-label="Carregando" />;
}
