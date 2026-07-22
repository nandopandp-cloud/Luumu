import { cn } from "@/lib/utils";

type Tone = "success" | "warn" | "error" | "info" | "neutral" | "brand";

const tones: Record<Tone, string> = {
  success: "bg-sucesso/15 text-[#16a34a] dark:text-[#4ade80]",
  warn: "bg-aviso/20 text-[#b7860b] dark:text-[#fde047]",
  error: "bg-erro/15 text-[#dc2626] dark:text-[#f87171]",
  info: "bg-info/15 text-[#2563eb] dark:text-[#93c5fd]",
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
