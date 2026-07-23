"use client";

import { useEffect } from "react";
import { RotateCw, LifeBuoy } from "lucide-react";
import { LuumuLogo, Mascot } from "@/components/ui/Mascot";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 py-16 text-center">
      <div className="flex items-center gap-2">
        <LuumuLogo size={32} />
        <span className="font-display text-xl font-extrabold tracking-tight text-fg">Luumu</span>
      </div>

      <Mascot name="Preocupado" size={140} float />

      <div className="max-w-sm">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg">
          Algo não saiu como esperado
        </h1>
        <p className="mt-2 text-sm text-fg-mut">
          Nossa equipe já foi notificada. Tente novamente — se o problema persistir, fale com o suporte.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-fg-mut">Referência: {error.digest}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 [background:var(--grad-roxo)]"
        >
          <RotateCw className="size-4" /> Tentar novamente
        </button>
        <a
          href="mailto:suporte@luumu.com"
          className="inline-flex items-center gap-2 rounded-full border border-line-strong px-6 py-3 text-sm font-semibold text-fg-soft transition hover:border-accent hover:text-accent"
        >
          <LifeBuoy className="size-4" /> Falar com o suporte
        </a>
      </div>
    </div>
  );
}
