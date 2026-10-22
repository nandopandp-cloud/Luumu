"use client";

import "./globals.css";
import { ErrorScreen } from "@/components/ui/ErrorScreen";

/*
  Último recurso: o próprio layout raiz falhou. Substitui o layout inteiro (precisa de <html>
  e <body>) — é o que evita a tela padrão em vez da nossa.
*/
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body>
        <title>Algo deu errado · Luumu</title>
        <ErrorScreen error={error} retry={unstable_retry} variant="full" />
      </body>
    </html>
  );
}
