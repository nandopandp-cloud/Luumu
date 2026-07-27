import { cn } from "@/lib/utils";

type Tone = "success" | "warn" | "error" | "info" | "neutral" | "brand";

const tones: Record<Tone, string> = {
  success: "bg-[#DCFCE7] text-[#15803d] dark:bg-sucesso/15 dark:text-[#4ade80]",
  warn: "bg-[#FEF3C7] text-[#92400e] dark:bg-aviso/20 dark:text-[#fde047]",
  error: "bg-[#FEE2E2] text-[#b91c1c] dark:bg-erro/15 dark:text-[#f87171]",
  info: "bg-[#DBEAFE] text-[#1d4ed8] dark:bg-info/15 dark:text-[#93c5fd]",
  neutral: "bg-fg/10 text-fg-soft",
  brand: "bg-surface-brand text-accent",
};

export function Badge({
  tone = "neutral",
  dot = true,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
