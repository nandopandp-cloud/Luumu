import { Skeleton } from "@/components/ui/Skeleton";

const Card = ({ className, lines = 4 }: { className?: string; lines?: number }) => (
  <div className={`rounded-2xl border border-line bg-bg-elev p-6 ${className ?? ""}`}>
    <Skeleton className="h-5 w-48" />
    <div className="mt-5 flex flex-col gap-3">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  </div>
);

/** Esqueleto da área Insights, na mesma grade da página (aparece na hora do clique). */
export function InsightSkeleton() {
  return (
    <div role="status" aria-label="Carregando insights" className="flex flex-col gap-6">
      <span className="sr-only">Carregando insights…</span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-[420px] max-w-full" />
        <Skeleton className="h-4 w-[560px] max-w-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-[22px]" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card lines={3} />
        <Card lines={3} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card lines={6} />
        <Card lines={6} />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card />
        <Card />
        <Card />
      </div>
    </div>
  );
}
