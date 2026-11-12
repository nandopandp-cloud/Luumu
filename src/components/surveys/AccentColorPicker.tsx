"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { normalizeHexColor } from "@/lib/utils/color";
import { addFavoriteColorAction, removeFavoriteColorAction } from "@/app/(app)/surveys/actions";

/** Cor clara o bastante para pedir check escuro por cima. */
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170;
}

function Swatch({ color, on, onPick, label }: { color: string; on: boolean; onPick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={label}
      aria-pressed={on}
      className={cn("grid size-7 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-bg-elev transition", on ? "ring-accent" : "ring-transparent hover:ring-line-strong")}
      style={{ background: color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.1)" }}
    >
      {on && <Check className="size-3.5" style={{ color: isLight(color) ? "#111827" : "#fff" }} />}
    </button>
  );
}

/**
 * Cor de destaque da pesquisa: cores prontas, favoritas do time (lib/db/color-favorites.ts) e
 * cor personalizada (seletor ou hex) com a estrela para favoritar. As favoritas valem para todas
 * as pesquisas da workspace. `favorites` null = migração 0046 ainda não aplicada.
 */
export function AccentColorPicker({
  value,
  onChange,
  presets,
  favorites: initialFavorites,
}: {
  value: string;
  onChange: (hex: string) => void;
  presets: string[];
  favorites: string[] | null;
}) {
  const toast = useToast();
  const [favorites, setFavorites] = useState<string[] | null>(initialFavorites);
  const [busy, start] = useTransition();
  const hex = normalizeHexColor(value);
  const isFav = !!hex && !!favorites?.includes(hex);
  const same = (c: string) => normalizeHexColor(c) === hex;

  function toggleFavorite(color: string, remove: boolean) {
    if (!favorites) return;
    const before = favorites;
    // otimista: a estrela responde na hora; volta se o servidor recusar
    setFavorites(remove ? favorites.filter((c) => c !== color) : [...favorites, color]);
    start(async () => {
      const r = remove ? await removeFavoriteColorAction(color) : await addFavoriteColorAction(color);
      if (!r.ok) {
        setFavorites(before);
        return toast("error", r.error);
      }
      setFavorites(r.colors);
      toast("success", remove ? "Cor removida das favoritas." : "Cor favoritada. Ela fica disponível em todas as pesquisas.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((c) => (
          <Swatch key={c} color={c} on={same(c)} onPick={() => onChange(c)} label={`Cor ${c}`} />
        ))}
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-fg-mut">
          <Star className="size-3" /> Favoritas do time
        </p>
        {favorites === null ? (
          <p className="text-xs text-fg-mut">Indisponível: falta aplicar a migração 0046 (cores favoritas).</p>
        ) : favorites.length === 0 ? (
          <p className="text-xs text-fg-mut">Nenhuma ainda. Escolha uma cor personalizada abaixo e clique na estrela para favoritar.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {favorites.map((c) => (
              <span key={c} className="group relative">
                <Swatch color={c} on={same(c)} onPick={() => onChange(c)} label={`Cor favorita ${c}`} />
                <button
                  type="button"
                  onClick={() => toggleFavorite(c, true)}
                  disabled={busy}
                  aria-label={`Remover ${c} das favoritas`}
                  className="absolute -right-1.5 -top-1.5 hidden size-4 place-items-center rounded-full bg-fg text-bg-elev shadow group-hover:grid group-focus-within:grid"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="relative grid size-9 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-line-strong" title="Escolher outra cor" style={{ background: hex || "transparent" }}>
          <input type="color" value={hex || "#6B2BD9"} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Escolher cor personalizada" />
        </label>
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="w-28 py-1.5 font-mono text-xs" aria-label="Cor em hexadecimal" spellCheck={false} />
        <button
          type="button"
          disabled={!hex || favorites === null || busy}
          onClick={() => hex && toggleFavorite(hex, isFav)}
          aria-pressed={isFav}
          title={!hex ? "Digite uma cor válida (#RRGGBB)" : isFav ? "Remover das favoritas" : "Favoritar esta cor para usar em outras pesquisas"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-40",
            isFav ? "border-aviso/60 bg-aviso/15 text-[#92400e] dark:text-[#fde047]" : "border-line-strong text-fg-soft hover:border-accent hover:text-accent"
          )}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Star className={cn("size-3.5", isFav && "fill-current")} />}
          {isFav ? "Favorita" : "Favoritar"}
        </button>
      </div>
    </div>
  );
}
