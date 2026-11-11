"use client";

import { useId, useRef, useState } from "react";
import { Check, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/Switch";
import { Input } from "@/components/ui/Input";

/* Controles do editor do plugin de acessibilidade. Genéricos o bastante para o módulo, sem
   pretensão de virar design system (por isso aqui, e não em components/ui). */

/** Linha com título, descrição e uma chave à direita. */
export function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
  aside,
  disabled,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  aside?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-line bg-bg-elev px-3.5 py-3 transition", checked && "border-accent/30 bg-surface-brand/40", disabled && "opacity-50")}>
      {icon && (
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", checked ? "bg-surface-brand text-accent" : "bg-bg-sunken text-fg-mut")}>{icon}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {title}
          {aside}
        </div>
        {description && <div className="mt-0.5 text-xs leading-relaxed text-fg-mut">{description}</div>}
      </div>
      <div className={cn(disabled && "pointer-events-none")}>
        <Switch checked={checked} onChange={onChange} label={title} />
      </div>
    </div>
  );
}

/** Cor: amostras prontas + campo hex + seletor nativo. */
export function ColorField({ value, onChange, presets, label }: { value: string; onChange: (v: string) => void; presets: string[]; label: string }) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  // acompanha mudanças externas (ex.: preset escolhido) sem efeito: o padrão "prop anterior"
  if (prev !== value) {
    setPrev(value);
    setDraft(value);
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((c) => {
        const on = c.toUpperCase() === value.toUpperCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c.toUpperCase())}
            className={cn("grid size-8 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-bg-elev transition", on ? "ring-accent" : "ring-transparent hover:ring-line-strong")}
            style={{ background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.1)" }}
            aria-label={`${label}: ${c}`}
            aria-pressed={on}
          >
            {on && <Check className="size-4" style={{ color: isLight(c) ? "#111827" : "#fff" }} />}
          </button>
        );
      })}
      <label className="relative ml-1 grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-line-strong text-fg-mut hover:border-accent" title="Outra cor">
        <span className="text-base leading-none">+</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`${label}: outra cor`} />
      </label>
      <Input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (/^#[0-9a-f]{6}$/i.test(e.target.value.trim())) onChange(e.target.value.trim().toUpperCase());
        }}
        className="w-28 py-1.5 font-mono text-xs"
        aria-label={`${label} (hex)`}
        spellCheck={false}
      />
    </div>
  );
}

export function isLight(hex: string): boolean {
  const n = parseInt(hex.replace("#", ""), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170;
}

/** Amostras com rótulo (pele, cabelo): botões redondos maiores com dica. */
export function SwatchRow({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.value.toUpperCase() === value.toUpperCase();
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value.toUpperCase())}
            title={o.label}
            className={cn("grid size-9 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-bg-elev transition", on ? "ring-accent" : "ring-transparent hover:ring-line-strong")}
            style={{ background: o.value, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }}
          >
            <span className="sr-only">{o.label}</span>
            {on && <Check className="size-4" style={{ color: isLight(o.value) ? "#111827" : "#fff" }} />}
          </button>
        );
      })}
    </div>
  );
}

/** Opções em pílulas (uma escolhida). */
export function Pills<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: React.ReactNode }[]; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
            value === o.value ? "border-accent bg-surface-brand text-accent" : "border-line-strong text-fg-soft hover:border-accent"
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Lista de valores em chips. Enter, vírgula ou Tab adicionam; colar uma lista (linhas ou
 * vírgulas) adiciona todos; Backspace no campo vazio remove o último.
 */
export function ChipInput({ values, onChange, placeholder, label }: { values: string[]; onChange: (v: string[]) => void; placeholder: string; label: string }) {
  const [draft, setDraft] = useState("");
  const id = useId();
  function add(raw: string) {
    const parts = raw.split(/[\n,;]+/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!parts.length) return;
    const seen = new Set(values.map((v) => v.toLowerCase()));
    onChange([...values, ...parts.filter((p) => !seen.has(p.toLowerCase()) && (seen.add(p.toLowerCase()), true))]);
    setDraft("");
  }
  return (
    <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-line-strong bg-bg-elev px-2 py-1.5 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/15">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-surface-brand py-0.5 pl-2.5 pr-1 text-xs font-semibold text-accent">
          {v}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="grid size-4 place-items-center rounded-full hover:bg-accent/15" aria-label={`Remover ${v}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === "," || e.key === "Tab") && draft.trim()) {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => add(draft)}
        onPaste={(e) => {
          const t = e.clipboardData.getData("text");
          if (/[\n,;]/.test(t)) {
            e.preventDefault();
            add(t);
          }
        }}
        placeholder={values.length ? "" : placeholder}
        aria-label={label}
        className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-fg-mut"
      />
    </div>
  );
}

/** URL de imagem com envio para o Blob (POST /api/accessibility/upload). */
export function ImageField({ value, onChange, label, fallbackUrl, fallbackLabel }: { value: string; onChange: (v: string) => void; label: string; fallbackUrl?: string; fallbackLabel?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/accessibility/upload", { method: "POST", body: fd });
      const d = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !d.url) setError(d.error ?? "Não foi possível enviar.");
      else onChange(d.url);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL arbitrária do cliente (Blob ou site dele), sem otimização
            <img src={value} alt="" className="size-full object-contain p-1" />
          ) : (
            <span className="text-[10px] font-semibold text-fg-mut">sem logo</span>
          )}
        </span>
        <Input value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder="https://…/logo.png" className="py-2 text-xs" aria-label={label} spellCheck={false} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-fg-soft transition hover:border-accent hover:text-accent disabled:opacity-60">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Enviar imagem
        </button>
        {fallbackUrl && value !== fallbackUrl && (
          <button type="button" onClick={() => onChange(fallbackUrl)} className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-fg-soft transition hover:border-accent hover:text-accent">
            {fallbackLabel ?? "Usar padrão"}
          </button>
        )}
        {value && (
          <button type="button" onClick={() => onChange("")} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-fg-mut transition hover:text-erro">
            Remover
          </button>
        )}
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      </div>
      {error && <p className="text-xs text-erro">{error}</p>}
    </div>
  );
}

export function SectionTitle({ icon, title, description, aside }: { icon: React.ReactNode; title: string; description?: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-brand text-accent">{icon}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold tracking-tight">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-fg-mut">{description}</p>}
      </div>
      {aside}
    </div>
  );
}
