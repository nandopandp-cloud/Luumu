import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "green" | "ghost" | "subtle" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 ease-[var(--ease-smooth)] cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "text-white shadow-[var(--shadow-glow)] hover:-translate-y-0.5 [background:var(--grad-roxo)]",
  green:
    "text-[#0A2E12] hover:-translate-y-0.5 [background:var(--grad-verde)]",
  ghost:
    "bg-transparent border border-line-strong text-fg hover:border-accent hover:text-accent",
  subtle:
    "bg-surface-brand text-accent hover:brightness-95",
  danger:
    "bg-erro/10 text-erro hover:bg-erro/15",
};

const sizes: Record<Size, string> = {
  sm: "text-[13px] px-3.5 py-2",
  md: "text-sm px-5 py-2.5",
  lg: "text-base px-6 py-3",
};

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  href?: string;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", href, className, children, ...props },
  ref
) {
  const classes = cn(base, variants[variant], sizes[size], className);
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button ref={ref} className={classes} {...props}>
      {children}
    </button>
  );
});
