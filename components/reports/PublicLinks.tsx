"use client";

import { useState, useTransition } from "react";
import { Link2, Plus, Trash2, Copy, Check, Eye, EyeOff, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { PERIOD_OPTIONS } from "@/lib/period";
import {
  createPublicLinkAction,
  togglePublicLinkAction,
  deletePublicLinkAction,
} from "@/app/(app)/reports/actions";

interface SurveyOpt {
  id: string;
  name: string;
}

export interface PublicLinkItem {
  id: string;
  token: string;
  surveyId: string | null;
  period: string;
  active: boolean;
  viewCount: number;
}

export function PublicLinks({
  surveys,
  initial,
}: {
  surveys: SurveyOpt[];
  initial: PublicLinkItem[];
}) {
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [surveyId, setSurveyId] = useState("");
  const [period, setPeriod] = useState("all");
  const [saving, start] = useTransition();

  function create() {
    start(async () => {
      const res = await createPublicLinkAction({ surveyId: surveyId || null, period });
      if (res.ok) {
        toast("success", "Link público gerado.");
        setCreating(false);
        location.reload();
      } else {
        toast("error", res.error ?? "Não foi possível gerar o link.");
      }
    });
  }

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between p-6 pb-3">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-accent" />
          <CardTitle>Links públicos</CardTitle>
        </div>
        {!creating && (
          <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Novo link
          </Button>
        )}
      </div>

      {creating && (
        <div className="border-t border-line bg-bg-sunken/40 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Pesquisa">
              <Select value={surveyId} onChange={(e) => setSurveyId(e.target.value)}>
                <option value="">Todas as pesquisas</option>
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Período dos dados">
              <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="mt-3 text-xs text-fg-mut">
            Qualquer pessoa com o link poderá ver os indicadores desta pesquisa, sem precisar de conta na Luumu.
            Você pode revogar o link a qualquer momento.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" onClick={create} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Gerar link
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="flex flex-col">
        {items.length === 0 && !creating && (
          <p className="px-6 pb-6 text-sm text-fg-mut">
            Nenhum link público ainda. Gere um para compartilhar um relatório com quem não tem acesso à Luumu.
          </p>
        )}
        {items.map((l) => (
          <PublicLinkRow
            key={l.id}
            item={l}
            surveys={surveys}
            onChange={(next) => setItems((prev) => prev.map((p) => (p.id === l.id ? next : p)))}
            onRemove={() => setItems((prev) => prev.filter((p) => p.id !== l.id))}
          />
        ))}
      </div>
    </Card>
  );
}

function PublicLinkRow({
  item,
  surveys,
  onChange,
  onRemove,
}: {
  item: PublicLinkItem;
  surveys: SurveyOpt[];
  onChange: (next: PublicLinkItem) => void;
  onRemove: () => void;
}) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? `${window.location.origin}/r/${item.token}` : `/r/${item.token}`;
  const scopeName = item.surveyId ? surveys.find((s) => s.id === item.surveyId)?.name ?? "Pesquisa" : "Todas as pesquisas";
  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === item.period)?.label ?? item.period;

  function copy() {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    toast("success", "Link copiado!");
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{scopeName}</span>
          <Badge tone={item.active ? "success" : "neutral"}>{item.active ? "ativo" : "revogado"}</Badge>
        </div>
        <div className="mt-0.5 truncate text-xs text-fg-mut">
          {periodLabel} · {item.viewCount} {item.viewCount === 1 ? "visualização" : "visualizações"}
        </div>
        {item.active && (
          <code className="mt-1 block max-w-full truncate rounded bg-bg-sunken px-2 py-1 font-mono text-[11px] text-fg-soft">
            {url}
          </code>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {item.active && (
          <>
            <button title="Copiar link" onClick={copy} className="rounded-lg p-2 text-fg-mut hover:bg-bg-sunken hover:text-accent">
              {copied ? <Check className="size-4 text-sucesso" /> : <Copy className="size-4" />}
            </button>
            <a title="Abrir" href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-fg-mut hover:bg-bg-sunken hover:text-accent">
              <ExternalLink className="size-4" />
            </a>
          </>
        )}
        <button
          title={item.active ? "Revogar" : "Reativar"}
          onClick={() =>
            start(async () => {
              await togglePublicLinkAction(item.id, !item.active);
              onChange({ ...item, active: !item.active });
              toast("success", item.active ? "Link revogado." : "Link reativado.");
            })
          }
          disabled={busy}
          className="rounded-lg p-2 text-fg-mut hover:bg-bg-sunken hover:text-fg"
        >
          {item.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
        <button
          title="Excluir"
          onClick={() =>
            start(async () => {
              await deletePublicLinkAction(item.id);
              onRemove();
              toast("success", "Link excluído.");
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
