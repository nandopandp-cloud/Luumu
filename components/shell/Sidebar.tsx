"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { LuumuLogo } from "@/components/ui/Mascot";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { NAV } from "./nav";

/** Rótulo flutuante dos itens quando a sidebar está recolhida (hover e foco do teclado). */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-40 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-fg px-2.5 py-1.5 text-xs font-semibold text-bg opacity-0 shadow-[var(--shadow-lg)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}

export function Sidebar({
  onNavigate,
  workspace,
  projects,
  activeProjectId,
  collapsed = false,
  onToggle,
}: {
  onNavigate?: () => void;
  workspace: { name: string; plan: string; logoUrl: string | null };
  projects: { id: string; name: string; logoUrl: string | null }[];
  activeProjectId: string | null;
  /** bandeja recolhida: só ícones */
  collapsed?: boolean;
  /** sem isto (gaveta do celular) não há botão de recolher */
  onToggle?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="relative h-full">
      <aside
        aria-label="Menu principal"
        className={cn(
          "flex h-full flex-col gap-1 border-r border-line bg-bg-elev py-5 transition-[width] duration-200 ease-out",
          // recolhida: sem rolagem (senão os rótulos flutuantes seriam cortados)
          collapsed ? "w-[76px] overflow-visible px-2.5" : "w-[260px] overflow-y-auto overflow-x-hidden px-3"
        )}
      >
        {/* Marca */}
        <Link
          href="/dashboard"
          className={cn("mb-2 flex items-center", collapsed ? "justify-center" : "px-2")}
          onClick={onNavigate}
          aria-label="Luumu: ir para o Dashboard"
        >
          <LuumuLogo size={34} iconOnly={collapsed} />
        </Link>

        {/* Seletor de projeto ativo */}
        <ProjectSwitcher
          projects={projects}
          activeProjectId={activeProjectId}
          workspaceName={workspace.name}
          onNavigate={onNavigate}
          compact={collapsed}
        />

        <nav className="flex flex-col gap-4">
          {NAV.map((group) => (
            <div key={group.title}>
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-8 bg-line" aria-hidden />
              ) : (
                <div className="whitespace-nowrap px-3 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-mut">
                  {group.title}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;

                  if (item.locked) {
                    return (
                      <div
                        key={item.href}
                        aria-disabled="true"
                        title={collapsed ? undefined : "Em breve"}
                        tabIndex={collapsed ? 0 : undefined}
                        className={cn(
                          "group relative flex cursor-not-allowed items-center rounded-lg py-2 text-sm font-medium text-fg-mut/50 outline-none",
                          collapsed ? "justify-center px-0" : "gap-2.5 px-3"
                        )}
                      >
                        <Icon className="size-[18px] shrink-0" />
                        {collapsed ? (
                          <Tip>{item.label} · em breve</Tip>
                        ) : (
                          <>
                            <span className="flex-1 whitespace-nowrap">{item.label}</span>
                            <Lock className="size-3.5 shrink-0" />
                          </>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      aria-label={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center rounded-lg py-2 text-sm font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent/40",
                        collapsed ? "justify-center px-0" : "gap-2.5 px-3",
                        active
                          ? "text-white shadow-[var(--shadow-glow)] [background:var(--grad-roxo)]"
                          : "text-fg-soft hover:bg-surface-brand hover:text-accent"
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" />
                      {collapsed ? (
                        <>
                          {item.badge && (
                            <span className="absolute right-2.5 top-1.5 size-2 rounded-full bg-accent ring-2 ring-bg-elev" aria-hidden />
                          )}
                          <Tip>
                            {item.label}
                            {item.badge ? ` · ${item.badge}` : ""}
                          </Tip>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 whitespace-nowrap">{item.label}</span>
                          {item.badge && (
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-px text-[10px] font-bold",
                                active ? "bg-white/20 text-white" : "bg-surface-brand text-accent"
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

      </aside>

      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          title={`${collapsed ? "Expandir" : "Recolher"} menu (⌘B)`}
          className="absolute -right-3.5 top-[26px] z-30 grid size-7 place-items-center rounded-full border border-line bg-bg-elev text-fg-mut shadow-[var(--shadow-sm)] transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {collapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
        </button>
      )}
    </div>
  );
}
