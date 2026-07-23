"use client";

import { useState } from "react";
import { FileText, Table2, FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";

interface SurveyOpt {
  id: string;
  name: string;
  responseCount: number;
}

const FORMATS = [
  { id: "pdf", label: "PDF", desc: "Relatório visual pronto para apresentar", Icon: FileText },
  { id: "xlsx", label: "Excel", desc: "Planilha formatada com filtros", Icon: FileSpreadsheet },
  { id: "csv", label: "CSV", desc: "Dados brutos para planilhas", Icon: Table2 },
] as const;

export function ExportPanel({ surveys, totalResponses }: { surveys: SurveyOpt[]; totalResponses: number }) {
  const [surveyId, setSurveyId] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);

  const selectedCount = surveyId
    ? surveys.find((s) => s.id === surveyId)?.responseCount ?? 0
    : totalResponses;

  async function download(format: string) {
    setBusy(format);
    try {
      const qs = new URLSearchParams({ format });
      if (surveyId) qs.set("surveyId", surveyId);
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

      <div className="mt-4 max-w-sm">
        <label className="mb-1.5 block text-sm font-semibold text-fg-soft">Pesquisa</label>
        <Select value={surveyId} onChange={(e) => setSurveyId(e.target.value)}>
          <option value="">Todas as pesquisas ({totalResponses} respostas)</option>
          {surveys.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.responseCount})
            </option>
          ))}
        </Select>
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
          Nenhuma resposta para exportar {surveyId ? "nesta pesquisa" : "ainda"}.
        </p>
      )}
    </Card>
  );
}
