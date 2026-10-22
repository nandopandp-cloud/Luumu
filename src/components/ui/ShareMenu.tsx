"use client";

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, FileText, Link2, Loader2, Share2, Table2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const FORMATS = [
  { id: "pdf", label: "PDF", desc: "Relatório visual", Icon: FileText },
  { id: "xlsx", label: "Excel (.xlsx)", desc: "Planilha formatada", Icon: FileSpreadsheet },
  { id: "csv", label: "CSV", desc: "Dados brutos", Icon: Table2 },
] as const;

/** Baixa o arquivo devolvido pela rota de exportação, com o nome que ela sugere. */
export async function downloadExport(url: string, fallbackName: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao gerar o arquivo.");
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/**
 * Compartilhar: copia o link da tela ou exporta o que ela mostra em PDF, Excel ou CSV.
 * `exportUrl(formato)` monta o endereço da rota de exportação com os filtros atuais.
 */
export function ShareMenu({ exportUrl }: { exportUrl: (format: string) => string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("success", "Link copiado.");
      setOpen(false);
    } catch {
      toast("error", "Não foi possível copiar o link.");
    }
  }

  async function exportAs(format: string) {
    setBusy(format);
    try {
      await downloadExport(exportUrl(format), `luumu.${format}`);
      setOpen(false);
    } catch {
      toast("error", "Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  const item = "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-bg-sunken disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        <Share2 className="size-4" /> Compartilhar
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1.5 w-60 overflow-hidden rounded-xl border border-line bg-bg-elev py-1.5 shadow-[var(--shadow-lg)]">
          <button role="menuitem" type="button" onClick={copy} className={item}>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-bg-sunken text-fg-soft">
              <Link2 className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Copiar link</span>
              <span className="block text-xs text-fg-mut">Com os mesmos filtros</span>
            </span>
          </button>
          <div className="mx-3.5 my-1 border-t border-line" />
          <div className="px-3.5 pb-1 pt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-mut">Exportar</div>
          {FORMATS.map(({ id, label, desc, Icon }) => (
            <button key={id} role="menuitem" type="button" onClick={() => exportAs(id)} disabled={busy !== null} className={item}>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-brand text-accent">
                {busy === id ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-fg-mut">{desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
