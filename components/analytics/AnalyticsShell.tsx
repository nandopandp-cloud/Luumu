"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Monitor,
  Pencil,
  Plus,
  Radio,
  Settings2,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { DataFilters } from "@/components/ui/DataFilters";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { TAB_META, TABS, WIDGETS, WIDGET_IDS, eventLabel, viewHref, type ViewConfig, type WidgetId } from "@/lib/analytics/core";
import type { Block } from "@/lib/analytics/derive";
import type { AnalyticsData, SavedView } from "@/lib/db/analytics";
import { createViewAction, deleteViewAction, listMetricEventsAction, saveMetricsAction, updateViewAction } from "@/app/(app)/analytics/actions";
import { Widget, type WidgetCtx } from "./Widgets";
import { ToggleCollection } from "./States";

const SPAN: Record<number, string> = {
  2: "xl:col-span-2",
  3: "xl:col-span-3",
  4: "xl:col-span-4",
  5: "xl:col-span-5",
  6: "xl:col-span-6",
  7: "xl:col-span-7",
  8: "xl:col-span-8",
  12: "xl:col-span-12",
};
const KPI_COLS: Record<number, string> = { 1: "xl:grid-cols-1", 2: "xl:grid-cols-2", 3: "xl:grid-cols-3", 4: "xl:grid-cols-4", 5: "xl:grid-cols-5", 6: "xl:grid-cols-6" };

export interface Settings {
  northStarEvent: string | null;
  activationEvent: string | null;
  taskStartEvent: string | null;
  taskDoneEvent: string | null;
}

export function AnalyticsShell({
  config,
  blocks,
  data,
  views,
  currentView,
  dirty,
  hosts,
  settings,
  canManage,
  canConfigure,
  enabled,
  since,
}: {
  config: ViewConfig;
  blocks: Block[];
  data: AnalyticsData;
  views: SavedView[];
  currentView: SavedView | null;
  dirty: boolean;
  hosts: string[];
  settings: Settings;
  canManage: boolean;
  canConfigure: boolean;
  enabled: boolean;
  since: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const [dialog, setDialog] = useState<null | "save" | "metrics" | "widgets" | { edit: SavedView }>(null);
  const meta = TAB_META[config.tab];

  function setParam(k: string, v: string | null) {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  }

  const ctx: WidgetCtx = {
    dense: false,
    data,
    multiHost: hosts.length > 1 && !config.host,
    onConfigure: () => setDialog("metrics"),
    canConfigure,
    settings,
  };

  // KPIs seguidos formam uma faixa; os demais blocos seguidos dividem uma grade de 12 colunas
  const sections = useMemo(() => {
    const out: { kind: "kpis" | "grid"; items: Block[] }[] = [];
    for (const b of blocks) {
      const kind = b.id.startsWith("kpi_") ? "kpis" : "grid";
      const last = out[out.length - 1];
      if (last?.kind === kind) last.items.push(b);
      else out.push({ kind, items: [b] });
    }
    return out;
  }, [blocks]);

  return (
    <div className="flex flex-col gap-5">
      {/* cabeçalho */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <nav aria-label="Trilha" className="flex items-center gap-1.5 text-sm">
            <Link href="/analytics" className="font-semibold text-accent hover:underline">
              Analytics
            </Link>
            <ChevronRight className="size-3.5 text-fg-mut" />
            <span className="text-fg-soft">{currentView ? currentView.name : meta.label}</span>
          </nav>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ViewSwitcher title={currentView?.name ?? meta.title} views={views} currentId={currentView?.id ?? null} onNew={() => setDialog("save")} onEdit={(v) => setDialog({ edit: v })} />
            {currentView && dirty && currentView.mine && (
              <SaveChanges view={currentView} config={config} />
            )}
            {currentView?.shared && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-brand px-2 py-0.5 text-[11px] font-semibold text-accent">
                <Users className="size-3" /> Do time
              </span>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-[15px] text-fg-mut">{currentView?.goal || meta.subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                toast("success", "Link da visão copiado.");
              } catch {
                toast("error", "Não foi possível copiar o link.");
              }
            }}
          >
            <Share2 className="size-4" /> Compartilhar
          </Button>
          <Button size="sm" onClick={() => setDialog("save")}>
            <Plus className="size-4" /> Nova visão
          </Button>
        </div>
      </header>

      {/* filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <DataFilters hosts={hosts} />
        <Select value={config.device ?? ""} onChange={(e) => setParam("device", e.target.value || null)} aria-label="Dispositivo" icon={<Monitor />} className="w-auto min-w-[200px] py-2 text-sm">
          <option value="">Todos os dispositivos</option>
          <option value="desktop">Desktop</option>
          <option value="mobile">Celular</option>
          <option value="tablet">Tablet</option>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {canConfigure && (
            <button type="button" onClick={() => setDialog("metrics")} className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm font-semibold text-fg-soft transition hover:border-accent hover:text-accent">
              <Settings2 className="size-4" /> Métricas
            </button>
          )}
          <CollectionPill enabled={enabled} canManage={canManage} since={since} />
        </div>
      </div>

      {/* abas */}
      <nav aria-label="Visões padrão" className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 [scrollbar-width:none]">
        {TABS.map((t) => {
          const active = !currentView && config.tab === t;
          return (
            <Link
              key={t}
              href={viewHref({ ...config, tab: t, widgets: t === "custom" ? config.widgets : undefined })}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn("relative whitespace-nowrap px-3.5 py-2.5 text-sm font-semibold transition-colors", active ? "text-accent" : "text-fg-mut hover:text-fg-soft")}
            >
              {TAB_META[t].label}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full [background:var(--grad-marca)]" />}
            </Link>
          );
        })}
      </nav>

      {config.tab === "custom" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-accent/40 bg-surface-brand/30 px-5 py-3.5">
          <p className="text-sm text-fg-soft">
            {blocks.length ? `${blocks.length} ${blocks.length === 1 ? "bloco" : "blocos"} nesta visão.` : "Escolha os blocos que respondem às perguntas do seu time."} Salve como uma visão para voltar a ela quando quiser.
          </p>
          <Button size="sm" variant="ghost" onClick={() => setDialog("widgets")}>
            <LayoutGrid className="size-4" /> Escolher blocos
          </Button>
        </div>
      )}

      {/* blocos */}
      {config.tab === "custom" && !blocks.length ? (
        <button
          type="button"
          onClick={() => setDialog("widgets")}
          className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-line px-6 py-16 text-center transition hover:border-accent/50"
        >
          <LayoutGrid className="size-8 text-accent" />
          <span className="font-display text-lg font-bold">Monte a sua visão</span>
          <span className="max-w-md text-sm text-fg-mut">Indicadores, gráficos e tabelas de todas as abas, só os que importam para o seu objetivo.</span>
        </button>
      ) : (
        <div className="flex flex-col gap-5">
          {sections.map((sec, i) =>
            sec.kind === "kpis" ? (
              <div key={i} className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", KPI_COLS[Math.min(6, sec.items.length)])}>
                {sec.items.map((b) => (
                  <Widget key={b.id} id={b.id} ctx={sec.items.length >= 5 ? { ...ctx, dense: true } : ctx} />
                ))}
              </div>
            ) : (
              <div key={i} className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                {sec.items.map((b) => (
                  <div key={b.id} className={cn("min-w-0", SPAN[b.span] ?? "xl:col-span-6")}>
                    <Widget id={b.id} ctx={ctx} />
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* diálogos */}
      {(dialog === "save" || (dialog && typeof dialog === "object")) && (
        <SaveViewDialog config={config} edit={typeof dialog === "object" ? dialog.edit : null} onClose={() => setDialog(null)} />
      )}
      {dialog === "metrics" && <MetricsDialog settings={settings} onClose={() => setDialog(null)} />}
      {dialog === "widgets" && (
        <WidgetsDialog
          selected={config.widgets ?? []}
          onClose={() => setDialog(null)}
          onApply={(w) => {
            setDialog(null);
            const p = new URLSearchParams(sp.toString());
            p.set("tab", "custom");
            if (w.length) p.set("w", w.join(","));
            else p.delete("w");
            router.push(`${pathname}?${p.toString()}`, { scroll: false });
          }}
        />
      )}
    </div>
  );
}

/* ---------- seletor de visões ---------- */

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function ViewSwitcher({ title, views, currentId, onNew, onEdit }: { title: string; views: SavedView[]; currentId: string | null; onNew: () => void; onEdit: (v: SavedView) => void }) {
  const { open, setOpen, ref } = usePopover();
  const mine = views.filter((v) => v.mine);
  const team = views.filter((v) => !v.mine);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="group inline-flex items-center gap-2 rounded-xl text-left">
        <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-tight">{title}</h1>
        <ChevronDown className={cn("size-6 text-fg-mut transition group-hover:text-accent", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-[340px] overflow-hidden rounded-2xl border border-line bg-bg-elev shadow-[var(--shadow-lg)] animate-[luumuSelectIn_.14s_ease-out]">
          <div className="max-h-[420px] overflow-y-auto p-2">
            <Group label="Visões padrão">
              {TABS.filter((t) => t !== "custom").map((t) => (
                <ViewLink key={t} href={viewHref({ tab: t })} label={TAB_META[t].label} active={false} onClick={() => setOpen(false)} />
              ))}
            </Group>
            <Group label="Minhas visões">
              {mine.length ? (
                mine.map((v) => (
                  <ViewLink
                    key={v.id}
                    href={viewHref(v.config, v.id)}
                    label={v.name}
                    hint={v.goal || TAB_META[v.config.tab].label}
                    active={v.id === currentId}
                    shared={v.shared}
                    onClick={() => setOpen(false)}
                    onEdit={() => {
                      setOpen(false);
                      onEdit(v);
                    }}
                  />
                ))
              ) : (
                <p className="px-3 py-2 text-xs text-fg-mut">Salve filtros e blocos para voltar a eles depois.</p>
              )}
            </Group>
            {team.length > 0 && (
              <Group label="Do time">
                {team.map((v) => (
                  <ViewLink key={v.id} href={viewHref(v.config, v.id)} label={v.name} hint={v.goal || TAB_META[v.config.tab].label} active={v.id === currentId} onClick={() => setOpen(false)} />
                ))}
              </Group>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onNew();
            }}
            className="flex w-full items-center gap-2 border-t border-line px-4 py-3 text-sm font-semibold text-accent transition hover:bg-surface-brand/50"
          >
            <Plus className="size-4" /> Salvar a visão atual
          </button>
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="px-3 pb-1 pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-mut">{label}</div>
      {children}
    </div>
  );
}

function ViewLink({ href, label, hint, active, shared, onClick, onEdit }: { href: string; label: string; hint?: string; active: boolean; shared?: boolean; onClick: () => void; onEdit?: () => void }) {
  return (
    <div className={cn("group flex items-center gap-1 rounded-xl", active && "bg-surface-brand/60")}>
      <Link href={href} onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2 transition hover:bg-bg-sunken">
        <Bookmark className={cn("size-4 shrink-0", active ? "fill-accent text-accent" : "text-fg-mut")} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{label}</span>
          {hint && <span className="block truncate text-xs text-fg-mut">{hint}</span>}
        </span>
        {shared && <Users className="ml-auto size-3.5 shrink-0 text-fg-mut" aria-label="Compartilhada com o time" />}
      </Link>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={`Editar ${label}`} className="mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-fg-mut opacity-0 transition hover:bg-bg-sunken hover:text-accent group-hover:opacity-100 focus-visible:opacity-100">
          <Pencil className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function SaveChanges({ view, config }: { view: SavedView; config: ViewConfig }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const r = await updateViewAction(view.id, { name: view.name, goal: view.goal, shared: view.shared, config });
          if (!r.ok) return toast("error", r.error);
          toast("success", "Visão atualizada.");
          router.replace(viewHref(config, view.id), { scroll: false });
        })
      }
      className="inline-flex items-center gap-1.5 rounded-full bg-aviso/15 px-3 py-1 text-xs font-bold text-aviso transition hover:bg-aviso/25"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Salvar alterações
    </button>
  );
}

/* ---------- diálogos ---------- */

function SaveViewDialog({ config, edit, onClose }: { config: ViewConfig; edit: SavedView | null; onClose: () => void }) {
  const [name, setName] = useState(edit?.name ?? "");
  const [goal, setGoal] = useState(edit?.goal ?? "");
  const [shared, setShared] = useState(edit?.shared ?? false);
  const [busy, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const cfg = edit ? edit.config : config;

  const summary = [
    TAB_META[cfg.tab].label,
    cfg.period === "custom" && cfg.from && cfg.to ? `${cfg.from} a ${cfg.to}` : { "7d": "7 dias", "30d": "30 dias", "90d": "90 dias", "12m": "12 meses", all: "todo o período" }[cfg.period ?? "30d"] ?? "30 dias",
    cfg.host ?? "todas as plataformas",
    cfg.device ? { desktop: "desktop", mobile: "celular", tablet: "tablet" }[cfg.device] : "todos os dispositivos",
    cfg.tab === "custom" ? `${cfg.widgets?.length ?? 0} blocos` : null,
  ].filter(Boolean);

  function submit() {
    start(async () => {
      const input = { name, goal, shared, config: cfg };
      const r = edit ? await updateViewAction(edit.id, input) : await createViewAction(input);
      if (!r.ok) return toast("error", r.error);
      toast("success", edit ? "Visão atualizada." : "Visão salva! Ela fica no seletor ao lado do título.");
      onClose();
      router.push(viewHref(cfg, r.id ?? edit?.id), { scroll: false });
    });
  }

  function remove() {
    if (!edit) return;
    start(async () => {
      const r = await deleteViewAction(edit.id);
      if (!r.ok) return toast("error", r.error);
      toast("success", "Visão excluída.");
      onClose();
      router.push(viewHref({ tab: edit.config.tab }), { scroll: false });
    });
  }

  return (
    <Dialog
      title={edit ? "Editar visão" : "Salvar visão"}
      description={edit ? undefined : "Guarde esta combinação de aba, filtros e blocos para acompanhar um objetivo."}
      onClose={onClose}
      footer={
        <>
          {edit && (
            <Button variant="ghost" size="sm" onClick={remove} disabled={busy} className="mr-auto text-erro">
              <Trash2 className="size-4" /> Excluir
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={submit} disabled={busy || name.trim().length < 2}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {edit ? "Salvar" : "Salvar visão"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-fg-soft">Nome</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Ex.: Ativação de novos alunos"
            className="rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm outline-none transition focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-fg-soft">Objetivo (opcional)</span>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            maxLength={160}
            rows={2}
            placeholder="O que esta visão ajuda a acompanhar?"
            className="resize-none rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm outline-none transition focus:border-accent"
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line p-3.5">
          <span>
            <span className="block text-sm font-semibold">Compartilhar com o time</span>
            <span className="block text-xs text-fg-mut">Todos do projeto veem esta visão em “Do time”.</span>
          </span>
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="size-5 accent-[var(--accent)]" />
        </label>
        <div className="rounded-xl bg-bg-sunken px-3.5 py-2.5 text-xs text-fg-mut">
          <span className="font-semibold text-fg-soft">O que é salvo: </span>
          {summary.join(" · ")}
        </div>
      </div>
    </Dialog>
  );
}

function MetricsDialog({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const [v, setV] = useState(settings);
  const [events, setEvents] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    listMetricEventsAction().then((e) => alive && setEvents(e));
    return () => {
      alive = false;
    };
  }, []);
  const [busy, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const opts = Array.from(new Set([...(events ?? []), ...Object.values(settings).filter((x): x is string => !!x)]));

  const field = (k: keyof Settings, label: string, hint: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-fg-soft">{label}</span>
      <Select value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value || null })} aria-label={label} className="py-2 text-sm">
        <option value="">Nenhum</option>
        {opts.map((e) => (
          <option key={e} value={e}>
            {eventLabel(e)} ({e})
          </option>
        ))}
      </Select>
      <span className="text-xs text-fg-mut">{hint}</span>
    </label>
  );

  return (
    <Dialog
      title="Métricas do produto"
      description="Escolha, entre os eventos reais do seu produto, os que definem cada métrica."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              start(async () => {
                const r = await saveMetricsAction(v);
                if (!r.ok) return toast("error", r.error);
                toast("success", "Métricas atualizadas.");
                onClose();
                router.refresh();
              })
            }
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar
          </Button>
        </>
      }
    >
      {events === null ? (
        <div className="flex items-center gap-2 py-8 text-sm text-fg-mut">
          <Loader2 className="size-4 animate-spin" /> Carregando os eventos do seu produto…
        </div>
      ) : opts.length === 0 ? (
        <p className="rounded-xl bg-bg-sunken p-4 text-sm text-fg-mut">
          Ainda não há eventos coletados. Cliques e envios de formulário entram automaticamente; ações específicas podem ser enviadas com <code className="font-mono text-xs">Luumu.track(&quot;nome&quot;)</code>.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {field("northStarEvent", "North Star", "A ação que mais representa o valor do seu produto. Card: % dos ativos que a realizaram.")}
          {field("activationEvent", "Evento de ativação", "Quando um novo usuário “pega” o produto. Sem ele, conta qualquer ação nos primeiros 7 dias.")}
          {field("taskStartEvent", "Início da tarefa principal", "Usado no Task Success e no funil de engajamento.")}
          {field("taskDoneEvent", "Conclusão da tarefa principal", "Task Success = concluíram ÷ iniciaram.")}
        </div>
      )}
    </Dialog>
  );
}

const GROUPS: { label: string; filter: (w: WidgetId) => boolean }[] = [
  { label: "Indicadores", filter: (w) => w.startsWith("kpi_") },
  { label: "Gráficos e funis", filter: (w) => !w.startsWith("kpi_") && /trend|funnel|donut|devices|session_time|curve|frequency|hours|device_time$/.test(w) },
  { label: "Tabelas e listas", filter: (w) => !w.startsWith("kpi_") && !/trend|funnel|donut|devices|session_time|curve|frequency|hours|device_time$/.test(w) },
];

function WidgetsDialog({ selected, onClose, onApply }: { selected: WidgetId[]; onClose: () => void; onApply: (w: WidgetId[]) => void }) {
  const [sel, setSel] = useState<WidgetId[]>(selected);
  const toggle = (w: WidgetId) => setSel((s) => (s.includes(w) ? s.filter((x) => x !== w) : [...s, w]));
  return (
    <Dialog
      title="Escolher blocos"
      description="Os blocos aparecem na ordem em que você os marcar."
      size="xl"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-sm text-fg-mut">{sel.length} selecionados</span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => onApply(sel)}>
            <Check className="size-4" /> Aplicar
          </Button>
        </>
      }
    >
      <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-mut">{g.label}</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {WIDGET_IDS.filter(g.filter).map((w) => {
                const on = sel.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggle(w)}
                    aria-pressed={on}
                    className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition", on ? "border-accent bg-surface-brand/60 font-semibold text-accent" : "border-line text-fg-soft hover:border-accent/40")}
                  >
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border text-[10px] font-bold", on ? "border-accent bg-accent text-white" : "border-line-strong")}>
                      {on ? sel.indexOf(w) + 1 : ""}
                    </span>
                    {WIDGETS[w]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function CollectionPill({ enabled, canManage, since }: { enabled: boolean; canManage: boolean; since: string | null }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm font-semibold text-fg-soft transition hover:border-accent/50">
        <span className="relative flex size-2.5">
          {enabled && <span className="absolute inline-flex size-full animate-ping rounded-full bg-sucesso opacity-60" />}
          <span className={cn("relative inline-flex size-2.5 rounded-full", enabled ? "bg-sucesso" : "bg-fg-mut")} />
        </span>
        {enabled ? "Coletando" : "Coleta pausada"}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-line bg-bg-elev p-4 shadow-[var(--shadow-lg)] animate-[luumuSelectIn_.14s_ease-out]">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Radio className="size-4 text-accent" /> Coleta de Analytics
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-mut">
            {since ? `Dados desde ${new Date(since).toLocaleDateString("pt-BR")}. Quem já usava o produto antes disso aparece como “novo” na primeira visita registrada.` : "Ainda sem dados."}
          </p>
          <div className="mt-3 border-t border-line pt-2">
            {canManage ? (
              enabled ? <ToggleCollection enable={false} compact /> : <ToggleCollection enable label="Retomar coleta" />
            ) : (
              <p className="text-xs text-fg-mut">Só donos e administradores podem pausar ou retomar.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

