"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { UsageProvider } from "./UsageProvider";
import { SearchProvider } from "@/components/search/SearchProvider";
import type { WorkspaceUsage } from "@/lib/db/workspace";

export const SIDEBAR_COOKIE = "luumu_sidebar";

export function AppShell({
  children,
  user,
  workspace,
  projects,
  activeProjectId,
  initialCollapsed = false,
  usage,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; avatarUrl: string | null };
  workspace: { name: string; plan: string; logoUrl: string | null };
  projects: { id: string; name: string; logoUrl: string | null }[];
  activeProjectId: string | null;
  /** preferência salva (cookie lido no servidor, para a página já nascer no tamanho certo) */
  initialCollapsed?: boolean;
  /** uso do plano para o card da sidebar (promise: não atrasa a página) */
  usage?: Promise<WorkspaceUsage | null>;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      // 1 ano; lido pelo layout (app/(app)/layout.tsx) na próxima renderização no servidor
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  // ⌘B / Ctrl+B recolhe/expande (fora de campos de texto, onde o atalho é de formatação)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "b" || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <UsageProvider initial={usage}>
    <SearchProvider projectName={projects.find((p) => p.id === activeProjectId)?.name ?? null}>
      <div className="flex min-h-screen">
        {/* Sidebar desktop */}
        {/*
          z-40: acima da Topbar (sticky, z-30), que vem depois no HTML e cobria o botão de
          recolher/expandir que fica na borda da sidebar.
        */}
        <div className="sticky top-0 z-40 hidden h-screen shrink-0 lg:block">
          <Sidebar
            workspace={workspace}
            projects={projects}
            activeProjectId={activeProjectId}
            collapsed={collapsed}
            onToggle={toggle}
          />
        </div>

        {/* Sidebar mobile (drawer) */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 h-full shadow-[var(--shadow-lg)]">
              <Sidebar
                workspace={workspace}
                projects={projects}
                activeProjectId={activeProjectId}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Conteúdo */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setMobileOpen(true)} user={user} />
          {/* com a bandeja recolhida, o conteúdo ganha o espaço de volta */}
          <main className={cn("mx-auto w-full flex-1 px-4 py-7 md:px-8", collapsed ? "max-w-[1480px]" : "max-w-[1280px]")}>
            {children}
          </main>
        </div>
      </div>
    </SearchProvider>
    </UsageProvider>
  );
}
