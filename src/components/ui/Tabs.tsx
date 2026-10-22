"use client";

import { cn } from "@/lib/utils";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-full border border-line bg-bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full font-semibold transition-all",
            size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
            value === o.value
              ? "bg-bg-elev text-accent shadow-[var(--shadow-sm)]"
              : "text-fg-mut hover:text-fg-soft"
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "relative px-4 py-2.5 text-sm font-semibold transition-colors",
            value === t.value ? "text-accent" : "text-fg-mut hover:text-fg-soft"
          )}
        >
          {t.label}
          {value === t.value && (
            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full [background:var(--grad-marca)]" />
          )}
        </button>
      ))}
    </div>
  );
}
