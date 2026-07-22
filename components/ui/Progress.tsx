import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  tone = "brand",
}: {
  value: number;
  className?: string;
  tone?: "brand" | "green";
}) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-bg-sunken", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: tone === "green" ? "var(--grad-verde)" : "var(--grad-marca)",
        }}
      />
    </div>
  );
}
