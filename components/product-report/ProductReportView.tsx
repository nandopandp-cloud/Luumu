"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertTriangle, CalendarRange, Check, ChevronRight, ClipboardCopy, FileDown, FileText, Info, Loader2, Mail, Pencil, RefreshCw, Share2, SlidersHorizontal, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { downloadExport } from "@/components/ui/ShareMenu";
import { cn } from "@/lib/utils";
import { formatCompact, type GoalKey, type GoalStatus } from "@/lib/product-report/indicators";
import { shiftPeriod, periodCode } from "@/lib/product-report/period";
import type { IndicatorRow, ReportModel } from "@/lib/product-report/model";
import { buildCharts, chartCardHtml, type ChartSpec } from "@/lib/product-report/charts";
import { formatLongTs, introText, REPORT_STATUS, type ReportStatus } from "@/lib/product-report/html";
import { GROUP_STYLE, rowName } from "@/lib/product-report/render-html";
import { generateReportAction, saveGoalsAction, saveManualAction, saveTextsAction, syncAction } from "@/app/(app)/product-report/actions";
import { buildEmailHtml, copyRichHtml, emailDocument } from "./email-export";
import { ProductReportSettings, type SettingsValue } from "./ProductReportSettings";

export interface GeneratedReportItem {
  id: string;
  period: string;
  label: string;
  createdAt: string;
  trigger: string;
}

/** Rascunhos do modo Editar: meta da quinzena, nova meta e realizado ajustado. */
type Drafts = { cur: Record<string, string>; next: Record<string, string>; real: Record<string, string> };

const fmtTs = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const toText = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));

/** "12,5" ou "12.5" → 12.5; vazio → null; inválido → undefined */
function parseNum(s: string): number | null | undefined {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Meta definida na própria quinzena (as herdadas não contam como edição). */
const ownGoal = (r: IndicatorRow, which: "cur" | "next") => {
  const v = which === "cur" ? r.target : r.nextTarget;
  const from = which === "cur" ? r.targetFrom : r.nextTargetFrom;
  return from === null && v !== null ? v : null;
};

const exportUrl = (format: "html" | "pdf", period: string, extra = "") => `/api/product-report/export?format=${format}&period=${encodeURIComponent(period)}${extra}`;

export function ProductReportView({
  model,
  status,
  periodOptions,
  settings,
  projects,
  reports,
}: {
  model: ReportModel;
  status: ReportStatus;
  periodOptions: { value: string; label: string }[];
  settings: SettingsValue;
  projects: { id: string; name: string }[];
  reports: GeneratedReportItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const rows = model.groups.flatMap((g) => g.rows);
  const initial = (): Drafts => ({
    cur: Object.fromEntries(rows.map((r) => [r.key, toText(ownGoal(r, "cur"))])),
    next: Object.fromEntries(rows.map((r) => [r.key, toText(ownGoal(r, "next"))])),
    // só o que você ajustou aparece preenchido; vazio = valor automático (Luumu/planilha)
    real: Object.fromEntries(rows.map((r) => [r.key, r.overridden ? toText(r.value) : ""])),
  });
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Drafts>(initial);
  const [intro, setIntro] = useState(model.intro);
  const [saving, startSaving] = useTransition();
  const charts = useMemo(() => buildCharts(model), [model]);

  const startEdit = () => {
    // parte do que está salvo agora (a página pode ter trocado de quinzena ou recarregado)
    setDrafts(initial());
    setIntro(model.intro);
    setEditing(true);
  };

  const saveEdit = () =>
    startSaving(async () => {
      const diff = (which: "cur" | "next") => {
        const out: Partial<Record<GoalKey, number | null>> = {};
        for (const r of rows) {
          const v = parseNum(drafts[which][r.key]);
          if (v === undefined) throw new Error(`Valor inválido em ${r.label}.`);
          if (v !== ownGoal(r, which)) out[r.key] = v;
        }
        return out;
      };
      let cur, next;
      const real: Partial<Record<GoalKey, number | null>> = {};
      try {
        cur = diff("cur");
        next = diff("next");
        for (const r of rows) {
          const v = parseNum(drafts.real[r.key]);
          if (v === undefined) throw new Error(`Valor inválido em ${r.label}.`);
          if (v !== (r.overridden ? r.value : null)) real[r.key] = v;
        }
      } catch (e) {
        return toast("error", (e as Error).message);
      }
      const calls = [];
      if (Object.keys(real).length) calls.push(saveManualAction({ period: model.period, values: real }));
      if (Object.keys(cur).length) calls.push(saveGoalsAction({ period: model.period, goals: cur }));
      if (Object.keys(next).length) calls.push(saveGoalsAction({ period: shiftPeriod(model.period, 1), goals: next }));
      if (intro !== model.intro) calls.push(saveTextsAction({ period: model.period, intro }));
      const res = await Promise.all(calls);
      const err = res.find((r) => !r.ok);
      if (err && !err.ok) return toast("error", err.error);
      toast("success", calls.length ? "Alterações salvas." : "Nada mudou.");
      setEditing(false);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5 pb-6">
      <Header
        model={model}
        status={status}
        periodOptions={periodOptions}
        editing={editing}
        saving={saving}
        onEdit={startEdit}
        onCancel={() => setEditing(false)}
        onSave={saveEdit}
      />

      <DataNotice model={model} />

      {/* mensagem de abertura */}
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-bg-elev p-4">
        <Avatar author={model.author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">{model.author?.name ?? "Gestão de Produto"}</span>
            <span className="text-xs text-fg-mut">{formatLongTs(model.editedAt ?? model.builtAt)}</span>
          </div>
          {editing ? (
            <Textarea rows={3} className="mt-2" value={intro} placeholder={introText({ intro: "", period: model.period })} onChange={(e) => setIntro(e.target.value)} />
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-fg-soft">{introText(model)}</p>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-[17px] font-bold">1. Resumo dos Indicadores</h2>
        <div className="flex flex-col gap-3.5">
          {model.groups.map((g) => (
            <SummaryTable
              key={g.key}
              group={g}
              code={model.code}
              editing={editing}
              drafts={drafts}
              onDraft={(which, key, v) => setDrafts((d) => ({ ...d, [which]: { ...d[which], [key]: v } }))}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[17px] font-bold">2. Evolução dos Indicadores</h2>
        {/* mesmo cartão do HTML/PDF exportado (lib/product-report/charts.ts): o que se vê aqui é o que sai no arquivo */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {charts.map((c) => (
            <div key={c.id} className="flex flex-col gap-2">
              <div dangerouslySetInnerHTML={{ __html: chartCardHtml(c) }} />
              {editing && <ChartEditor key={`${c.id}:${model.builtAt}`} spec={c} model={model} />}
            </div>
          ))}
        </div>
      </section>

      <Notes key={model.period} period={model.period} initial={model.notes} />

      {editing && (
        <section className="flex flex-col gap-4 rounded-2xl border border-dashed border-accent/40 bg-surface-brand/30 p-4">
          <div>
            <h2 className="text-[15px] font-bold">Dados, fontes e histórico</h2>
            <p className="text-xs text-fg-mut">Visível só no modo de edição. Nada daqui aparece no report exportado.</p>
          </div>
          <SyncCard model={model} />
          <ProductReportSettings settings={settings} projects={projects} />
          <ReportHistory reports={reports} />
        </section>
      )}
    </div>
  );
}

/* ---------- cabeçalho ---------- */

function Header({
  model,
  status,
  periodOptions,
  editing,
  saving,
  onEdit,
  onCancel,
  onSave,
}: {
  model: ReportModel;
  status: ReportStatus;
  periodOptions: { value: string; label: string }[];
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const router = useRouter();
  const st = REPORT_STATUS[status];
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const download = async (format: "html" | "pdf") => {
    setBusy(format);
    try {
      await downloadExport(exportUrl(format, model.period, format === "html" ? "&download=1" : ""), `report-quinzenal-${model.period}.${format}`);
    } catch {
      toast("error", "Não foi possível gerar o arquivo.");
    }
    setBusy(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center gap-1.5 text-xs text-fg-mut" aria-label="Trilha">
        <FileText className="size-3.5 text-accent" />
        <span>Relatórios</span>
        <ChevronRight className="size-3" />
        <span className="text-fg-soft">Report Quinzenal</span>
      </nav>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-extrabold tracking-tight">Report da Área - Gestão de Produto</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[15px] text-fg-soft">
            Período: {model.datesShort} ({model.code})
            <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: st.bg, color: st.fg }}>
              {st.label}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64">
            <Select value={model.period} icon={<CalendarRange className="size-4" />} onChange={(e) => router.push(`/product-report?period=${e.target.value}`)} aria-label="Quinzena do report">
              {periodOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
                <X className="size-4" /> Cancelar
              </Button>
              <Button size="sm" onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar edição
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Pencil className="size-4" /> Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => download("html")} disabled={busy !== null}>
                {busy === "html" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} Exportar HTML
              </Button>
              <Button variant="ghost" size="sm" onClick={() => download("pdf")} disabled={busy !== null}>
                {busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} Exportar PDF
              </Button>
              <ShareButton model={model} status={status} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Compartilhar: fecha a versão final (status Concluído) e entrega o report para enviar. */
function ShareButton({ model, status }: { model: ReportModel; status: ReportStatus }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const finalize = () =>
    startTransition(async () => {
      const r = await generateReportAction(model.period);
      if (!r.ok) return toast("error", r.error);
      toast("success", "Versão final gerada: o report está Concluído.");
      setOpen(false);
      router.refresh();
    });

  const [emailBusy, setEmailBusy] = useState(false);
  const copyEmail = async () => {
    setEmailBusy(true);
    try {
      const html = await buildEmailHtml(model, status);
      if (await copyRichHtml(html, summaryText(model))) {
        toast("success", "Report copiado. Cole direto no corpo do e-mail (Cmd/Ctrl+V).");
        setOpen(false);
      } else {
        // navegador sem cópia formatada: abre a versão de e-mail para copiar à mão
        const w = window.open("", "_blank");
        w?.document.write(emailDocument(html, `Report ${model.code}`));
        w?.document.close();
        toast("info", "Selecione tudo (Cmd/Ctrl+A), copie e cole no e-mail.");
      }
    } catch {
      toast("error", "Não foi possível montar o report para e-mail.");
    }
    setEmailBusy(false);
  };

  const downloadEmail = async () => {
    try {
      const html = emailDocument(await buildEmailHtml(model, status), `Report ${model.code}`);
      const href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      const a = document.createElement("a");
      a.href = href;
      a.download = `report-quinzenal-${model.period}-email.html`;
      a.click();
      URL.revokeObjectURL(href);
      setOpen(false);
    } catch {
      toast("error", "Não foi possível montar o report para e-mail.");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText(model));
      toast("success", "Resumo copiado. Cole no e-mail ou no Slack.");
      setOpen(false);
    } catch {
      toast("error", "Não foi possível copiar.");
    }
  };

  const item = "flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-brand";
  return (
    <div ref={ref} className="relative">
      <Button size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Share2 className="size-4" /> Compartilhar
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-xl border border-line bg-bg-elev p-1.5 shadow-[var(--shadow-lg)]">
          <button className={item} onClick={copyEmail} disabled={emailBusy}>
            {emailBusy ? <Loader2 className="mt-0.5 size-4 animate-spin text-accent" /> : <Mail className="mt-0.5 size-4 text-accent" />}
            <span>
              <span className="block font-semibold">Copiar para o corpo do e-mail</span>
              <span className="block text-xs text-fg-mut">Mesmo layout, com tabelas e gráficos. É só colar no Gmail ou Outlook.</span>
            </span>
          </button>
          <button className={item} onClick={downloadEmail}>
            <FileDown className="mt-0.5 size-4 text-accent" />
            <span>
              <span className="block font-semibold">Baixar versão para e-mail</span>
              <span className="block text-xs text-fg-mut">Arquivo .html no formato de e-mail.</span>
            </span>
          </button>
          <div className="my-1 h-px bg-line" />
          <button className={item} onClick={finalize} disabled={pending}>
            {pending ? <Loader2 className="mt-0.5 size-4 animate-spin text-accent" /> : <Check className="mt-0.5 size-4 text-accent" />}
            <span>
              <span className="block font-semibold">{status === "concluido" ? "Gerar nova versão final" : "Concluir e gerar versão final"}</span>
              <span className="block text-xs text-fg-mut">Congela números, metas e textos no histórico.</span>
            </span>
          </button>
          <button className={item} onClick={copy}>
            <ClipboardCopy className="mt-0.5 size-4 text-accent" />
            <span>
              <span className="block font-semibold">Copiar resumo em texto</span>
              <span className="block text-xs text-fg-mut">Para colar no e-mail ou no Slack.</span>
            </span>
          </button>
          <a className={item} href={exportUrl("html", model.period)} target="_blank" rel="noopener">
            <FileText className="mt-0.5 size-4 text-accent" />
            <span>
              <span className="block font-semibold">Abrir versão para envio</span>
              <span className="block text-xs text-fg-mut">HTML pronto para imprimir ou anexar.</span>
            </span>
          </a>
        </div>
      )}
    </div>
  );
}

const MARK: Record<GoalStatus, string> = { met: "✅", missed: "❌", no_target: "—", no_data: "—" };

/** Resumo em texto puro do report (Compartilhar → copiar). */
export function summaryText(m: ReportModel): string {
  const lines = [`Report da Área - Gestão de Produto · ${m.code} (${m.datesShort})`, "", introText(m), ""];
  for (const g of m.groups) {
    const rows = g.key === "produto" ? g.rows.filter((r) => r.key === "northstar") : g.rows;
    lines.push(g.title.toUpperCase());
    for (const r of rows) lines.push(`${MARK[r.status]} ${rowName(r)}: ${formatCompact(r.value, r.unit)} (meta ${formatCompact(r.target, r.unit)} · próxima ${formatCompact(r.nextTarget, r.unit)})`);
    lines.push("");
  }
  if (m.notes.trim()) lines.push("Observações e conclusões executivas", m.notes.trim());
  return lines.join("\n").trim();
}

/* ---------- avisos de dados ---------- */

function DataNotice({ model }: { model: ReportModel }) {
  const important = model.alerts.filter((a) => a.tone !== "info");
  const [open, setOpen] = useState(false);
  if (!important.length) return null;
  const hasError = important.some((a) => a.tone === "error");
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", hasError ? "border-erro/30 bg-erro/5" : "border-aviso/40 bg-aviso/10")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className="flex items-center gap-2 font-semibold" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {hasError ? <XCircle className="size-4 text-erro" /> : <AlertTriangle className="size-4 text-aviso" />}
          {important.length} {important.length === 1 ? "ponto de atenção" : "pontos de atenção"} nos dados
          <span className="text-xs font-normal text-fg-mut">{open ? "ocultar" : "ver"}</span>
        </button>
        <SyncButton period={model.period} />
      </div>
      {open && (
        <ul className="mt-2 flex flex-col gap-1 pl-6 text-[13px] text-fg-soft">
          {important.map((a, i) => (
            <li key={i} className="list-disc">
              {a.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SyncButton({ period }: { period: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await syncAction(period);
          if (!r.ok) return toast("error", r.error);
          toast("success", "Indicadores atualizados.");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Atualizar indicadores
    </Button>
  );
}

function SyncCard({ model }: { model: ReportModel }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-bg-elev p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-bold">Indicadores da Luumu</div>
        <p className="text-xs text-fg-mut">
          {model.sync.at ? `Última atualização: ${fmtTs(model.sync.at)}` : "Esta quinzena ainda não foi buscada na Luumu."} {model.alerts.find((a) => a.tone === "info")?.text ?? ""}
        </p>
      </div>
      <SyncButton period={model.period} />
    </div>
  );
}

/* ---------- 1. Resumo dos Indicadores ---------- */

function Avatar({ author }: { author: ReportModel["author"] }) {
  const name = author?.name ?? "Gestão de Produto";
  if (author?.avatarUrl) return <Image src={author.avatarUrl} alt="" width={40} height={40} className="size-10 shrink-0 rounded-full object-cover" />;
  return <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-white">{name.trim()[0]?.toUpperCase()}</span>;
}

function ResultIcon({ status }: { status: GoalStatus }) {
  if (status === "met")
    return (
      <svg width="20" height="20" viewBox="0 0 18 18" aria-label="Atingiu" className="mx-auto">
        <rect width="18" height="18" rx="3" fill="#22C55E" />
        <path d="M4.5 9.3l3 3 6-6.3" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "missed")
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-label="Abaixo da meta" className="mx-auto">
        <path d="M3 3l10 10M13 3L3 13" stroke="#EF4444" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  return <span className="text-fg-mut" title={status === "no_data" ? "Sem dado" : "Sem meta"}>—</span>;
}

function SummaryTable({
  group,
  code,
  editing,
  drafts,
  onDraft,
}: {
  group: ReportModel["groups"][number];
  code: string;
  editing: boolean;
  drafts: Drafts;
  onDraft: (which: keyof Drafts, key: string, v: string) => void;
}) {
  const st = GROUP_STYLE[group.key];
  // Gestão de Produto mostra só a North Star, como na referência
  const rows = group.key === "produto" ? group.rows.filter((r) => r.key === "northstar") : group.rows;
  const goalCell = (r: IndicatorRow, which: "cur" | "next") => {
    const value = which === "cur" ? r.target : r.nextTarget;
    const from = which === "cur" ? r.targetFrom : r.nextTargetFrom;
    if (!editing) return formatCompact(value, r.unit);
    return (
      <Input
        value={drafts[which][r.key]}
        placeholder={from ? formatCompact(value, r.unit) : ""}
        title={from ? `Vazio mantém a meta de ${periodCode(from)}` : undefined}
        inputMode="decimal"
        onChange={(e) => onDraft(which, r.key, e.target.value)}
        className="mx-auto w-24 px-2 py-1 text-center"
      />
    );
  };
  return (
    <div className="overflow-hidden rounded-xl border-[1.5px] bg-bg-elev" style={{ borderColor: `${st.color}66` }}>
      <div className="py-1.5 text-center text-xs font-bold tracking-wide text-white" style={{ background: st.color }}>
        {st.title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-[13px]">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[19%]" />
            <col className="w-[19%]" />
            <col className="w-[25%]" />
            <col className="w-[15%]" />
          </colgroup>
          <thead>
            <tr className="bg-bg-sunken">
              {["Indicador", `Meta (${code})`, "Realizado", "Nova Meta (Próxima Quinzena)", "Resultado"].map((h, i) => (
                <th key={h} className={cn("px-3 py-2 font-bold", i === 0 ? "text-left" : "border-l border-line text-center")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-line">
                <td className="px-3 py-2">{rowName(r)}</td>
                <td className="border-l border-line px-3 py-2 text-center">{goalCell(r, "cur")}</td>
                <td className="border-l border-line px-3 py-2 text-center" title={r.source ? `${r.source}${r.detail ? ` · ${r.detail}` : ""}` : undefined}>
                  {editing ? (
                    <Input
                      value={drafts.real[r.key]}
                      placeholder={formatCompact(r.auto, r.unit)}
                      title={`Vazio usa o valor automático (${formatCompact(r.auto, r.unit)})`}
                      inputMode="decimal"
                      onChange={(e) => onDraft("real", r.key, e.target.value)}
                      className={cn("mx-auto w-24 px-2 py-1 text-center", drafts.real[r.key] && "border-accent")}
                    />
                  ) : (
                    <>
                      {formatCompact(r.value, r.unit)}
                      {r.overridden && (
                        <sup className="ml-0.5 text-[10px] font-bold text-accent" title={`Ajustado manualmente · automático: ${formatCompact(r.auto, r.unit)}`}>
                          ✎
                        </sup>
                      )}
                    </>
                  )}
                </td>
                <td className="border-l border-line px-3 py-2 text-center">{goalCell(r, "next")}</td>
                <td className="border-l border-line px-3 py-2 text-center">
                  <ResultIcon status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- observações ---------- */

function Notes({ period, initial }: { period: string; initial: string }) {
  const toast = useToast();
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = text !== initial;
  return (
    <div className="rounded-2xl border border-line bg-bg-elev p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 size-[18px] shrink-0" />
          <div>
            <div className="text-sm font-bold">Observações e conclusões executivas</div>
            <p className="text-xs text-fg-mut">Registre aqui os principais resultados, riscos e próximos passos da quinzena.</p>
          </div>
        </div>
        {dirty && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await saveTextsAction({ period, notes: text });
                if (!r.ok) return toast("error", r.error);
                toast("success", "Observações salvas.");
                router.refresh();
              })
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar
          </Button>
        )}
      </div>
      <Textarea rows={4} className="mt-3" value={text} onChange={(e) => setText(e.target.value)} placeholder="Principais resultados, riscos e próximos passos…" />
    </div>
  );
}

/* ---------- histórico de relatórios ---------- */

function ReportHistory({ reports }: { reports: GeneratedReportItem[] }) {
  const linkCls = "inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent";
  return (
    <div className="rounded-2xl border border-line bg-bg-elev">
      <div className="p-5 pb-3">
        <div className="text-sm font-bold">Versões finais geradas</div>
        <p className="text-xs text-fg-mut">Cada versão guarda os números, metas e textos do momento em que foi gerada.</p>
      </div>
      {reports.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-fg-mut">Nenhuma versão final ainda. Use Compartilhar → Concluir.</p>
      ) : (
        <ul className="divide-y divide-line">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">{r.label}</div>
                <div className="text-xs text-fg-mut">
                  Gerada em {fmtTs(r.createdAt)}
                  {r.trigger === "cron" ? " · automática" : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <a className={linkCls} href={`/api/product-report/export?format=html&report=${encodeURIComponent(r.id)}`} target="_blank" rel="noopener">
                  <FileText className="size-3.5" /> HTML
                </a>
                <a className={linkCls} href={`/api/product-report/export?format=pdf&report=${encodeURIComponent(r.id)}`}>
                  <FileDown className="size-3.5" /> PDF
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- valores manuais nos gráficos ---------- */

/**
 * Ajuste dos pontos de um gráfico, quinzena a quinzena. Vazio = valor automático (Luumu ou
 * planilha); preenchido = ajuste manual, que vale também nas tabelas e na North Star da quinzena.
 */
function ChartEditor({ spec, model }: { spec: ChartSpec; model: ReportModel }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(model.history.map((h) => [h.period, toText(h.overrides[spec.key] ?? null)]))
  );
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const changes: { period: string; value: number | null }[] = [];
      for (const h of model.history) {
        const v = parseNum(draft[h.period]);
        if (v === undefined) return toast("error", `Valor inválido em ${h.tick}.`);
        if (v !== (h.overrides[spec.key] ?? null)) changes.push({ period: h.period, value: v });
      }
      if (!changes.length) return toast("info", "Nada mudou.");
      const res = await Promise.all(changes.map((c) => saveManualAction({ period: c.period, values: { [spec.key]: c.value } })));
      const err = res.find((r) => !r.ok);
      if (err && !err.ok) return toast("error", err.error);
      toast("success", "Valores do gráfico salvos.");
      setOpen(false);
      router.refresh();
    });

  if (!open)
    return (
      <button className="flex items-center gap-1.5 self-start rounded-full border border-dashed border-accent/50 px-3 py-1 text-xs font-semibold text-accent hover:bg-surface-brand" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-3.5" /> Editar valores do gráfico
      </button>
    );

  return (
    <div className="rounded-xl border border-dashed border-accent/50 bg-bg-elev p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">Valores manuais ({spec.unit === "min" ? "minutos" : "%"}) · vazio usa o automático</span>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {model.history.map((h) => (
          <label key={h.period} className="flex flex-col gap-1 text-center">
            <span className="text-[10px] font-semibold text-fg-mut">{h.tick}</span>
            <Input
              value={draft[h.period]}
              inputMode="decimal"
              placeholder={formatCompact(h.auto[spec.key] ?? null, spec.unit).replace(/[%]| min/g, "")}
              title={`Automático: ${formatCompact(h.auto[spec.key] ?? null, spec.unit)}`}
              onChange={(e) => setDraft((d) => ({ ...d, [h.period]: e.target.value }))}
              className={cn("px-1.5 py-1 text-center text-xs", draft[h.period] && "border-accent")}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
