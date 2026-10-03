"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CommandPalette } from "./CommandPalette";

const SearchContext = createContext<{ openSearch: () => void }>({ openSearch: () => {} });

/** Abre a busca de qualquer lugar (ex.: o campo do header). */
export const useSearch = () => useContext(SearchContext);

/**
 * Busca global: ⌘K / Ctrl+K abre e fecha; "/" abre quando o foco não está num campo de texto.
 * A paleta só é montada aberta (nada roda enquanto ninguém busca).
 */
export function SearchProvider({ projectName, children }: { projectName: string | null; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSearch = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SearchContext.Provider value={{ openSearch }}>
      {children}
      {open && <CommandPalette projectName={projectName} onClose={() => setOpen(false)} />}
    </SearchContext.Provider>
  );
}
