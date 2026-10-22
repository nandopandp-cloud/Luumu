"use client";

import { useSyncExternalStore } from "react";

/** Injetado no <head> para aplicar o tema antes da hidratação (evita flash). */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('luumu-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

const THEME_EVENT = "luumu-theme-change";

/** Alterna o tema de qualquer lugar (ex.: a busca ⌘K) e avisa o botão do header. */
export function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("luumu-theme", next);
  } catch {}
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
}

export type Theme = "light" | "dark";

const readTheme = (): Theme => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
const subscribe = (cb: () => void) => {
  window.addEventListener(THEME_EVENT, cb);
  return () => window.removeEventListener(THEME_EVENT, cb);
};

/** Tema atual (o atributo data-theme, aplicado no <head> pelo ThemeScript) + troca. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);
  const set = (next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("luumu-theme", next);
    } catch {}
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
  };
  return [theme, set];
}
