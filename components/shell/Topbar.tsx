"use client";

import { useState } from "react";
import { Bell, Menu, Search, LogOut, ChevronDown } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { logoutAction } from "@/app/(auth)/actions";

export function Topbar({ onMenu, user }: { onMenu: () => void; user: { name: string; email: string } }) {
  const [open, setOpen] = useState(false);
  const firstName = user.name.split(" ")[0];
  const initial = user.name.charAt(0).toUpperCase();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-line bg-[var(--nav-bg)] px-4 backdrop-blur-xl md:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          aria-label="Abrir menu"
          className="grid size-10 place-items-center rounded-xl border border-line-strong bg-bg-elev text-fg lg:hidden"
        >
          <Menu className="size-5" />
        </button>
        <div className="hidden items-center gap-2 rounded-full border border-line bg-bg-elev px-3.5 py-2 text-sm text-fg-mut sm:flex">
          <Search className="size-4" />
          <input
            placeholder="Buscar pesquisas, respostas…"
            className="w-44 bg-transparent outline-none placeholder:text-fg-mut md:w-64"
          />
          <kbd className="ml-auto rounded border border-line-strong px-1.5 text-[10px] text-fg-mut">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          aria-label="Notificações"
          className="relative grid size-10 place-items-center rounded-full border border-line-strong bg-bg-elev text-fg-soft transition hover:text-accent"
        >
          <Bell className="size-[18px]" />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-luumu-verde ring-2 ring-bg-elev" />
        </button>
        <ThemeToggle />
        <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-1 flex items-center gap-2 rounded-full border border-line bg-bg-elev py-1 pl-1 pr-3 transition hover:border-line-strong"
        >
          <span className="grid size-8 place-items-center rounded-full text-sm font-bold text-white [background:var(--grad-marca)]">
            {initial}
          </span>
          <span className="hidden text-sm font-semibold sm:inline">{firstName}</span>
          <ChevronDown className="size-4 text-fg-mut" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 shadow-[var(--shadow-lg)]">
              <div className="border-b border-line px-4 py-2.5">
                <div className="text-sm font-semibold">{user.name}</div>
                <div className="truncate text-xs text-fg-mut">{user.email}</div>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-fg-soft transition hover:bg-bg-sunken"
                >
                  <LogOut className="size-4" /> Sair
                </button>
              </form>
            </div>
          </>
        )}
        </div>
      </div>
    </header>
  );
}
