"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Layers, Plus, Search } from "lucide-react";
import Link from "@/components/ui/Link";
import { cn } from "@/lib/utils";

/*
  Plataforma escolhida no header, herdada por todas as jornadas (lib/platform.ts): fica num cookie
  por projeto e as telas leem de lá. Um ?host= na URL (link compartilhado) manda naquela tela;
  escolher outra plataforma tira o parâmetro. Trocar zera a pesquisa escolhida (pode não existir
  na outra plataforma).
*/
const PLATFORM_COOKIE = "luumu_platform";

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

export function PlatformPicker({ hosts, projectId, selected }: { hosts: string[]; projectId: string | null; selected: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  // escolhidas: as da URL (link compartilhado), senão as do cookie; só as que existem no projeto
  const current = (sp.get("host") || selected).split(",").filter((h) => hosts.includes(h));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(current);
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

  if (hosts.length < 2 || !projectId) return null;

  function toggleOpen() {
    // abre com a seleção em vigor (descarta o rascunho de uma abertura anterior)
    if (!open) {
      setDraft(current);
      setQ("");
    }
    setOpen((v) => !v);
  }

  function apply(list: string[]) {
    // 1 ano; lido no servidor por todas as telas
    document.cookie = list.length
      ? `${PLATFORM_COOKIE}=${encodeURIComponent(`${projectId}|${list.join(",")}`)}; path=/; max-age=31536000; samesite=lax`
      : `${PLATFORM_COOKIE}=; path=/; max-age=0; samesite=lax`;
    const p = new URLSearchParams(sp.toString());
    p.delete("host");
    p.delete("surveyId");
    setOpen(false);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    router.refresh();
  }

  const toggle = (h: string) => setDraft((d) => (d.includes(h) ? d.filter((x) => x !== h) : [...d, h]));
  const list = hosts.filter((h) => h.toLowerCase().includes(q.trim().toLowerCase()));
  const same = draft.length === current.length && draft.every((h) => current.includes(h));
  const label = !current.length ? "Todas as plataformas" : current.length === 1 ? shortName(current[0]) : `${shortName(current[0])} +${current.length - 1}`;

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Plataformas: ${current.length ? current.join(", ") : "todas"}`}
        title={current.length ? current.join("\n") : "Todas as plataformas"}
        className={cn(
          "inline-flex max-w-[260px] items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition",
          open ? "border-accent/30 bg-surface-brand text-fg" : "border-line-strong bg-bg-elev text-fg-soft hover:border-accent hover:text-accent"
        )}
      >
        <Layers className="size-4 shrink-0 text-accent" aria-hidden />
        <span className="hidden truncate sm:inline">{label}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-fg-mut transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-bg-elev p-2 shadow-[var(--shadow-lg)]">
          <div className="flex items-baseline justify-between px-2.5 pb-1.5 pt-2">
            <span className="text-xs font-medium text-fg-mut">Plataforma atual</span>
            <span className="text-[11px] text-fg-mut">escolha uma ou mais</span>
          </div>
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
          <ul role="listbox" aria-multiselectable="true" aria-label="Plataformas" className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {!q && (
              <Option
                active={!draft.length}
                onClick={() => setDraft([])}
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
              <Option key={h} active={draft.includes(h)} onClick={() => toggle(h)} icon={<PlatformIcon host={h} />} title={shortName(h)} sub={h} />
            ))}
            {!list.length && <li className="px-3 py-3 text-sm text-fg-mut">Nenhuma plataforma encontrada.</li>}
          </ul>
          <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-line pt-1.5">
            <Link
              href="/settings/sdk"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-accent transition hover:bg-bg-sunken"
            >
              <Plus className="size-4" aria-hidden /> Gerenciar plataformas
            </Link>
            <button
              type="button"
              onClick={() => apply(draft)}
              disabled={same}
              className="rounded-xl px-4 py-2 text-sm font-bold text-white transition [background:var(--grad-roxo)] disabled:opacity-40"
            >
              {draft.length > 1 ? `Aplicar (${draft.length})` : "Aplicar"}
            </button>
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
