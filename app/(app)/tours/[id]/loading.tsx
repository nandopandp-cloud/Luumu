import { Skeleton } from "@/components/ui/Skeleton";

/** Troca entre abas do tour: cabeçalho e abas ficam (layout), só o conteúdo carrega. */
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
      <span className="sr-only">Carregando…</span>
      {[0, 1, 2].map((col) => (
        <div key={col} className="rounded-2xl border border-line bg-bg-elev p-5">
          <Skeleton className="h-4 w-32" />
          <div className="mt-5 flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className={col === 1 ? "h-24 w-full" : "h-12 w-full"} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
