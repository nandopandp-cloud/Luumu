"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "@/components/ui/Link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronRight, LayoutGrid, Loader2, MoreHorizontal, Pencil, Plus, Radio, Settings2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { DataFilters } from "@/components/ui/DataFilters";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { TAB_META, TABS, eventLabel, viewHref, type ViewConfig } from "@/lib/analytics/core";
import { defaultSpan, TAB_LAYOUT, type Block } from "@/lib/analytics/derive";
import type { AnalyticsData, SavedView } from "@/lib/db/analytics";
import { listMetricEventsAction, saveMetricsAction, updateViewAction } from "@/app/(app)/analytics/actions";
import { Widget, type WidgetCtx } from "./Widgets";
import { ToggleCollection } from "./States";
import { UsersView, type UsersData } from "./UsersView";
import { CustomGrid, ViewEditor, type EditStart } from "./ViewEditor";
import { ManageViewsDialog, usePopover, ViewsMenu } from "./ViewsMenu";

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
/*
  Colunas da faixa de KPIs pela largura REAL da área (container query), não da janela: com a
  sidebar aberta num notebook a área tem ~950px e 6 cards por linha ficavam com ~140px, estourando
  título e número. Só vão todos numa linha quando cada card tem ao menos ~190px.
*/
const KPI_COLS: Record<number, string> = {
  1: "",
  2: "@[30rem]:grid-cols-2",
  3: "@[30rem]:grid-cols-2 @[44rem]:grid-cols-3",
  4: "@[30rem]:grid-cols-2 @[56rem]:grid-cols-4",
  5: "@[30rem]:grid-cols-2 @[44rem]:grid-cols-6 @[64rem]:grid-cols-5",
  6: "@[30rem]:grid-cols-2 @[44rem]:grid-cols-3 @[76rem]:grid-cols-6",
};
/** Sem buracos: na linha incompleta os últimos cards se alargam (5 → 3 + 2 mais largos; ímpar em 2 colunas → o último ocupa a linha). */
function kpiItemClass(n: number, i: number) {
  const last = i === n - 1;
  if (n === 3) return last ? "@[30rem]:col-span-2 @[44rem]:col-span-1" : "";
  if (n === 5) return i < 3 ? cn("@[44rem]:col-span-2 @[64rem]:col-span-1", last && "@[30rem]:col-span-2") : cn("@[44rem]:col-span-3 @[64rem]:col-span-1", last && "@[30rem]:col-span-2");
  return "";
}

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
  users = null,
}: {
  config: ViewConfig;
  blocks: Block[];
  data: AnalyticsData;
  /** visões do próprio usuário (individuais) */
  views: SavedView[];
  currentView: SavedView | null;
  dirty: boolean;
  hosts: string[];
  settings: Settings;
  canManage: boolean;
  canConfigure: boolean;
  enabled: boolean;
  since: string | null;
  /** aba Usuários */
  users?: UsersData | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const [dialog, setDialog] = useState<null | "metrics" | "manage">(null);
  const [editing, setEditing] = useState<EditStart | null>(null);
  const meta = TAB_META[config.tab];

  const ctx: WidgetCtx = {
    dense: false,
    data,
    multiHost: hosts.length > 1 && !config.host,
    onConfigure: () => setDialog("metrics"),
    canConfigure,
    settings,
  };

  const here = `${pathname}${sp.toString() ? `?${sp.toString()}` : ""}`;
  /** Blocos de uma visão salva (visão antiga sobre uma aba padrão = os blocos daquela aba). */
  const layoutOf = (v: SavedView): Block[] =>
    v.config.tab === "custom"
      ? (v.config.widgets ?? []).map((id) => ({ id, span: v.config.spans?.[id] ?? defaultSpan(id) }))
      : v.config.tab === "users"
        ? []
        : TAB_LAYOUT[v.config.tab];

  /** Abre o editor: uma visão salva, ou uma nova (vazia ou a partir dos blocos desta aba). */
  function edit(v: SavedView | null, fromCurrent = false) {
    if (v && v.id !== currentView?.id) {
      // outra visão: abre ela (filtros e dados dela) já em modo de edição
      const href = viewHref(v.config, v.id);
      router.push(`${href}${href.includes("?") ? "&" : "?"}edit=1`, { scroll: false });
      return;
    }
    if (v) setEditing({ viewId: v.id, name: v.name, goal: v.goal, layout: config.tab === "custom" ? blocks : layoutOf(v), returnHref: here });
    else setEditing({ viewId: null, name: "", goal: "", layout: fromCurrent ? blocks : [], returnHref: here });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // chegou com ?edit=1 (Editar layout de outra visão): entra no editor dela (ajuste no render,
  // sem efeito em cascata) e o efeito só limpa o parâmetro da URL
  const wantEdit = sp.get("edit") === "1";
  const [editOpenedFor, setEditOpenedFor] = useState<string | null>(null);
  if (wantEdit && currentView && !editing && editOpenedFor !== currentView.id) {
    setEditOpenedFor(currentView.id);
    setEditing({ viewId: currentView.id, name: currentView.name, goal: currentView.goal, layout: config.tab === "custom" ? blocks : layoutOf(currentView), returnHref: viewHref(currentView.config, currentView.id) });
  }
  useEffect(() => {
    if (wantEdit && editing?.viewId) router.replace(editing.returnHref, { scroll: false });
  }, [wantEdit, editing, router]);

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

  if (editing) {
    return (
      <ViewEditor
        start={editing}
        config={config}
        data={data}
        hosts={hosts}
        ctx={{ ...ctx, onConfigure: undefined }}
        onExit={(href) => {
          setEditing(null);
          router.replace(href, { scroll: false });
        }}
      />
    );
  }

  const title = currentView?.name ?? meta.title;
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
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-tight">{title}</h1>
            {currentView && dirty && <SaveChanges view={currentView} config={config} />}
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
          {config.tab !== "users" && (
            <Button variant="subtle" size="sm" onClick={() => edit(currentView, true)}>
              <Pencil className="size-4" /> {currentView ? "Editar" : "Personalizar"}
            </Button>
          )}
          <MoreMenu canConfigure={canConfigure} onManage={() => setDialog("manage")} onMetrics={() => setDialog("metrics")} />
        </div>
      </header>

      {/* visões + filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <ViewsMenu views={views} current={currentView} onNew={() => edit(null)} onEdit={(v) => edit(v)} onManage={() => setDialog("manage")} />
        <Button variant="ghost" size="sm" onClick={() => edit(null)}>
          <Plus className="size-4" /> Nova visão
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DataFilters hosts={hosts} />
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
              href={viewHref({ ...config, tab: t, widgets: t === "custom" ? config.widgets : undefined, spans: t === "custom" ? config.spans : undefined })}
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

      {/* blocos */}
      {config.tab === "users" && users ? (
        <UsersView data={users} />
      ) : config.tab === "custom" && !blocks.length ? (
        <button
          type="button"
          onClick={() => edit(currentView)}
          className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-line px-6 py-16 text-center transition hover:border-accent/50"
        >
          <LayoutGrid className="size-8 text-accent" />
          <span className="font-display text-lg font-bold">Monte a sua visão</span>
          <span className="max-w-md text-sm text-fg-mut">Arraste, redimensione e combine indicadores, gráficos e tabelas de todas as abas. Depois dê um nome e volte a ela quando quiser.</span>
        </button>
      ) : config.tab === "custom" ? (
        <CustomGrid blocks={blocks} ctx={ctx} />
      ) : (
        <div className="flex flex-col gap-5">
          {sections.map((sec, i) =>
            sec.kind === "kpis" ? (
              <div key={i} className="@container">
                <div className={cn("grid grid-cols-1 gap-4", KPI_COLS[Math.min(6, sec.items.length)])}>
                  {sec.items.map((b, j) => (
                    <div key={b.id} className={cn("min-w-0", kpiItemClass(Math.min(6, sec.items.length), j))}>
                      <Widget id={b.id} ctx={sec.items.length >= 5 ? { ...ctx, dense: true } : ctx} />
                    </div>
                  ))}
                </div>
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
      {dialog === "metrics" && <MetricsDialog settings={settings} onClose={() => setDialog(null)} />}
      {dialog === "manage" && (
        <ManageViewsDialog views={views} currentId={currentView?.id ?? null} onClose={() => setDialog(null)} onEdit={(v) => edit(v)} onNew={() => edit(null)} />
      )}
    </div>
  );
}

function MoreMenu({ canConfigure, onManage, onMetrics }: { canConfigure: boolean; onManage: () => void; onMetrics: () => void }) {
  const { open, setOpen, ref } = usePopover();
  const item = (Icon: typeof Settings2, label: string, fn: () => void) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        fn();
      }}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-fg-soft transition hover:bg-bg-sunken"
    >
      <Icon className="size-4" /> {label}
    </button>
  );
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="Mais opções" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="grid size-10 place-items-center rounded-full border border-line-strong text-fg-soft transition hover:border-accent hover:text-accent">
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 shadow-[var(--shadow-lg)] animate-[luumuSelectIn_.14s_ease-out]">
          {item(LayoutGrid, "Gerenciar visões", onManage)}
          {canConfigure && item(Settings2, "Métricas do produto", onMetrics)}
        </div>
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
          const r = await updateViewAction(view.id, { name: view.name, goal: view.goal, shared: false, config });
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

