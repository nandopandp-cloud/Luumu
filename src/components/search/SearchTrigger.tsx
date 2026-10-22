"use client";

import { Search } from "lucide-react";
import { useSearch } from "./SearchProvider";
import { useModKey } from "./CommandPalette";

/** Campo de busca do header: abre a busca em lightbox (o mesmo que ⌘K). */
export function SearchTrigger() {
  const { openSearch } = useSearch();
  const mod = useModKey();
  return (
    <>
      <button
        type="button"
        onClick={openSearch}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className="group hidden items-center gap-2.5 rounded-full border border-line bg-bg-elev py-2 pl-3.5 pr-2 text-sm text-fg-mut transition hover:border-accent/40 hover:shadow-[0_0_0_4px_rgba(107,43,217,.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:flex"
      >
        <Search className="size-4 transition-colors group-hover:text-accent" aria-hidden />
        <span className="w-44 text-left md:w-64">Buscar pesquisas, respostas…</span>
        <kbd className="rounded-md border border-line-strong px-1.5 py-px font-sans text-[10px] font-semibold text-fg-mut">
          {mod} K
        </kbd>
      </button>
      <button
        type="button"
        onClick={openSearch}
        aria-label="Buscar"
        className="grid size-10 place-items-center rounded-xl border border-line-strong bg-bg-elev text-fg-soft sm:hidden"
      >
        <Search className="size-[18px]" aria-hidden />
      </button>
    </>
  );
}
