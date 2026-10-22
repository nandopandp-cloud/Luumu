"use client";

import { useSyncExternalStore } from "react";

/*
  Há uma página carregando? O loading.tsx das rotas liga (enquanto está montado) e o
  PageLoader, no AppShell, lê daqui. Contador: duas cargas sobrepostas não se desligam
  uma à outra.
*/
let pending = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function beginPageLoad() {
  pending++;
  emit();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    pending--;
    emit();
  };
}

export function usePageLoading() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pending > 0,
    () => false
  );
}
