"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Zap, Loader2, Check, RefreshCw, Search, X, Plus } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { saveSettingsAction } from "@/app/(app)/surveys/actions";

export interface SettingsValues {
  id: string;
  channel: string;
  audience: string;
  language: string;
  triggerEvents: string[];
  audienceMode: "email" | "id" | null;
  audienceList: string[];
  frequency: string;
  startsAt: string;
  endsAt: string;
}

export interface WorkspaceEvent {
  name: string;
  count: number;
  lastSeenAt: Date | string;
}

const EVENTS_POLL_MS = 10_000;

// rótulo legível para o nome bruto do evento (prefixos gerados pelo auto-tracking em sdk/luumu.ts)
function eventLabel(name: string): string {
  if (name.startsWith("page_view_")) return `Página: /${name.slice("page_view_".length).replace(/_/g, "/")}`;
  if (name.startsWith("click_")) return `Clique: ${name.slice("click_".length).replace(/_/g, " ")}`;
  if (name.startsWith("link_")) return `Link: ${name.slice("link_".length).replace(/_/g, " ")}`;
  if (name === "rage_click") return "Rage click (frustração)";
  if (name === "exit_intent") return "Intenção de saída";
  if (name === "page_leave") return "Saiu da página";
  if (name.startsWith("form_submit")) return `Formulário enviado${name.length > "form_submit".length ? `: ${name.slice("form_submit_".length).replace(/_/g, " ")}` : ""}`;
  if (name.startsWith("engaged_")) return `Engajou ${name.slice("engaged_".length)}`;
  return `Manual: ${name.replace(/_/g, " ")}`;
}

/** Combobox multi-seleção com busca: cliente escolhe vários eventos-gatilho. */
function EventMultiSelect({
  events,
  selected,
  onChange,
  refreshing,
  onRefresh,
}: {
  events: WorkspaceEvent[];
  selected: string[];
  onChange: (next: string[]) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);

  const filtered = events.filter((ev) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return ev.name.toLowerCase().includes(q) || eventLabel(ev.name).toLowerCase().includes(q);
  });

  return (
    <div ref={wrapRef} className="relative">
      {/* chips dos selecionados + botão para abrir */}
      <div
        onClick={() => setOpen(true)}
        className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-xl border border-line-strong bg-bg-elev px-2.5 py-2 text-sm transition focus-within:border-accent"
      >
        {selected.length === 0 && (
          <span className="px-1 text-fg-mut">Nenhum: exibir no carregamento</span>
        )}
        {selected.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 rounded-lg bg-surface-brand py-0.5 pl-2 pr-1 text-xs font-medium text-accent"
          >
            {eventLabel(name)}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(name);
              }}
              className="rounded p-0.5 hover:bg-accent/15"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-medium text-fg-mut hover:text-accent"
        >
          <Plus className="size-3.5" /> Adicionar
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-line bg-bg-elev shadow-[var(--shadow-lg)]">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search className="size-4 shrink-0 text-fg-mut" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar evento…"
              className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-mut"
            />
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              title="Atualizar lista"
              className="shrink-0 rounded p-1 text-fg-mut hover:text-accent disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-fg-mut">
                {events.length === 0 ? "Nenhum evento capturado ainda." : "Nenhum evento corresponde à busca."}
              </div>
            ) : (
              filtered.map((ev) => {
                const on = selected.includes(ev.name);
                return (
                  <button
                    key={ev.name}
                    type="button"
                    onClick={() => toggle(ev.name)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-bg-sunken"
                  >
                    <span
                      className={`grid size-4 shrink-0 place-items-center rounded border ${
                        on ? "border-accent bg-accent text-white" : "border-line-strong"
                      }`}
                    >
                      {on && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-fg-soft">{eventLabel(ev.name)}</span>
                    <span className="shrink-0 font-mono text-[11px] text-fg-mut">{ev.count}×</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Editor de lista de emails/IDs (público específico): adicionar por Enter/vírgula, remover por chip. */
function AudienceList({
  mode,
  values,
  onChange,
}: {
  mode: "email" | "id";
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const parts = draft
      .split(/[,\s;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) {
      const merged = Array.from(new Set([...values, ...parts]));
      onChange(merged);
    }
    setDraft("");
  };

  return (
    <div className="rounded-xl border border-line-strong bg-bg-elev px-2.5 py-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((val) => (
          <span
            key={val}
            className="inline-flex items-center gap-1 rounded-lg bg-bg-sunken py-0.5 pl-2 pr-1 text-xs font-medium text-fg-soft"
          >
            {val}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== val))}
              className="rounded p-0.5 hover:bg-line"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={commit}
          placeholder={mode === "email" ? "email@exemplo.com" : "id_do_usuario"}
          className="min-w-[140px] flex-1 bg-transparent px-1 py-0.5 text-sm text-fg outline-none placeholder:text-fg-mut"
        />
      </div>
    </div>
  );
}

export function SurveySettingsForm({
  initial,
  events: initialEvents = [],
}: {
  initial: SettingsValues;
  events?: WorkspaceEvent[];
}) {
  const [v, setV] = useState(initial);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const [events, setEvents] = useState(initialEvents);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const set = (patch: Partial<SettingsValues>) => setV((s) => ({ ...s, ...patch }));

  const refreshEvents = useRef(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const r = await fetch("/api/events/status", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setEvents((d.events || []) as WorkspaceEvent[]);
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  });

  useEffect(() => {
    const id = setInterval(() => refreshEvents.current(true), EVENTS_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const specific = v.audience === "Usuários específicos";

  function save() {
    startSaving(async () => {
      await saveSettingsAction({
        id: v.id,
        channel: v.channel,
        audience: v.audience,
        language: v.language,
        triggerEvents: v.triggerEvents,
        // só persiste modo/lista quando o público é específico
        audienceMode: specific ? v.audienceMode ?? "email" : null,
        audienceList: specific ? v.audienceList : [],
        frequency: v.frequency,
        startsAt: v.startsAt,
        endsAt: v.endsAt,
      });
      setSaved(true);
      toast("success", "Configurações salvas.");
      setTimeout(() => setSaved(false), 1800);
    });
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Público</CardTitle>
          <div className="mt-4 flex flex-col gap-4">
            <Field label="Quem recebe a pesquisa">
              <Select
                value={v.audience}
                onChange={(e) => set({ audience: e.target.value })}
              >
                <option>Todos os usuários</option>
                <option>Usuários específicos</option>
              </Select>
            </Field>

            {specific && (
              <>
                <Field label="Identificar por">
                  <Select
                    value={v.audienceMode ?? "email"}
                    onChange={(e) => set({ audienceMode: e.target.value as "email" | "id" })}
                  >
                    <option value="email">E-mail</option>
                    <option value="id">ID do usuário</option>
                  </Select>
                </Field>
                <Field
                  label={v.audienceMode === "id" ? "IDs que recebem a pesquisa" : "E-mails que recebem a pesquisa"}
                  hint={
                    v.audienceMode === "id"
                      ? "Cole um ou mais IDs (Enter ou vírgula). O produto deve chamar Luumu.identify({ id })."
                      : "Cole um ou mais e-mails (Enter ou vírgula). O produto deve chamar Luumu.identify({ email })."
                  }
                >
                  <AudienceList
                    mode={v.audienceMode ?? "email"}
                    values={v.audienceList}
                    onChange={(audienceList) => set({ audienceList })}
                  />
                </Field>
              </>
            )}

            <Field label="Idioma">
              <Select value={v.language} onChange={(e) => set({ language: e.target.value })}>
                <option value="pt">Português (BR)</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
              </Select>
            </Field>
            <Field label="Canal">
              <Select value={v.channel} onChange={(e) => set({ channel: e.target.value })}>
                <option>In-app</option>
                <option>E-mail</option>
                <option>Link</option>
                <option>WhatsApp</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-accent" />
            <CardTitle>Gatilho & frequência</CardTitle>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <Field
              label="Gatilhos por evento (SDK)"
              hint="A pesquisa dispara quando qualquer um dos eventos selecionados ocorrer. Sem gatilho, aparece no carregamento."
            >
              <EventMultiSelect
                events={events}
                selected={v.triggerEvents}
                onChange={(triggerEvents) => set({ triggerEvents })}
                refreshing={refreshing}
                onRefresh={() => refreshEvents.current(false)}
              />
            </Field>

            <Field label="Frequência">
              <Select value={v.frequency} onChange={(e) => set({ frequency: e.target.value })}>
                <option>Uma vez por usuário</option>
                <option>Recorrente (30 dias)</option>
                <option>Sempre</option>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Início">
                <Input type="date" value={v.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
              </Field>
              <Field label="Fim">
                <Input type="date" value={v.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
              </Field>
            </div>

            <div className="rounded-xl bg-bg-sunken p-3">
              {events.length === 0 && v.triggerEvents.length === 0 ? (
                <p className="text-xs leading-relaxed text-fg-mut">
                  Nenhum evento capturado ainda. Assim que o SDK for instalado no site, cliques e
                  navegações do produto do cliente aparecem aqui automaticamente, sem precisar
                  escrever código.
                </p>
              ) : v.triggerEvents.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-fg-soft">
                  <span>Dispara com:</span>
                  {v.triggerEvents.map((ev) => (
                    <Badge key={ev} tone="brand" dot={false}>
                      {eventLabel(ev)}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-fg-mut">
                  Sem gatilho por evento: a pesquisa aparece no carregamento (respeitando frequência).
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
          {saved ? "Salvo" : "Salvar configurações"}
        </Button>
      </div>
    </>
  );
}
