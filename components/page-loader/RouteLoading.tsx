"use client";

import { useEffect } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { beginPageLoad } from "./store";

/**
 * Para loading.tsx: mostra o esqueleto discreto e avisa o PageLoader. Se a carga passar de
 * ~700 ms, a ameixa da Luumu entra por cima do esqueleto.
 */
export function RouteLoading() {
  useEffect(() => beginPageLoad(), []);
  return <PageSkeleton />;
}
