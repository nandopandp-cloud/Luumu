"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Blocks, Monitor, Settings2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function SurveySubnav({ id }: { id: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/surveys/${id}/builder`, label: "Builder", icon: Blocks },
    { href: `/surveys/${id}/appearance`, label: "Exibição", icon: Monitor },
    { href: `/surveys/${id}/settings`, label: "Configurações", icon: Settings2 },
    { href: `/surveys/${id}/responses`, label: "Respostas", icon: MessageSquare },
  ];
  return (
    <div className="mb-6 flex gap-1 border-b border-line">
      {tabs.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              active ? "text-accent" : "text-fg-mut hover:text-fg-soft"
            )}
          >
            <Icon className="size-4" />
            {t.label}
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full [background:var(--grad-marca)]" />}
          </Link>
        );
      })}
    </div>
  );
}
