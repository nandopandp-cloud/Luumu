"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "@/components/ui/Link";
import { Menu, LogOut, ChevronDown, UserRound, Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeToggle";
import { PlatformPicker } from "./PlatformPicker";
import { cn } from "@/lib/utils";
import { PlanUsageMenu } from "./PlanUsageMenu";
import { SearchTrigger } from "@/components/search/SearchTrigger";
import { logoutAction } from "@/app/(auth)/actions";

export function Topbar({
  onMenu,
  user,
  hosts = [],
  projectId = null,
  platform = "",
}: {
  onMenu: () => void;
  user: { name: string; email: string; avatarUrl: string | null };
  hosts?: string[];
  projectId?: string | null;
  /** plataforma escolhida (cookie), "" = todas */
  platform?: string;
}) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useTheme();
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
        <SearchTrigger />
      </div>

      <div className="flex items-center gap-2">
        <PlanUsageMenu />
        {/* lê ?host= da URL (useSearchParams pede um limite de Suspense) */}
        <Suspense>
          <PlatformPicker hosts={hosts} projectId={projectId} selected={platform} />
        </Suspense>
        <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-1 flex items-center gap-2 rounded-full border border-line bg-bg-elev py-1 pl-1 pr-3 transition hover:border-line-strong"
        >
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-full object-cover"
            />
          ) : (
            <span className="grid size-8 place-items-center rounded-full text-sm font-bold text-white [background:var(--grad-marca)]">
              {initial}
            </span>
          )}
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
              <Link
                href="/settings/profile"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-fg-soft transition hover:bg-bg-sunken"
              >
                <UserRound className="size-4" /> Meu perfil
              </Link>
              <div className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="text-sm font-medium text-fg-soft">Aparência</span>
                <div role="radiogroup" aria-label="Aparência" className="inline-flex rounded-lg bg-bg-sunken p-0.5">
                  {(
                    [
                      ["light", "Claro", Sun],
                      ["dark", "Escuro", Moon],
                    ] as const
                  ).map(([v, label, Icon]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={theme === v}
                      aria-label={label}
                      title={label}
                      onClick={() => setTheme(v)}
                      className={cn("grid size-7 place-items-center rounded-md transition", theme === v ? "bg-bg-elev text-accent shadow-[var(--shadow-sm)]" : "text-fg-mut hover:text-fg")}
                    >
                      <Icon className="size-3.5" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="my-1 border-t border-line" />
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
