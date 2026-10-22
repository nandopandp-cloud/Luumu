import { cn } from "@/lib/utils";

/** Bloco de carregamento (pulsa; parado para quem pede menos movimento). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-bg-sunken motion-reduce:animate-none", className)} />;
}

/**
 * Esqueleto genérico de uma tela do painel: cabeçalho, linha de métricas e conteúdo.
 * Aparece NA HORA do clique (loading.tsx) enquanto o servidor monta a página real.
 */
export function PageSkeleton({ metrics = true }: { metrics?: boolean }) {
  return (
    <div role="status" aria-live="polite" aria-label="Carregando">
      <span className="sr-only">Carregando…</span>
      <div className="mb-7 flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {metrics && (
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-line bg-bg-elev p-6">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-4 h-8 w-24" />
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-bg-elev p-6 lg:col-span-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-6 h-56 w-full" />
        </div>
        <div className="rounded-2xl border border-line bg-bg-elev p-6">
          <Skeleton className="h-4 w-32" />
          <div className="mt-6 flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
