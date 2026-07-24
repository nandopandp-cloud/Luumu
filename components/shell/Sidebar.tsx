"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { LuumuLogo } from "@/components/ui/Mascot";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { NAV } from "./nav";

export function Sidebar({
  onNavigate,
  workspace,
  projects,
  activeProjectId,
}: {
  onNavigate?: () => void;
  workspace: { name: string; plan: string; logoUrl: string | null };
  projects: { id: string; name: string }[];
  activeProjectId: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[260px] flex-col gap-1 overflow-y-auto border-r border-line bg-bg-elev px-3 py-5">
      {/* Marca */}
      <Link href="/dashboard" className="mb-2 flex items-center px-2" onClick={onNavigate}>
        <LuumuLogo size={34} />
      </Link>

      {/* Seletor de projeto ativo */}
      <ProjectSwitcher
        projects={projects}
        activeProjectId={activeProjectId}
        workspaceName={workspace.name}
        onNavigate={onNavigate}
      />

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
