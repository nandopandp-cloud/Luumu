"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Layers, Plus, Search } from "lucide-react";
import Link from "@/components/ui/Link";
import { cn } from "@/lib/utils";

/*
  Plataforma cujos dados a página mostra (?host=), no header: é o "onde", separado dos filtros de
  período e pesquisa (o "quando"/"o quê"). Só aparece nas telas que filtram por plataforma.
  Trocar de plataforma zera a pesquisa escolhida (ela pode não existir na outra).
*/

// telas que respeitam ?host=
const HOST_AWARE = ["/dashboard", "/responses", "/insights", "/reports", "/analytics"];

const shortName = (h: string) => {
  const s = h.replace(/^www\./, "").split(".")[0];
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// cor estável por plataforma (mesma plataforma, mesma cor em todas as telas)
const HUES = [262, 200, 152, 28, 340, 222, 96, 300];
const hueOf = (h: string) => HUES[[...h].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length];

/** Ícone da plataforma: camadas na cor dela (a mesma em todas as telas). */
function PlatformIcon({ host, size = "md" }: { host: string; size?: "sm" | "md" }) {
  const hue = hueOf(host);
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-xl", size === "md" ? "size-10" : "size-7 rounded-lg")}
      style={{ background: `hsl(${hue} 85% 60% / 0.14)`, color: `hsl(${hue} 65% 50%)` }}
      aria-hidden
    >
      <Layers className={size === "md" ? "size-5" : "size-4"} />
    </span>
  );
}

export function PlatformPicker({ hosts }: { hosts: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const host = sp.get("host") ?? "";
  const current = hosts.includes(host) ? host : "";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (hosts.length < 2 || !HOST_AWARE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  function pick(h: string) {
    const p = new URLSearchParams(sp.toString());
    if (h) p.set("host", h);
    else p.delete("host");
    p.delete("surveyId");
    setOpen(false);
    setQ("");
    router.push(`${pathname}?${p.toString()}`);
  }

  const list = hosts.filter((h) => h.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Plataforma: ${current || "todas as plataformas"}`}
        title={current || "Todas as plataformas"}
        className={cn(
          "inline-flex max-w-[260px] items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition",
          open ? "border-accent/30 bg-surface-brand text-fg" : "border-line-strong bg-bg-elev text-fg-soft hover:border-accent hover:text-accent"
        )}
      >
        <Layers className="size-4 shrink-0 text-accent" aria-hidden />
        <span className="hidden truncate sm:inline">{current ? shortName(current) : "Todas as plataformas"}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-fg-mut transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-bg-elev p-2 shadow-[var(--shadow-lg)]">
          <div className="px-2.5 pb-1.5 pt-2 text-xs font-medium text-fg-mut">Plataforma atual</div>
          {hosts.length > 6 && (
            <label className="mx-1 mb-1.5 flex items-center gap-2 rounded-xl border border-line px-3 py-2">
              <Search className="size-4 text-fg-mut" aria-hidden />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar plataforma"
                className="w-full bg-transparent text-sm outline-none placeholder:text-fg-mut"
              />
            </label>
          )}
          <ul role="listbox" aria-label="Plataformas" className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {!q && (
              <Option
                active={!current}
                onClick={() => pick("")}
                icon={
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-bg-elev text-accent shadow-[var(--shadow-sm)]">
                    <Layers className="size-5" aria-hidden />
                  </span>
                }
                title="Todas as plataformas"
                sub={`${hosts.length} plataformas somadas`}
              />
            )}
            {list.map((h) => (
              <Option key={h} active={current === h} onClick={() => pick(h)} icon={<PlatformIcon host={h} />} title={shortName(h)} sub={h} />
            ))}
            {!list.length && <li className="px-3 py-3 text-sm text-fg-mut">Nenhuma plataforma encontrada.</li>}
          </ul>
          <div className="mt-1.5 border-t border-line pt-1.5">
            <Link
              href="/settings/sdk"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-accent transition hover:bg-bg-sunken"
            >
              <Plus className="size-4" aria-hidden /> Gerenciar plataformas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Option({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <li role="option" aria-selected={active}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition",
          active ? "bg-surface-brand" : "hover:bg-bg-sunken"
        )}
      >
        {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" aria-hidden />}
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-fg">{title}</span>
          <span className="block truncate text-xs text-fg-mut">{sub}</span>
        </span>
        {active && <Check className="size-4 shrink-0 text-accent" aria-hidden />}
      </button>
    </li>
  );
}
