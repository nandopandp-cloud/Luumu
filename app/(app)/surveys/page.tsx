"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/Tabs";
import { surveys, type SurveyStatus } from "@/lib/mock/surveys";

const statusTone: Record<SurveyStatus, "success" | "warn" | "neutral" | "brand"> = {
  ativa: "success",
  pausada: "warn",
  encerrada: "neutral",
  rascunho: "brand",
};

type Filter = "todas" | SurveyStatus;

export default function SurveysPage() {
  const [filter, setFilter] = useState<Filter>("todas");
  const [q, setQ] = useState("");

  const filtered = surveys.filter(
    (s) =>
      (filter === "todas" || s.status === filter) &&
      s.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        eyebrow="Pesquisas"
        title="Pesquisas"
        description="Crie, dispare e acompanhe pesquisas de CSAT, NPS, CES e muito mais."
        actions={
          <Button href="/surveys/new" size="sm">
            <Plus className="size-4" /> Nova pesquisa
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "todas", label: "Todas" },
            { value: "ativa", label: "Ativas" },
            { value: "rascunho", label: "Rascunhos" },
            { value: "pausada", label: "Pausadas" },
            { value: "encerrada", label: "Encerradas" },
          ]}
        />
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-mut" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pesquisa…"
            className="pl-9"
          />
        </div>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wide text-fg-mut">
                <th className="px-6 py-3 font-semibold">Pesquisa</th>
                <th className="px-3 py-3 font-semibold">Tipo</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Canal</th>
                <th className="px-3 py-3 font-semibold">Respostas</th>
                <th className="px-3 py-3 font-semibold">Taxa</th>
                <th className="px-3 py-3 font-semibold">Score</th>
                <th className="px-6 py-3 text-right font-semibold">Atualizada</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="group border-b border-line last:border-0 transition-colors hover:bg-bg-sunken/50"
                >
                  <td className="px-6 py-3.5">
                    <Link href={`/surveys/${s.id}/builder`} className="font-semibold hover:text-accent">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3.5">
                    <Badge tone="brand" dot={false}>{s.type}</Badge>
                  </td>
                  <td className="px-3 py-3.5">
                    <Badge tone={statusTone[s.status]}>{s.status}</Badge>
                  </td>
                  <td className="px-3 py-3.5 text-fg-soft">{s.channel}</td>
                  <td className="px-3 py-3.5 text-fg-soft">{s.responses}</td>
                  <td className="px-3 py-3.5 text-fg-soft">{s.rate}%</td>
                  <td className="px-3 py-3.5 font-bold text-luumu-roxo">{s.score ?? "—"}</td>
                  <td className="px-6 py-3.5 text-right text-fg-mut">
                    <span className="mr-2">{s.updatedAt}</span>
                    <button className="opacity-0 transition group-hover:opacity-100" aria-label="Ações">
                      <MoreHorizontal className="inline size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
