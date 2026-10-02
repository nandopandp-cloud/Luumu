"use client";

import { useState } from "react";
import { FileText, Table2, FileSpreadsheet, Download, Loader2, Filter } from "lucide-react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";

const FORMATS = [
  { id: "pdf", label: "PDF", desc: "Relatório visual pronto para apresentar", Icon: FileText },
  { id: "xlsx", label: "Excel", desc: "Planilha formatada com filtros", Icon: FileSpreadsheet },
  { id: "csv", label: "CSV", desc: "Dados brutos para planilhas", Icon: Table2 },
] as const;

/**
 * Exporta exatamente o recorte dos filtros do topo da página (plataforma, pesquisa, período).
 * Não tem seletor próprio: antes havia um segundo seletor de pesquisa aqui, que só lia o
 * filtro do topo ao abrir a página e depois seguia independente — dois filtros para a mesma
 * coisa, que podiam discordar.
 */
export function ExportPanel({
  count,
  surveyId,
  surveyName,
  host,
  periodText,
  period,
  from,
  to,
}: {
  /** respostas no recorte atual */
  count: number;
  surveyId?: string;
  surveyName: string;
  host?: string;
  periodText: string;
  period?: string;
  from?: string;
  to?: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const selectedCount = count;

  async function download(format: string) {
    setBusy(format);
    try {
      const qs = new URLSearchParams({ format });
      if (surveyId) qs.set("surveyId", surveyId);
      if (host) qs.set("host", host);
      if (period) qs.set("period", period);
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const res = await fetch(`/api/reports/export?${qs.toString()}`);
      if (!res.ok) throw new Error("Falha ao gerar o arquivo.");
      const blob = await res.blob();
      // nome vem do Content-Disposition
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
    } catch {
      alert("Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardTitle>Exportar respostas</CardTitle>
      <CardSubtitle>Baixe as respostas reais do seu workspace no formato ideal.</CardSubtitle>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-bg-sunken px-4 py-3 text-sm">
        <Filter className="size-4 shrink-0 text-accent" />
        <span className="font-bold">{count.toLocaleString("pt-BR")} {count === 1 ? "resposta" : "respostas"}</span>
        <span className="text-fg-mut">·</span>
        <span className="text-fg-soft">{surveyName}</span>
        {host && (
          <>
            <span className="text-fg-mut">·</span>
            <span className="font-mono text-xs text-fg-soft">{host}</span>
          </>
        )}
        <span className="text-fg-mut">·</span>
        <span className="text-fg-soft">{periodText}</span>
        <span className="ml-auto text-xs text-fg-mut">Ajuste nos filtros do topo</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {FORMATS.map(({ id, label, desc, Icon }) => (
          <button
            key={id}
            onClick={() => download(id)}
            disabled={busy !== null || selectedCount === 0}
            className="group flex flex-col items-start rounded-xl border border-line bg-bg-elev p-4 text-left transition hover:-translate-y-0.5 hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-surface-brand text-accent">
              {busy === id ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
            </span>
            <span className="mt-3 flex items-center gap-1.5 font-bold">
              {label}
              <Download className="size-3.5 text-fg-mut group-hover:text-accent" />
            </span>
            <span className="mt-0.5 text-xs text-fg-mut">{desc}</span>
          </button>
        ))}
      </div>

      {selectedCount === 0 && (
        <p className="mt-3 text-xs text-fg-mut">
          Nenhuma resposta neste recorte. Ajuste a plataforma, a pesquisa ou o período no topo.
        </p>
      )}
    </Card>
  );
}
