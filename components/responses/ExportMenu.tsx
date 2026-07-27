"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, FileSpreadsheet, Table2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const FORMATS = [
  { id: "pdf", label: "PDF", desc: "Relatório visual", Icon: FileText },
  { id: "xlsx", label: "Excel (.xlsx)", desc: "Planilha formatada", Icon: FileSpreadsheet },
  { id: "csv", label: "CSV", desc: "Dados brutos", Icon: Table2 },
] as const;

/** Botão "Exportar" com dropdown de formato (PDF/XLSX/CSV), baixa via /api/reports/export. */
export function ExportMenu({ surveyId }: { surveyId?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function download(format: string) {
    setBusy(format);
    try {
      const qs = new URLSearchParams({ format });
      if (surveyId) qs.set("surveyId", surveyId);
      const res = await fetch(`/api/reports/export?${qs.toString()}`);
      if (!res.ok) throw new Error("Falha ao gerar o arquivo.");
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `relatorio.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      alert("Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
        <Download className="size-4" /> Exportar
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-line bg-bg-elev py-1.5 shadow-[var(--shadow-lg)]">
          {FORMATS.map(({ id, label, desc, Icon }) => (
            <button
              key={id}
              onClick={() => download(id)}
              disabled={busy !== null}
              className={cn(
                "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-bg-sunken disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-brand text-accent">
                {busy === id ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
              </span>
              <span className="min-w-0">
                <div className="text-sm font-semibold">{label}</div>
                <div className="text-xs text-fg-mut">{desc}</div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
