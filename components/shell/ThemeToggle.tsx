"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/** Injetado no <head> para aplicar o tema antes da hidratação (evita flash). */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('luumu-theme');if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = (localStorage.getItem("luumu-theme") as "light" | "dark") || null;
    const initial =
      stored ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("luumu-theme", next);
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-bg-elev px-3.5 py-2 text-sm font-semibold text-fg-soft transition hover:-translate-y-px hover:border-accent hover:text-accent"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="hidden sm:inline">{theme === "dark" ? "Claro" : "Escuro"}</span>
    </button>
  );
}
