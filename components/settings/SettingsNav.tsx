"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/settings", label: "Workspace" },
  { href: "/settings/members", label: "Membros" },
  { href: "/settings/billing", label: "Plano & Cobrança" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 border-b border-line">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "relative px-4 py-2.5 text-sm font-semibold transition-colors",
              active ? "text-accent" : "text-fg-mut hover:text-fg-soft"
            )}
          >
            {t.label}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full [background:var(--grad-marca)]" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
