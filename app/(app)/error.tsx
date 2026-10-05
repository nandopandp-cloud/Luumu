"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

/** Erro inesperado numa tela do painel: o menu e o topo continuam no lugar. */
export default function AppError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <ErrorScreen error={error} retry={unstable_retry} />;
}
