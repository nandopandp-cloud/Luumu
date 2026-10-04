"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, GripVertical, Loader2, MoreVertical, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { DataFilters } from "@/components/ui/DataFilters";
import { useToast } from "@/components/ui/Toast";
import { WIDGET_IDS, viewHref, type ViewConfig, type WidgetId } from "@/lib/analytics/core";
import { defaultSpan, WIDGET_DATASETS, type Block } from "@/lib/analytics/derive";
import type { AnalyticsData } from "@/lib/db/analytics";
import { createViewAction, updateViewAction } from "@/app/(app)/analytics/actions";
import { Widget, type WidgetCtx } from "./Widgets";
import { CATALOG, CATEGORIES, widgetName } from "./catalog";

/*
  Grade da visão personalizada: 12 colunas a partir de 640px de ÁREA (container query — com o
  painel de blocos aberto ela encolhe), 2 colunas abaixo disso (indicadores lado a lado, o resto
  em largura cheia). O tamanho de cada bloco é o número de colunas que ele ocupa.
*/
const CQ_SPAN: Record<number, string> = {
  2: "@[40rem]:col-span-2",
  3: "@[40rem]:col-span-3",
  4: "@[40rem]:col-span-4",
  5: "@[40rem]:col-span-5",
  6: "@[40rem]:col-span-6",
  7: "@[40rem]:col-span-7",
  8: "@[40rem]:col-span-8",
  9: "@[40rem]:col-span-9",
  10: "@[40rem]:col-span-10",
  11: "@[40rem]:col-span-11",
  12: "@[40rem]:col-span-12",
};
const GRID = "grid grid-cols-2 gap-5 @[40rem]:grid-cols-12";
const GAP = 20;
const isKpi = (id: WidgetId) => id.startsWith("kpi_");
const spanClass = (b: Block) => cn(isKpi(b.id) ? "col-span-1" : "col-span-2", CQ_SPAN[b.span] ?? CQ_SPAN[defaultSpan(b.id)]);
const minSpan = (id: WidgetId) => (isKpi(id) ? 2 : 3);
const ctxFor = (ctx: WidgetCtx, b: Block) => (isKpi(b.id) && b.span <= 2 ? { ...ctx, dense: true } : ctx);

/** O bloco já tem as consultas de que precisa? (recém-adicionado espera o servidor) */
export const hasData = (data: AnalyticsData, id: WidgetId) => WIDGET_DATASETS[id].every((k) => k in data);

/** Visão personalizada só para leitura (mesma grade do editor). */
export function CustomGrid({ blocks, ctx }: { blocks: Block[]; ctx: WidgetCtx }) {
  return (
    <div className="@container">
      <div className={GRID}>
        {blocks.map((b) => (
          <div key={b.id} className={cn("min-w-0", spanClass(b))}>
            <Widget id={b.id} ctx={ctxFor(ctx, b)} />
          </div>
        ))}
      </div>
    </div>
  );
}

export interface EditStart {
  viewId: string | null;
  name: string;
  goal: string;
  layout: Block[];
  /** para onde voltar ao cancelar */
  returnHref: string;
}

const SIZES = [
  { span: 2, label: "Mínimo", hint: "1/6" },
  { span: 3, label: "Pequeno", hint: "1/4" },
  { span: 4, label: "Médio", hint: "1/3" },
  { span: 6, label: "Metade", hint: "1/2" },
  { span: 8, label: "Grande", hint: "2/3" },
  { span: 12, label: "Largura total", hint: "1/1" },
];

export function ViewEditor({
  start,
  config,
  data,
  hosts,
  ctx,
  onExit,
}: {
  start: EditStart;
  config: ViewConfig;
  data: AnalyticsData;
  hosts: string[];
  ctx: WidgetCtx;
  onExit: (href: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [viewId, setViewId] = useState(start.viewId);
  const [name, setName] = useState(start.name);
  const [layout, setLayout] = useState<Block[]>(start.layout);
  const [saved, setSaved] = useState(() => JSON.stringify({ n: start.name, l: start.layout }));
  const [selected, setSelected] = useState<WidgetId | null>(null);
  const [panel, setPanel] = useState(true);
  const [busy, startSave] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const changed = JSON.stringify({ n: name, l: layout }) !== saved;

  // configuração que vai para o banco/URL: ordem + tamanhos fora do padrão
  const cfgOf = (l: Block[]): ViewConfig => ({
    tab: "custom",
    period: config.period,
    from: config.from,
    to: config.to,
    host: config.host,
    device: config.device,
    widgets: l.map((b) => b.id),
    spans: Object.fromEntries(l.filter((b) => b.span !== defaultSpan(b.id)).map((b) => [b.id, b.span])),
  });

  /*
    Bloco recém-adicionado precisa de consultas que a página ainda não fez: a URL é atualizada
    (o servidor busca só o que falta). Reordenar e redimensionar não vão ao servidor.
  */
  const missing = layout.filter((b) => !hasData(data, b.id)).map((b) => b.id);
  const lastAsked = useRef("");
  useEffect(() => {
    if (!missing.length) return;
    const href = viewHref(cfgOf(layout), viewId ?? undefined);
    if (href === lastAsked.current) return;
    const t = window.setTimeout(() => {
      lastAsked.current = href;
      router.replace(href, { scroll: false });
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing.join(",")]);

  // o bloco recém-adicionado aparece na tela
  const [justAdded, setJustAdded] = useState<WidgetId | null>(null);
  useEffect(() => {
    if (!justAdded) return;
    document.getElementById(`blk-${justAdded}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [justAdded]);

  function add(id: WidgetId) {
    if (layout.some((b) => b.id === id)) return;
    setLayout((l) => [...l, { id, span: defaultSpan(id) }]);
    setSelected(id);
    setJustAdded(id);
  }
  const remove = (id: WidgetId) => setLayout((l) => l.filter((b) => b.id !== id));
  const resize = (id: WidgetId, span: number) => setLayout((l) => l.map((b) => (b.id === id ? { ...b, span } : b)));
  const shift = (id: WidgetId, by: -1 | 1) =>
    setLayout((l) => {
      const i = l.findIndex((b) => b.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= l.length) return l;
      const next = l.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const moveTo = (id: WidgetId, target: WidgetId, after: boolean) =>
    setLayout((l) => {
      const item = l.find((b) => b.id === id);
      if (!item || id === target) return l;
      const rest = l.filter((b) => b.id !== id);
      const at = rest.findIndex((b) => b.id === target) + (after ? 1 : 0);
      const next = [...rest.slice(0, at), item, ...rest.slice(at)];
      return next.map((b) => b.id).join() === l.map((b) => b.id).join() ? l : next;
    });

  function save(exit: boolean) {
    const n = name.trim();
    if (n.length < 2) {
      toast("error", "Dê um nome para a sua visão.");
      nameRef.current?.focus();
      return;
    }
    if (!layout.length) {
      toast("error", "Adicione ao menos um bloco.");
      return;
    }
    startSave(async () => {
      const cfg = cfgOf(layout);
      const input = { name: n, goal: start.goal, shared: false, config: cfg };
      const r = viewId ? await updateViewAction(viewId, input) : await createViewAction(input);
      if (!r.ok) return toast("error", r.error);
      const id = r.id ?? viewId!;
      setViewId(id);
      setSaved(JSON.stringify({ n: name, l: layout }));
      toast("success", viewId ? "Visão salva." : "Visão criada! Ela fica em Minhas visões.");
      const href = viewHref(cfg, id);
      if (exit) onExit(href);
      else router.replace(href, { scroll: false });
    });
  }

  function cancel() {
    if (changed && !window.confirm("Descartar as alterações desta visão?")) return;
    onExit(start.returnHref);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* cabeçalho de edição */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Nome da visão"
              aria-label="Nome da visão"
              className="min-w-0 max-w-full rounded-xl border border-transparent bg-transparent px-2 py-0.5 -ml-2 font-display text-[30px] font-extrabold leading-tight tracking-tight outline-none transition [field-sizing:content] hover:border-line focus:border-accent"
            />
            <span className="rounded-full bg-surface-brand px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Editando</span>
          </div>
          <p className="mt-1 text-[15px] text-fg-mut">Arraste os blocos para reorganizar sua visão. Redimensione ou remova o que não precisar.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="subtle" size="sm" onClick={() => save(false)} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar visão
          </Button>
          <Button size="sm" onClick={() => save(true)} disabled={busy}>
            <Check className="size-4" /> Salvar e sair
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <DataFilters hosts={hosts} />
        {!panel && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setPanel(true)}>
            <Plus className="size-4" /> Adicionar bloco
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1" onPointerDown={(e) => e.target === e.currentTarget && setSelected(null)}>
          <EditableGrid
            layout={layout}
            data={data}
            ctx={ctx}
            selected={selected}
            onSelect={setSelected}
            onResize={resize}
            onRemove={remove}
            onShift={shift}
            onMove={moveTo}
          />
          <button
            type="button"
            onClick={() => {
              setPanel(true);
              window.setTimeout(() => searchRef.current?.focus(), 50);
            }}
            className="mt-5 flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-accent/35 bg-surface-brand/20 px-6 py-6 text-center transition hover:border-accent/60 hover:bg-surface-brand/40"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
              <span className="grid size-6 place-items-center rounded-full [background:var(--grad-roxo)] text-white">
                <Plus className="size-4" />
              </span>
              Adicionar bloco
            </span>
            <span className="text-xs text-fg-mut">Escolha entre mais de {WIDGET_IDS.length} métricas, gráficos e tabelas.</span>
          </button>
        </div>
        {panel && <BlockPanel searchRef={searchRef} used={new Set(layout.map((b) => b.id))} onAdd={add} onClose={() => setPanel(false)} />}
      </div>
    </div>
  );
}

/* ---------- grade editável ---------- */

function EditableGrid({
  layout,
  data,
  ctx,
  selected,
  onSelect,
  onResize,
  onRemove,
  onShift,
  onMove,
}: {
  layout: Block[];
  data: AnalyticsData;
  ctx: WidgetCtx;
  selected: WidgetId | null;
  onSelect: (id: WidgetId | null) => void;
  onResize: (id: WidgetId, span: number) => void;
  onRemove: (id: WidgetId) => void;
  onShift: (id: WidgetId, by: -1 | 1) => void;
  onMove: (id: WidgetId, target: WidgetId, after: boolean) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState<WidgetId | null>(null);
  const [dragging, setDragging] = useState<WidgetId | null>(null);
  const [menu, setMenu] = useState<WidgetId | null>(null);
  const [resizing, setResizing] = useState<{ id: WidgetId; span: number } | null>(null);

  // fecha o menu de um bloco ao clicar fora
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => !(e.target as Element).closest("[data-block-menu]") && setMenu(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  function startResize(e: React.PointerEvent, b: Block) {
    const grid = gridRef.current;
    if (!grid) return;
    // só na grade de 12 colunas (abaixo dela os tamanhos são fixos)
    if (getComputedStyle(grid).gridTemplateColumns.split(" ").length < 12) return;
    e.preventDefault();
    e.stopPropagation();
    const step = (grid.clientWidth + GAP) / 12;
    const x0 = e.clientX;
    const s0 = b.span;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    setResizing({ id: b.id, span: s0 });
    const move = (ev: PointerEvent) => {
      const span = Math.min(12, Math.max(minSpan(b.id), s0 + Math.round((ev.clientX - x0) / step)));
      setResizing({ id: b.id, span });
      onResize(b.id, span);
    };
    const up = () => {
      setResizing(null);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  if (!layout.length) {
    return (
      <div className="grid place-items-center rounded-2xl border-2 border-dashed border-line px-6 py-16 text-center">
        <div>
          <p className="font-display text-lg font-bold">Sua visão está vazia</p>
          <p className="mt-1 text-sm text-fg-mut">Adicione blocos pelo painel ao lado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="@container">
      <div ref={gridRef} className={GRID}>
        {layout.map((b, i) => {
          const sel = selected === b.id;
          const ready = hasData(data, b.id);
          return (
            <div
              key={b.id}
              id={`blk-${b.id}`}
              draggable={armed === b.id}
              onDragStart={(e) => {
                setDragging(b.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", b.id);
              }}
              onDragEnd={() => {
                setDragging(null);
                setArmed(null);
              }}
              onDragOver={(e) => {
                if (!dragging || dragging === b.id) return;
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                // diagonal: à direita OU abaixo do centro = depois deste bloco
                onMove(dragging, b.id, (e.clientX - r.left) / r.width + (e.clientY - r.top) / r.height > 1);
              }}
              onDrop={(e) => e.preventDefault()}
              onClick={() => onSelect(b.id)}
              className={cn(
                "group/blk relative min-w-0 rounded-2xl outline-2 outline-offset-4 transition-[outline-color,opacity]",
                spanClass(b),
                sel ? "outline outline-accent" : "outline-dashed outline-accent/30 hover:outline-accent/60",
                dragging === b.id && "opacity-40"
              )}
            >
              {/* o conteúdo não responde a clique durante a edição (links, filtros, abas) */}
              <div className="pointer-events-none h-full select-none">
                {ready ? <Widget id={b.id} ctx={ctxFor(ctx, b)} /> : <div className="h-full min-h-[150px] animate-pulse rounded-2xl border border-line bg-bg-sunken" aria-label="Carregando bloco" />}
              </div>

              {/* barra do bloco: alça de arrastar + menu (no topo, sem disputar o espaço entre blocos) */}
              <div
                data-block-menu
                className={cn(
                  "absolute -top-3.5 right-4 z-20 flex items-center rounded-lg border border-line bg-bg-elev shadow-[var(--shadow-sm)] transition",
                  sel || menu === b.id ? "opacity-100" : "opacity-75 group-hover/blk:opacity-100 focus-within:opacity-100"
                )}
              >
                <button
                  type="button"
                  aria-label={`Arrastar ${widgetName(b.id)}`}
                  title="Arraste para mover"
                  onPointerDown={() => setArmed(b.id)}
                  onPointerUp={() => !dragging && setArmed(null)}
                  className="grid h-7 w-7 cursor-grab place-items-center rounded-l-lg text-fg-mut transition hover:bg-surface-brand hover:text-accent active:cursor-grabbing"
                >
                  <GripVertical className="size-4" />
                </button>
                <span className="h-4 w-px bg-line" />
                <button
                  type="button"
                  aria-label={`Opções de ${widgetName(b.id)}`}
                  aria-expanded={menu === b.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu(menu === b.id ? null : b.id);
                  }}
                  className="grid h-7 w-7 place-items-center rounded-r-lg text-fg-mut transition hover:bg-surface-brand hover:text-accent"
                >
                  <MoreVertical className="size-4" />
                </button>
                {menu === b.id && (
                  <div role="menu" className="absolute right-0 top-full mt-1.5 w-56 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 shadow-[var(--shadow-lg)] animate-[luumuSelectIn_.14s_ease-out]">
                    <MenuItem icon={ArrowUp} label="Mover para antes" disabled={i === 0} onClick={() => (onShift(b.id, -1), setMenu(null))} />
                    <MenuItem icon={ArrowDown} label="Mover para depois" disabled={i === layout.length - 1} onClick={() => (onShift(b.id, 1), setMenu(null))} />
                    <div className="my-1 border-t border-line" />
                    <div className="px-3 pb-1 pt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-mut">Tamanho</div>
                    {SIZES.filter((s) => s.span >= minSpan(b.id)).map((s) => (
                      <button
                        key={s.span}
                        type="button"
                        role="menuitemradio"
                        aria-checked={b.span === s.span}
                        onClick={() => (onResize(b.id, s.span), setMenu(null))}
                        className={cn("flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition hover:bg-bg-sunken", b.span === s.span && "font-semibold text-accent")}
                      >
                        {s.label}
                        <span className="font-mono text-[11px] text-fg-mut">{s.hint}</span>
                      </button>
                    ))}
                    <div className="my-1 border-t border-line" />
                    <MenuItem icon={Trash2} label="Remover bloco" danger onClick={() => (onRemove(b.id), setMenu(null))} />
                  </div>
                )}
              </div>

              {/* redimensionar (canto inferior direito) */}
              <span
                role="slider"
                aria-label={`Redimensionar ${widgetName(b.id)}`}
                aria-valuemin={minSpan(b.id)}
                aria-valuemax={12}
                aria-valuenow={b.span}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") onResize(b.id, Math.min(12, b.span + 1));
                  if (e.key === "ArrowLeft") onResize(b.id, Math.max(minSpan(b.id), b.span - 1));
                }}
                onPointerDown={(e) => startResize(e, b)}
                className={cn(
                  "absolute -bottom-2 -right-2 z-10 hidden size-4 cursor-ew-resize rounded-[5px] border-2 border-accent bg-bg-elev transition @[40rem]:block",
                  sel || resizing?.id === b.id ? "opacity-100" : "opacity-0 group-hover/blk:opacity-100 focus-visible:opacity-100"
                )}
              />
              {(resizing?.id === b.id || sel) && (
                <span className="pointer-events-none absolute -bottom-9 right-0 z-10 hidden whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-[11px] font-semibold text-bg shadow-[var(--shadow-md)] @[40rem]:block">
                  {resizing?.id === b.id ? `${resizing.span} de 12 colunas` : "Redimensionar"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, disabled, danger }: { icon: typeof Trash2; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-bg-sunken disabled:opacity-40 disabled:hover:bg-transparent", danger ? "text-erro" : "text-fg-soft")}
    >
      <Icon className="size-4" /> {label}
    </button>
  );
}

/* ---------- painel "Adicionar bloco" ---------- */

function BlockPanel({ used, onAdd, onClose, searchRef }: { used: Set<WidgetId>; onAdd: (id: WidgetId) => void; onClose: () => void; searchRef: React.RefObject<HTMLInputElement | null> }) {
  const [q, setQ] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const groups = useMemo(() => {
    const t = norm(q.trim());
    return CATEGORIES.map((c) => ({
      ...c,
      items: WIDGET_IDS.filter((id) => CATALOG[id].category === c.id && (!t || norm(`${widgetName(id)} ${CATALOG[id].description}`).includes(t))),
    })).filter((g) => g.items.length);
  }, [q]);

  return (
    <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-line bg-bg-elev shadow-[var(--shadow-sm)] xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:w-[320px]">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="font-display text-[17px] font-bold">Adicionar bloco</h2>
        <button type="button" onClick={onClose} aria-label="Fechar painel" className="grid size-8 place-items-center rounded-lg text-fg-mut transition hover:bg-bg-sunken hover:text-fg">
          <X className="size-4" />
        </button>
      </div>
      <div className="px-4 pb-3">
        <label className="flex items-center gap-2 rounded-xl border border-line-strong bg-bg px-3 py-2 transition focus-within:border-accent">
          <Search className="size-4 text-fg-mut" aria-hidden />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar blocos…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-mut" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {groups.length === 0 && <p className="py-6 text-center text-sm text-fg-mut">Nenhum bloco para “{q}”.</p>}
        {groups.map((g) => (
          <section key={g.id} className="mb-4 last:mb-0">
            <div className="mb-2 flex items-center gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
              <g.icon className="size-4 text-fg-soft" />
              <span className="text-sm font-bold">{g.label}</span>
              <span className="ml-auto rounded-md bg-bg-sunken px-1.5 py-0.5 font-mono text-[10px] font-semibold text-fg-mut">{g.items.length}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {g.items.map((id) => {
                const on = used.has(id);
                const Icon = CATALOG[id].icon;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={on}
                    onClick={() => onAdd(id)}
                    className="group flex items-center gap-2.5 rounded-xl border border-line px-2.5 py-2 text-left transition hover:border-accent/50 hover:bg-surface-brand/30 disabled:cursor-default disabled:opacity-55 disabled:hover:border-line disabled:hover:bg-transparent"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-brand text-accent">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{widgetName(id)}</span>
                      <span className="block truncate text-[11px] text-fg-mut">{CATALOG[id].description}</span>
                    </span>
                    <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg border transition", on ? "border-transparent text-sucesso" : "border-line text-fg-mut group-hover:border-accent group-hover:text-accent")}>
                      {on ? <Check className="size-4" /> : <Plus className="size-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
