"use client";

import Link from "@/components/ui/Link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/settings", label: "Workspace" },
  { href: "/settings/profile", label: "Meu perfil" },
  { href: "/settings/members", label: "Membros" },
  { href: "/settings/sdk", label: "SDK & Eventos" },
  // ainda sem fonte de dados real: aba desativada (a rota também é bloqueada no proxy)
  { href: "/settings/integrations", label: "Integrações", locked: true },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 border-b border-line">
      {tabs.map((t) => {
        const active = pathname === t.href;
        if ("locked" in t && t.locked)
          return (
            <span key={t.href} aria-disabled title="Em breve" className="relative flex cursor-not-allowed items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-fg-mut/60">
              {t.label}
              <Lock className="size-3" />
            </span>
          );
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
