"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { LuumuLogo } from "@/components/ui/Mascot";
import { NAV } from "./nav";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[260px] flex-col gap-1 overflow-y-auto border-r border-line bg-bg-elev px-3 py-5">
      {/* Marca */}
      <Link href="/dashboard" className="mb-2 flex items-center gap-2 px-2" onClick={onNavigate}>
        <LuumuLogo size={34} />
        <span className="font-display text-xl font-extrabold tracking-tight">Luumu</span>
      </Link>

      {/* Seletor de workspace (mock) */}
      <button className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-line bg-bg-sunken px-3 py-2 text-left transition hover:border-line-strong">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg text-sm font-bold text-white [background:var(--grad-roxo)]">
            J
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Jovens Gênios</div>
            <div className="text-[11px] text-fg-mut">Plano Growth</div>
          </div>
        </div>
        <ChevronsUpDown className="size-4 text-fg-mut" />
      </button>

      <nav className="flex flex-col gap-4">
        {NAV.map((group) => (
          <div key={group.title}>
            <div className="px-3 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-mut">
              {group.title}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      active
                        ? "text-white shadow-[var(--shadow-glow)] [background:var(--grad-roxo)]"
                        : "text-fg-soft hover:bg-surface-brand hover:text-accent"
                    )}
                  >
                    <Icon className="size-[18px]" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto px-2 pt-4 font-mono text-[10px] uppercase tracking-wide text-fg-mut">
        Luumu · v0.1 · protótipo
      </div>
    </aside>
  );
}
