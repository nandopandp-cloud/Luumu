"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { LuumuLogo } from "@/components/ui/Mascot";
import { NAV } from "./nav";

export function Sidebar({
  onNavigate,
  workspace,
}: {
  onNavigate?: () => void;
  workspace: { name: string; plan: string; logoUrl: string | null };
}) {
  const pathname = usePathname();
  const planLabel = { starter: "Plano Starter", growth: "Plano Growth", enterprise: "Plano Enterprise" }[workspace.plan] ?? "Plano Growth";

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
          {workspace.logoUrl ? (
            <Image
              src={workspace.logoUrl}
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-lg object-cover"
            />
          ) : (
            <span className="grid size-8 place-items-center rounded-lg text-sm font-bold text-white [background:var(--grad-roxo)]">
              {workspace.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="leading-tight">
            <div className="text-sm font-semibold">{workspace.name}</div>
            <div className="text-[11px] text-fg-mut">{planLabel}</div>
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

                if (item.locked) {
                  return (
                    <div
                      key={item.href}
                      aria-disabled="true"
                      title="Em breve"
                      className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-fg-mut/50"
                    >
                      <Icon className="size-[18px]" />
                      <span className="flex-1">{item.label}</span>
                      <Lock className="size-3.5 shrink-0" />
                    </div>
                  );
                }

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
