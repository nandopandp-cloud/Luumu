"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  children,
  user,
  workspace,
}: {
  children: React.ReactNode;
  user: { name: string; email: string };
  workspace: { name: string; plan: string; logoUrl: string | null };
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <Sidebar workspace={workspace} />
      </div>

      {/* Sidebar mobile (drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 h-full shadow-[var(--shadow-lg)]">
            <Sidebar workspace={workspace} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} user={user} />
        <main className={cn("mx-auto w-full max-w-[1280px] flex-1 px-4 py-7 md:px-8")}>
          {children}
        </main>
      </div>
    </div>
  );
}
