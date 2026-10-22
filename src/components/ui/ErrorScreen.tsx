"use client";

import { useEffect } from "react";
import { Info, RotateCw } from "lucide-react";
import { ErrorArt } from "@/components/illustrations/EmptyArt";
import { cn } from "@/lib/utils";

/*
  Erro inesperado — no lugar da tela padrão. Dentro do painel ("inline") mantém menu e topo;
  fora dele ("full") ocupa a tela. O texto não culpa o usuário e oferece dois caminhos.
*/
export function ErrorScreen({
  error,
  retry,
  variant = "inline",
}: {
  error: Error & { digest?: string };
  retry: () => void;
  variant?: "inline" | "full";
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className={cn(
        "relative isolate flex flex-col items-center justify-center overflow-hidden px-6 text-center",
        variant === "full" ? "min-h-screen bg-bg py-16" : "-mx-4 -my-7 min-h-[calc(100vh-4rem)] py-14 md:-mx-8"
      )}
    >
      {/* formas suaves de fundo */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <span className="absolute -left-24 -top-28 size-80 rounded-full bg-accent/[0.035]" />
        <span className="absolute -right-32 top-1/3 size-96 rounded-full bg-accent/[0.035]" />
        <span className="absolute -bottom-48 left-[12%] size-[26rem] rounded-full bg-accent/[0.04]" />
        <span className="absolute -bottom-24 -right-16 size-72 rounded-full bg-accent/[0.03]" />
      </div>
      <ErrorArt className="w-full max-w-[720px]" />
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-fg md:text-[40px]">Ops! Algo deu errado.</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-mut md:text-base">
        Não foi possível carregar esta página. Pode ser um problema de conexão ou algo temporário do nosso lado. Tente novamente em instantes.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-[var(--accent-contrast)] shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5"
        >
          <RotateCw className="size-4" aria-hidden /> Tentar novamente
        </button>
        {/* <a> e não <Link>: se o erro veio do próprio app, uma navegação completa recomeça do zero */}
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-bg-elev px-6 py-3 text-sm font-bold text-fg transition hover:border-accent hover:text-accent"
        >
          <Info className="size-4" aria-hidden /> Voltar para o início
        </a>
      </div>
      {error.digest && <p className="mt-6 font-mono text-[11px] text-fg-mut">Referência: {error.digest}</p>}
    </div>
  );
}
