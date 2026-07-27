"use client";

import { useState, useTransition } from "react";
import { Calendar, Plus, Trash2, Pause, Play, Mail, Loader2, X } from "lucide-react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { PERIOD_OPTIONS } from "@/lib/period";
import {
  createScheduleAction,
  toggleScheduleAction,
  deleteScheduleAction,
} from "@/app/(app)/reports/actions";

interface SurveyOpt {
  id: string;
  name: string;
}

export interface ScheduledItem {
  id: string;
  name: string;
  recipients: string[];
  frequency: string;
  period: string;
  format: string;
  surveyIds: string[];
  active: boolean;
  nextRunAt: string; // ISO
  lastRunAt: string | null;
}

const FREQ_LABEL: Record<string, string> = { daily: "Diário", weekly: "Semanal", monthly: "Mensal" };
const FMT_LABEL: Record<string, string> = { pdf: "PDF", xlsx: "Excel", csv: "CSV" };

export function ScheduleReports({
  surveys,
  initial,
}: {
  surveys: SurveyOpt[];
  initial: ScheduledItem[];
}) {
  const [items, setItems] = useState(initial);
  const [creating, setCreating] = useState(initial.length === 0);
  return (
    <div className="flex flex-col gap-3">
      <Card padded={false}>
        <div className="flex items-center justify-between p-6 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-accent" />
            <CardTitle>Envios agendados</CardTitle>
          </div>
          {!creating && (
            <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Novo envio
            </Button>
          )}
        </div>

        {creating && (
          <ScheduleForm
            surveys={surveys}
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              // recarrega a lista via server (revalidatePath já disparou); força refresh leve
              location.reload();
            }}
          />
        )}

        <div className="flex flex-col">
          {items.length === 0 && !creating && (
            <p className="px-6 pb-6 text-sm text-fg-mut">
              Nenhum envio agendado. Crie um para receber relatórios por e-mail automaticamente.
            </p>
          )}
          {items.map((s) => (
            <ScheduleRow
              key={s.id}
              item={s}
              surveys={surveys}
              onChange={(next) => setItems((prev) => prev.map((p) => (p.id === s.id ? next : p)))}
              onRemove={() => setItems((prev) => prev.filter((p) => p.id !== s.id))}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function ScheduleForm({
  surveys,
  onCancel,
  onCreated,
}: {
  surveys: SurveyOpt[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [saving, start] = useTransition();
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [period, setPeriod] = useState("30d");
  const [format, setFormat] = useState("pdf");
  const [surveyIds, setSurveyIds] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);

  function addEmail() {
    const e = emailInput.trim().toLowerCase();
    if (!e) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      toast("error", "E-mail inválido.");
      return;
    }
    if (!recipients.includes(e)) setRecipients((r) => [...r, e]);
    setEmailInput("");
  }

  function toggleSurvey(id: string) {
    setSurveyIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    if (recipients.length === 0) {
      toast("error", "Adicione ao menos um e-mail.");
      return;
    }
    start(async () => {
      const res = await createScheduleAction({ name: name || "Relatório", recipients, frequency, period, format, surveyIds });
      if (res.ok) {
        toast("success", "Envio agendado.");
        onCreated();
      } else {
        toast("error", res.error ?? "Não foi possível agendar.");
      }
    });
  }

  return (
    <div className="border-t border-line bg-bg-sunken/40 p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nome do envio">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: NPS semanal · Diretoria" />
        </Field>
        <Field label="Frequência">
          <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="daily">Diário</option>
            <option value="weekly">Semanal (toda segunda)</option>
            <option value="monthly">Mensal (dia 1)</option>
          </Select>
        </Field>
        <Field label="Período dos dados">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Formato do anexo">
          <Select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="pdf">PDF (visual)</option>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV (dados brutos)</option>
          </Select>
        </Field>
      </div>

      {/* E-mails */}
      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-semibold text-fg-soft">Destinatários</label>
        <div className="flex gap-2">
          <Input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addEmail();
              }
            }}
            placeholder="email@empresa.com"
          />
          <Button variant="subtle" size="sm" onClick={addEmail} type="button">
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
        {recipients.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recipients.map((e) => (
              <span key={e} className="inline-flex items-center gap-1 rounded-full bg-surface-brand px-2.5 py-1 text-xs font-medium text-accent">
                <Mail className="size-3" /> {e}
                <button onClick={() => setRecipients((r) => r.filter((x) => x !== e))} className="ml-0.5 hover:text-erro">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Seleção de pesquisas */}
      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-semibold text-fg-soft">
          Pesquisas incluídas <span className="font-normal text-fg-mut">(nenhuma = todas)</span>
        </label>
        {surveys.length === 0 ? (
          <p className="text-xs text-fg-mut">Nenhuma pesquisa com respostas ainda.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {surveys.map((s) => {
              const on = surveyIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSurvey(s.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    on ? "border-accent bg-surface-brand text-accent" : "border-line text-fg-mut hover:border-accent"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Calendar className="size-4" />}
          Agendar envio
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

function ScheduleRow({
  item,
  surveys,
  onChange,
  onRemove,
}: {
  item: ScheduledItem;
  surveys: SurveyOpt[];
  onChange: (next: ScheduledItem) => void;
  onRemove: () => void;
}) {
  const toast = useToast();
  const [busy, start] = useTransition();

  const scopeLabel =
    item.surveyIds.length === 0
      ? "Todas as pesquisas"
      : item.surveyIds
          .map((id) => surveys.find((s) => s.id === id)?.name ?? "?")
          .join(", ");

  const nextRun = new Date(item.nextRunAt).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{item.name}</span>
          <Badge tone={item.active ? "success" : "neutral"}>{item.active ? "ativo" : "pausado"}</Badge>
        </div>
        <div className="mt-0.5 truncate text-xs text-fg-mut">
          {FREQ_LABEL[item.frequency]} · {FMT_LABEL[item.format]} · {scopeLabel}
        </div>
        <div className="mt-0.5 truncate text-xs text-fg-mut">
          {item.recipients.join(", ")} · próximo envio {nextRun}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          title={item.active ? "Pausar" : "Reativar"}
          onClick={() =>
            start(async () => {
              await toggleScheduleAction(item.id, !item.active);
              onChange({ ...item, active: !item.active });
              toast("success", item.active ? "Envio pausado." : "Envio reativado.");
            })
          }
          disabled={busy}
          className="rounded-lg p-2 text-fg-mut hover:bg-bg-sunken hover:text-fg"
        >
          {item.active ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button
          title="Excluir"
          onClick={() =>
            start(async () => {
              await deleteScheduleAction(item.id);
              onRemove();
              toast("success", "Envio excluído.");
            })
          }
          disabled={busy}
          className="rounded-lg p-2 text-fg-mut hover:bg-bg-sunken hover:text-erro"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
