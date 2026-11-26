"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ClipboardList, Copy, Eye, GraduationCap, Hourglass, KeyRound, Loader2, PlugZap, RefreshCw, Save, Search, Webhook } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { previewClassFeedAction, revealWebhookSecretAction, saveAutoSettingsAction } from "@/app/(app)/notifications/actions";
import { ACTIVITY_TYPE_LABEL, dueTitle, isActivityType, type AutoSettings, type FeedActivity } from "@/lib/notifications/activities";
import { OUTCOME_LABEL } from "@/lib/notifications/webhook";

type Counts = { delivered: number; seen: number; click: number };

export interface AutoTabData {
  /** migração 0051 aplicada */
  available: boolean;
  bellEnabled: boolean;
  auto: AutoSettings;
  /** null = o projeto ainda não tem chave do SDK */
  webhookUrl: string | null;
  secret: { hasSecret: boolean; updatedAt: string | null; previousUntil: string | null };
  canEdit: boolean;
  canManage: boolean;
  summary: { open: number; total: number; lastReceived: string | null; last24h: Record<string, number> };
  deliveries: { id: string; when: string; event: string; activityId: string | null; status: string; error: string | null }[];
  activities: {
    id: string;
    type: string;
    title: string;
    subject: string | null;
    classIds: string[];
    assigned: string;
    due: string | null;
    state: "aberta" | "encerrada" | "cancelada";
    stats: { nova: Counts; prazo: Counts };
  }[];
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

const STATUS_TONE: Record<string, "success" | "neutral" | "warn" | "error"> = { applied: "success", stale: "neutral", duplicate: "neutral", invalid: "error", unauthorized: "error" };
const STATE_TONE = { aberta: "success", encerrada: "neutral", cancelada: "warn" } as const;

export function AutoNotificationsTab({ data }: { data: AutoTabData }) {
  if (!data.available) {
    return (
      <Card className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-aviso" />
        <div className="text-sm">
          <strong>Avisos automáticos indisponíveis.</strong>
          <span className="block text-fg-mut">Falta aplicar a migração drizzle/0051_notification_activities.sql no banco.</span>
        </div>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <SettingsCard data={data} />
          <ConnectionCard data={data} />
        </div>
        <div className="flex flex-col gap-6">
          <HowItWorks />
          <ClassPreview />
        </div>
      </div>
      <DeliveriesCard data={data} />
      <ActivitiesCard data={data} />
    </div>
  );
}

/* ---------- liga/desliga ---------- */

function SettingsCard({ data }: { data: AutoTabData }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState<AutoSettings>(data.auto);
  const [saving, start] = useTransition();
  const dirty = JSON.stringify(s) !== JSON.stringify(data.auto);

  function save() {
    start(async () => {
      const r = await saveAutoSettingsAction(s);
      if (!r.ok) return toast("error", r.error ?? "Não foi possível salvar.");
      toast("success", s.enabled ? "Salvo. Os estudantes passam a ver os avisos em até 20 minutos." : "Salvo. Os avisos automáticos estão desligados.");
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold">Avisos automáticos de atividades</h2>
          <p className="mt-1 text-sm text-fg-mut">
            Quando o produto libera uma Tarefa ou Prova Genial, o sino de cada estudante da turma avisa, e lembra do prazo antes de vencer.
          </p>
        </div>
        <Switch checked={s.enabled} onChange={(v) => setS({ ...s, enabled: v })} label="Avisos automáticos ligados" />
      </div>
      {!data.bellEnabled && (
        <div className="flex items-start gap-2 rounded-xl bg-[#FEF3C7] px-3 py-2 text-xs text-[#92400e] dark:bg-aviso/20 dark:text-[#fde047]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> O sino está desligado (aba Sino e instalação). Sem ele, nenhum aviso aparece, mesmo com esta opção ligada.
        </div>
      )}
      <fieldset disabled={!data.canEdit || !s.enabled} className={cn("grid gap-3 sm:grid-cols-2", !s.enabled && "opacity-60")}>
        <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
          <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={s.novas} onChange={(e) => setS({ ...s, novas: e.target.checked })} />
          <span>
            <span className="font-semibold">Nova tarefa / Nova Prova Genial</span>
            <span className="block text-xs text-fg-mut">Na liberação. Fica no sino por 7 dias ou até o estudante concluir.</span>
          </span>
        </label>
        <Field label="Lembrete de prazo" hint="Até o prazo vencer ou o estudante concluir.">
          <Select value={String(s.dueHours)} onChange={(e) => setS({ ...s, dueHours: Number(e.target.value) })}>
            <option value="0">Não avisar</option>
            <option value="12">{dueTitle(12)} (12h antes)</option>
            <option value="24">{dueTitle(24)} (24h antes)</option>
            <option value="48">{dueTitle(48)} (48h antes)</option>
          </Select>
        </Field>
      </fieldset>
      {data.canEdit && (
        <div>
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ---------- conexão: URL, segredo, saúde ---------- */

function ConnectionCard({ data }: { data: AutoTabData }) {
  const toast = useToast();
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();
  const h = data.summary.last24h;
  const accepted = (h.applied ?? 0) + (h.stale ?? 0);
  const refused = (h.invalid ?? 0) + (h.unauthorized ?? 0);

  const reveal = (rotate = false) =>
    start(async () => {
      const r = await revealWebhookSecretAction(rotate);
      if (!r.ok) return toast("error", r.error);
      setSecret(r.secret);
      setConfirmRotate(false);
      if (rotate) toast("success", "Novo segredo gerado. O anterior continua aceito por 24 horas.");
      router.refresh();
    });

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Webhook className="size-4.5 text-accent" /> Conexão com o produto
        </h2>
        {data.summary.lastReceived ? <Badge tone="success">Último envio {data.summary.lastReceived}</Badge> : <Badge tone="neutral">Nenhum envio ainda</Badge>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Mini label="Atividades em aberto" value={fmt(data.summary.open)} />
        <Mini label="Eventos aceitos (24h)" value={fmt(accepted)} />
        <Mini label="Recusados (24h)" value={fmt(refused)} tone={refused ? "error" : undefined} />
      </div>

      <Field label="URL do webhook" hint="O back-end do produto faz um POST aqui a cada atividade liberada, alterada ou cancelada.">
        {data.webhookUrl ? <CodeBlock lang="url" code={data.webhookUrl} /> : <p className="text-sm text-erro">Crie uma chave do SDK em Configurações → SDK & Eventos: ela entra na URL.</p>}
      </Field>

      {data.canManage ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-line p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <KeyRound className="size-4" /> Segredo de assinatura
            </span>
            {secret ? (
              <span className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-bg-sunken px-3 py-1.5">
                <code className="min-w-0 flex-1 truncate text-xs">{secret}</code>
                <button
                  type="button"
                  aria-label="Copiar segredo"
                  className="text-fg-mut hover:text-accent"
                  onClick={() =>
                    void navigator.clipboard?.writeText(secret).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1400);
                    })
                  }
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => reveal()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-fg-soft hover:border-accent hover:text-accent"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />} {data.secret.hasSecret ? "Mostrar" : "Gerar segredo"}
              </button>
            )}
            {secret && !confirmRotate && (
              <button type="button" onClick={() => setConfirmRotate(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-fg-mut hover:text-erro">
                <RefreshCw className="size-3.5" /> Trocar
              </button>
            )}
            {confirmRotate && (
              <span className="flex items-center gap-2 text-xs font-semibold">
                O atual vale por mais 24h.
                <button type="button" disabled={busy} onClick={() => reveal(true)} className="rounded-lg bg-erro px-2.5 py-1 text-white">
                  Trocar
                </button>
                <button type="button" onClick={() => setConfirmRotate(false)} className="text-fg-mut">
                  Cancelar
                </button>
              </span>
            )}
          </div>
          <p className="text-xs text-fg-mut">
            Entregue ao time do produto por um canal seguro. Fica no cofre de segredos do back-end deles, nunca no código da página.
            {data.secret.previousUntil && ` O segredo anterior ainda é aceito até ${data.secret.previousUntil}.`}
          </p>
        </div>
      ) : (
        <p className="text-xs text-fg-mut">O segredo de assinatura só aparece para donos e administradores do workspace.</p>
      )}
    </Card>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "error" }) {
  return (
    <div className="rounded-xl bg-bg-sunken px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-mut">{label}</div>
      <div className={cn("font-display text-xl font-extrabold", tone === "error" ? "text-erro" : "text-luumu-roxo")}>{value}</div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: <PlugZap className="size-4" />, t: "O produto avisa", d: "O back-end manda um evento assinado quando libera, altera ou cancela uma atividade, com as turmas." },
    { icon: <ClipboardList className="size-4" />, t: "A Luumu guarda", d: "Uma linha por atividade. Nada sobre os estudantes." },
    { icon: <GraduationCap className="size-4" />, t: "O sino lê a turma", d: "O identify traz as turmas do estudante (class_ids); o sino busca a lista delas a cada 5 minutos." },
    { icon: <Hourglass className="size-4" />, t: "E decide o aviso", d: "Nova atividade, prazo chegando; some quando ele chega à tela de resultado." },
  ];
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-base font-bold">Como funciona</h2>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-brand text-accent">{s.icon}</span>
            <span>
              <span className="font-semibold">{s.t}</span>
              <span className="block text-xs text-fg-mut">{s.d}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-fg-mut">Guia técnico para o time do produto: docs/notifications/INTEGRACAO.md.</p>
    </Card>
  );
}

/* ---------- ver como uma turma ---------- */

function ClassPreview() {
  const toast = useToast();
  const [c, setC] = useState("");
  const [items, setItems] = useState<FeedActivity[] | null>(null);
  const [busy, start] = useTransition();
  const when = (ts: number) => new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "");

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-base font-bold">Ver como uma turma</h2>
      <p className="text-xs text-fg-mut">O que o sino dos estudantes desta turma recebe agora (sem o cache de até 2 minutos).</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await previewClassFeedAction(c);
            if (!r.ok) return toast("error", r.error);
            setItems(r.items);
          });
        }}
      >
        <Input value={c} onChange={(e) => setC(e.target.value)} placeholder="id da turma (ex.: 6A-2026)" className="font-mono text-[13px]" />
        <Button size="sm" type="submit" disabled={busy || !c.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        </Button>
      </form>
      {items && (
        <ul className="flex flex-col divide-y divide-line text-sm">
          {!items.length && <li className="py-2 text-fg-mut">Nenhuma atividade em aberto para esta turma.</li>}
          {items.map((a) => (
            <li key={a.id} className="py-2">
              <div className="font-semibold">{a.t}</div>
              <div className="text-xs text-fg-mut">
                {ACTIVITY_TYPE_LABEL[a.k]}
                {a.s ? ` · ${a.s}` : ""} · liberada {when(a.a)}
                {a.d ? ` · prazo ${when(a.d)}` : " · sem prazo"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------- últimos envios ---------- */

function DeliveriesCard({ data }: { data: AutoTabData }) {
  return (
    <Card padded={false}>
      <div className="flex items-center justify-between px-6 pt-5">
        <h2 className="font-display text-base font-bold">Últimos envios do produto</h2>
        <span className="text-xs text-fg-mut">30 mais recentes · guardados por 30 dias</span>
      </div>
      {!data.deliveries.length ? (
        <p className="px-6 pb-6 pt-3 text-sm text-fg-mut">Nenhum envio recebido ainda. Assim que o back-end do produto mandar o primeiro evento, ele aparece aqui.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wide text-fg-mut">
                <th className="px-6 py-2.5 font-semibold">Quando</th>
                <th className="px-3 py-2.5 font-semibold">Evento</th>
                <th className="px-3 py-2.5 font-semibold">Atividade</th>
                <th className="px-3 py-2.5 font-semibold">Resultado</th>
                <th className="px-6 py-2.5 font-semibold">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {data.deliveries.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-6 py-2.5 text-fg-soft">{d.when}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{d.event || "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{d.activityId ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={STATUS_TONE[d.status] ?? "neutral"}>{OUTCOME_LABEL[d.status as keyof typeof OUTCOME_LABEL] ?? d.status}</Badge>
                  </td>
                  <td className="max-w-[420px] px-6 py-2.5 text-xs text-fg-mut">{d.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------- atividades recebidas ---------- */

function ActivitiesCard({ data }: { data: AutoTabData }) {
  return (
    <Card padded={false}>
      <div className="flex items-center justify-between px-6 pt-5">
        <h2 className="font-display text-base font-bold">Atividades recebidas</h2>
        <span className="text-xs text-fg-mut">
          {fmt(data.summary.total)} no total · 50 mais recentes
        </span>
      </div>
      {!data.activities.length ? (
        <p className="px-6 pb-6 pt-3 text-sm text-fg-mut">Nenhuma atividade ainda.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wide text-fg-mut">
                <th className="px-6 py-2.5 font-semibold">Atividade</th>
                <th className="px-3 py-2.5 font-semibold">Turmas</th>
                <th className="px-3 py-2.5 font-semibold">Prazo</th>
                <th className="px-3 py-2.5 font-semibold">Situação</th>
                <th className="px-3 py-2.5 text-right font-semibold" title="Estudantes que tiveram o aviso de nova atividade no sino / abriram o painel com ele / clicaram">
                  Aviso de nova
                </th>
                <th className="px-6 py-2.5 text-right font-semibold" title="Estudantes que tiveram o lembrete de prazo no sino / abriram o painel com ele / clicaram">
                  Lembrete de prazo
                </th>
              </tr>
            </thead>
            <tbody>
              {data.activities.map((a) => (
                <tr key={a.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-brand text-accent">
                        {a.type === "prova_genial" ? <GraduationCap className="size-4" /> : <ClipboardList className="size-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold">{a.title || <span className="text-fg-mut">(cancelada antes de chegar)</span>}</div>
                        <div className="text-xs text-fg-mut">
                          {isActivityType(a.type) ? ACTIVITY_TYPE_LABEL[a.type] : a.type}
                          {a.subject ? ` · ${a.subject}` : ""} · <span className="font-mono">{a.id}</span> · liberada {a.assigned}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-fg-soft" title={a.classIds.join(", ")}>
                    {a.classIds.length ? `${fmt(a.classIds.length)} ${a.classIds.length === 1 ? "turma" : "turmas"}` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-fg-soft">{a.due ?? "sem prazo"}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={STATE_TONE[a.state]}>{a.state}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-fg-soft">{triple(a.stats.nova)}</td>
                  <td className="whitespace-nowrap px-6 py-2.5 text-right tabular-nums text-fg-soft">{triple(a.stats.prazo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-6 py-3 text-xs text-fg-mut">Métricas: recebidos · vistos · cliques (cada estudante conta uma vez por navegador).</p>
        </div>
      )}
    </Card>
  );
}

const triple = (c: Counts) => `${fmt(c.delivered)} · ${fmt(c.seen)} · ${fmt(c.click)}`;
