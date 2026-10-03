import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8" aria-busy="true" aria-label="Carregando planos">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-10 w-[min(520px,100%)]" />
        <Skeleton className="h-5 w-[min(680px,100%)]" />
      </div>
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[460px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
