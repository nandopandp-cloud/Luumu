"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

/** Erro inesperado fora do painel (login, páginas públicas…). */
export default function RootError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <ErrorScreen error={error} retry={unstable_retry} variant="full" />;
}
