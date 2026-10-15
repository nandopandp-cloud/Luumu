"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, FileDown, FileText, Info, Loader2, Pencil, RefreshCw, Save, Star, X, XCircle } from "lucide-react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { formatDelta, formatValue, METRIC_META, type GoalKey, type GoalStatus, type Metric } from "@/lib/product-report/indicators";
import { periodShortLabel, shiftPeriod } from "@/lib/product-report/period";
import type { IndicatorRow, ReportModel } from "@/lib/product-report/model";
import { generateReportAction, saveGoalsAction, saveNotesAction, syncAction } from "@/app/(app)/product-report/actions";
import { ProductReportCharts } from "./ProductReportCharts";
import { ProductReportSettings, type SettingsValue } from "./ProductReportSettings";

export interface GeneratedReportItem {
  id: string;
  period: string;
  label: string;
  createdAt: string;
  trigger: string;
}

const STATUS: Record<GoalStatus, { label: string; tone: "success" | "error" | "neutral" | "warn" }> = {
  met: { label: "Atingiu", tone: "success" },
  missed: { label: "Abaixo da meta", tone: "error" },
  no_target: { label: "Sem meta", tone: "neutral" },
  no_data: { label: "Sem dado", tone: "warn" },
};

const fmtTs = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** "12,5" ou "12.5" → 12.5; vazio → null; inválido → undefined */
function parseNum(s: string): number | null | undefined {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

const linkCls =
  "inline-flex items-center gap-2 rounded-full border border-line-strong px-3.5 py-2 text-[13px] font-semibold text-fg transition hover:border-accent hover:text-accent";

export function ProductReportView({
  model,
  periodOptions,
  settings,
  projects,
  reports,
}: {
  model: ReportModel;
  periodOptions: { value: string; label: string }[];
  settings: SettingsValue;
  projects: { id: string; name: string }[];
  reports: GeneratedReportItem[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <Toolbar model={model} periodOptions={periodOptions} />
      <Alerts alerts={model.alerts} />
      <Summary model={model} />
      <GoalsTables model={model} />
      <ProductReportCharts model={model} />
      <Notes key={model.period} period={model.period} initial={model.notes} />
      <ProductReportSettings model={model} settings={settings} projects={projects} />
      <ReportHistory reports={reports} />
    </div>
  );
}

/* ---------- barra superior ---------- */

function Toolbar({ model, periodOptions }: { model: ReportModel; periodOptions: { value: string; label: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<"sync" | "report" | null>(null);
  const [, startTransition] = useTransition();
  const q = `period=${encodeURIComponent(model.period)}`;

  const run = (kind: "sync" | "report") => {
    setBusy(kind);
    startTransition(async () => {
      const r = kind === "sync" ? await syncAction(model.period) : await generateReportAction(model.period);
      setBusy(null);
      if (!r.ok) return toast("error", r.error);
      toast("success", kind === "sync" ? "Indicadores atualizados." : "Relatório gerado e salvo no histórico.");
      router.refresh();
    });
  };

  return (
    <Card className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <div className="w-full sm:w-80">
          <Select value={model.period} onChange={(e) => router.push(`/product-report?period=${e.target.value}`)} aria-label="Quinzena de referência">
            {periodOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="text-xs text-fg-mut">
          <div>{model.dates}</div>
          <div>{model.sync.at ? `Luumu atualizada em ${fmtTs(model.sync.at)}` : "Ainda não atualizada na Luumu"}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => run("sync")} disabled={busy !== null}>
          {busy === "sync" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Atualizar indicadores
        </Button>
        <a className={linkCls} href={`/api/product-report/export?format=html&${q}`} target="_blank" rel="noopener">
          <FileText className="size-4" /> Revisar HTML
        </a>
        <a className={linkCls} href={`/api/product-report/export?format=pdf&${q}`}>
          <FileDown className="size-4" /> PDF
        </a>
        <Button size="sm" onClick={() => run("report")} disabled={busy !== null}>
          {busy === "report" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Gerar relatório
        </Button>
      </div>
    </Card>
  );
}

/* ---------- alertas ---------- */

function Alerts({ alerts }: { alerts: ReportModel["alerts"] }) {
  if (!alerts.length) return null;
  const order = { error: 0, warn: 1, info: 2 };
  const sorted = [...alerts].sort((a, b) => order[a.tone] - order[b.tone]);
  const Icon = { error: XCircle, warn: AlertTriangle, info: Info };
  const color = { error: "text-erro", warn: "text-aviso", info: "text-info" };
  return (
    <Card className="p-5">
      <CardTitle className="mb-2 text-sm">Pontos de atenção nos dados</CardTitle>
      <ul className="flex flex-col gap-1.5">
        {sorted.map((a, i) => {
          const I = Icon[a.tone];
          return (
            <li key={i} className="flex items-start gap-2 text-sm text-fg-soft">
              <I className={cn("mt-0.5 size-4 shrink-0", color[a.tone])} />
              {a.text}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------- resumo executivo ---------- */

function StatusBadge({ status }: { status: GoalStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

function Delta({ row }: { row: IndicatorRow }) {
  if (row.delta === null) return <span className="text-xs text-fg-mut">sem comparação com a quinzena anterior</span>;
  const tone = row.delta > 0 ? "text-sucesso" : row.delta < 0 ? "text-erro" : "text-fg-mut";
  return (
    <span className={cn("text-xs font-semibold", tone)}>
      {formatDelta(row.delta, row.unit)} <span className="font-normal text-fg-mut">vs. quinzena anterior</span>
    </span>
  );
}

function SummaryCard({ row, title, hint, big = false }: { row: IndicatorRow; title: string; hint?: string; big?: boolean }) {
  return (
    <Card className={cn("flex flex-col gap-2 p-5", big && "border-accent/40 bg-surface-brand/40", row.status === "missed" && "border-erro/40")}>
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-mut">
          {big && <Star className="size-3.5 text-accent" />}
          {title}
        </span>
        <StatusBadge status={row.status} />
      </div>
      <div className={cn("font-display font-extrabold leading-none tracking-tight", big ? "text-[44px] text-accent" : "text-[32px]")}>
        {formatValue(row.value, row.unit)}
      </div>
      <div className="text-xs text-fg-mut">
        Meta {formatValue(row.target, row.unit)}
        {row.targetFrom && ` (mantida de ${periodShortLabel(row.targetFrom)})`}
        {hint && ` · ${hint}`}
      </div>
      <Delta row={row} />
    </Card>
  );
}

function Summary({ model }: { model: ReportModel }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard row={model.northStar} title="North Star" big hint={`pesos ${model.weights.csat}/${model.weights.adherence}/${model.weights.usage}`} />
      {model.components.map((c) => (
        <SummaryCard
          key={c.metric}
          row={c.row}
          title={METRIC_META[c.metric].label}
          hint={c.result === null ? undefined : `${formatValue(c.result, "pts")} de ${c.weight} pts`}
        />
      ))}
    </div>
  );
}

/* ---------- tabelas de metas e resultados ---------- */

type Drafts = { cur: Record<string, string>; next: Record<string, string> };

const ownGoal = (r: IndicatorRow, which: "cur" | "next") => {
  const v = which === "cur" ? r.target : r.nextTarget;
  const from = which === "cur" ? r.targetFrom : r.nextTargetFrom;
  return from === null && v !== null ? v : null;
};

function GoalsTables({ model }: { model: ReportModel }) {
  const router = useRouter();
  const toast = useToast();
  const rows = model.groups.flatMap((g) => g.rows);
  const initial = (): Drafts => ({
    cur: Object.fromEntries(rows.map((r) => [r.key, ownGoal(r, "cur")?.toString().replace(".", ",") ?? ""])),
    next: Object.fromEntries(rows.map((r) => [r.key, ownGoal(r, "next")?.toString().replace(".", ",") ?? ""])),
  });
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Drafts>(initial);
  const [pending, startTransition] = useTransition();

  const diff = (which: "cur" | "next") => {
    const out: Partial<Record<GoalKey, number | null>> = {};
    for (const r of rows) {
      const v = parseNum(drafts[which][r.key]);
      if (v === undefined) throw new Error(`Valor inválido em ${r.label}.`);
      if (v !== ownGoal(r, which)) out[r.key] = v;
    }
    return out;
  };

  const save = () =>
    startTransition(async () => {
      let cur, next;
      try {
        cur = diff("cur");
        next = diff("next");
      } catch (e) {
        return toast("error", (e as Error).message);
      }
      const calls = [];
      if (Object.keys(cur).length) calls.push(saveGoalsAction({ period: model.period, goals: cur }));
      if (Object.keys(next).length) calls.push(saveGoalsAction({ period: shiftPeriod(model.period, 1), goals: next }));
      const res = await Promise.all(calls);
      const err = res.find((r) => !r.ok);
      if (err && !err.ok) return toast("error", err.error);
      toast("success", calls.length ? "Metas salvas." : "Nada mudou.");
      setEditing(false);
      router.refresh();
    });

  const componentOf = (key: GoalKey) => model.components.find((c) => key === `ns.${c.metric}`);

  return (
    <Card padded={false}>
      <div className="flex flex-col gap-3 p-6 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Metas e resultados</CardTitle>
          <CardSubtitle>
            Meta vazia herda a da quinzena anterior. &quot;Nova meta&quot; vale para {periodShortLabel(shiftPeriod(model.period, 1))}.
          </CardSubtitle>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDrafts(initial());
                setEditing(false);
              }}
              disabled={pending}
            >
              <X className="size-4" /> Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar metas
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // parte do que está salvo agora (a página pode ter mudado de quinzena ou recarregado)
              setDrafts(initial());
              setEditing(true);
            }}
          >
            <Pencil className="size-4" /> Editar metas
          </Button>
        )}
      </div>

      {model.groups.map((g) => (
        <div key={g.key} className="px-6 pb-5">
          <h4 className="mb-2 mt-3 text-sm font-bold text-accent">{g.title}</h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-mut">
                  <th className="py-2 pr-3 font-semibold">Indicador</th>
                  <th className="py-2 pr-3 text-right font-semibold">Meta</th>
                  <th className="py-2 pr-3 text-right font-semibold">Realizado</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 text-right font-semibold">Anterior</th>
                  <th className="py-2 pr-3 text-right font-semibold">Variação</th>
                  <th className="py-2 pr-3 text-right font-semibold">Nova meta</th>
                  <th className="py-2 font-semibold">Fonte</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => {
                  const comp = componentOf(r.key);
                  const label = g.key === "produto" ? r.label : METRIC_META[r.key.split(".")[1] as Metric].label;
                  return (
                    <tr key={r.key} className={cn("border-b border-line/70 align-top", r.status === "missed" && "bg-erro/5")}>
                      <td className="py-2.5 pr-3">
                        <span className={cn("font-semibold", r.key === "northstar" && "text-accent")}>{label}</span>
                        <span className="ml-1 text-xs text-fg-mut">({r.unit})</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {editing ? (
                          <GoalInput value={drafts.cur[r.key]} placeholder={r.targetFrom ? formatValue(r.target, r.unit) : ""} onChange={(v) => setDrafts((d) => ({ ...d, cur: { ...d.cur, [r.key]: v } }))} />
                        ) : (
                          <GoalText value={r.target} from={r.targetFrom} unit={r.unit} />
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold">{formatValue(r.value, r.unit)}</td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-2.5 pr-3 text-right text-fg-soft">{formatValue(r.prev, r.unit)}</td>
                      <td className={cn("py-2.5 pr-3 text-right", r.delta !== null && r.delta < 0 ? "text-erro" : r.delta ? "text-sucesso" : "text-fg-mut")}>
                        {formatDelta(r.delta, r.unit)}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {editing ? (
                          <GoalInput value={drafts.next[r.key]} placeholder={r.nextTargetFrom ? formatValue(r.nextTarget, r.unit) : ""} onChange={(v) => setDrafts((d) => ({ ...d, next: { ...d.next, [r.key]: v } }))} />
                        ) : (
                          <GoalText value={r.nextTarget} from={r.nextTargetFrom} unit={r.unit} />
                        )}
                      </td>
                      <td className="max-w-[260px] py-2.5 text-xs text-fg-mut">
                        {comp ? `Peso ${comp.weight} · resultado ${formatValue(comp.result, "pts")} pts` : r.source ?? "—"}
                        {r.detail && <div>{r.detail}</div>}
                        {r.updatedAt && !comp && <div>{fmtTs(r.updatedAt)}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </Card>
  );
}

function GoalText({ value, from, unit }: { value: number | null; from: string | null; unit: IndicatorRow["unit"] }) {
  return (
    <span>
      {formatValue(value, unit)}
      {from && value !== null && <span className="block text-[10px] text-fg-mut">de {periodShortLabel(from)}</span>}
    </span>
  );
}

function GoalInput({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (v: string) => void }) {
  return <Input value={value} placeholder={placeholder} inputMode="decimal" onChange={(e) => onChange(e.target.value)} className="ml-auto w-24 px-2.5 py-1.5 text-right" />;
}

/* ---------- observações ---------- */

function Notes({ period, initial }: { period: string; initial: string }) {
  const toast = useToast();
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = text !== initial;
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <CardTitle>Observações e conclusões executivas</CardTitle>
          <CardSubtitle>Entram no relatório como estão escritas aqui.</CardSubtitle>
        </div>
        <Button
          size="sm"
          disabled={!dirty || pending}
          onClick={() =>
            startTransition(async () => {
              const r = await saveNotesAction({ period, notes: text });
              if (!r.ok) return toast("error", r.error);
              toast("success", "Observações salvas.");
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar
        </Button>
      </div>
      <Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Principais resultados, riscos e próximos passos da quinzena…" />
    </Card>
  );
}

/* ---------- histórico de relatórios ---------- */

function ReportHistory({ reports }: { reports: GeneratedReportItem[] }) {
  return (
    <Card padded={false}>
      <div className="p-6 pb-3">
        <CardTitle>Relatórios gerados</CardTitle>
        <CardSubtitle>Cada relatório guarda os números, metas e observações do momento em que foi gerado.</CardSubtitle>
      </div>
      {reports.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-fg-mut">Nenhum relatório gerado ainda.</p>
      ) : (
        <ul className="divide-y divide-line">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">{r.label}</div>
                <div className="text-xs text-fg-mut">
                  Gerado em {fmtTs(r.createdAt)}
                  {r.trigger === "cron" ? " · automático" : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <a className={linkCls} href={`/api/product-report/export?format=html&report=${encodeURIComponent(r.id)}`} target="_blank" rel="noopener">
                  <FileText className="size-4" /> HTML
                </a>
                <a className={linkCls} href={`/api/product-report/export?format=pdf&report=${encodeURIComponent(r.id)}`}>
                  <FileDown className="size-4" /> PDF
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
