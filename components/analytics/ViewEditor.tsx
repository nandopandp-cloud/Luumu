"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, GripVertical, LayoutGrid, Loader2, MoreVertical, Plus, Search, Trash2, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
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
/** 3 colunas no mínimo: com o painel de blocos aberto, 2 colunas viram ~110px e o texto quebra letra a letra */
const MIN_SPAN = 3;
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
  // blocos vindos de uma aba padrão (indicadores com 2 colunas) sobem para o mínimo do editor
  const [layout, setLayout] = useState<Block[]>(() => start.layout.map((b) => ({ ...b, span: Math.max(b.span, MIN_SPAN) })));
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
  const reorder = (order: WidgetId[]) => setLayout((l) => order.map((id) => l.find((b) => b.id === id)!).filter(Boolean));

  // sem nome ao salvar: pede num modal (com sugestões) em vez de só um aviso
  const [askName, setAskName] = useState<null | { exit: boolean }>(null);

  function save(exit: boolean, nameOverride?: string) {
    const n = (nameOverride ?? name).trim();
    if (!layout.length) {
      toast("error", "Adicione ao menos um bloco antes de salvar.");
      return;
    }
    if (n.length < 2) {
      setAskName({ exit });
      return;
    }
    startSave(async () => {
      const cfg = cfgOf(layout);
      const input = { name: n, goal: start.goal, shared: false, config: cfg };
      if (nameOverride !== undefined) setName(n);
      const r = viewId ? await updateViewAction(viewId, input) : await createViewAction(input);
      if (!r.ok) return toast("error", r.error);
      const id = r.id ?? viewId!;
      setViewId(id);
      setSaved(JSON.stringify({ n, l: layout }));
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
            onReorder={reorder}
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

      {askName && (
        <NameDialog
          exit={askName.exit}
          busy={busy}
          layout={layout}
          onClose={() => {
            setAskName(null);
            nameRef.current?.focus();
          }}
          onConfirm={(n) => {
            setAskName(null);
            save(askName.exit, n);
          }}
        />
      )}
    </div>
  );
}

/** "Como vamos chamar esta visão?" — aparece ao salvar sem nome, com sugestões pelos blocos. */
function NameDialog({ exit, busy, layout, onClose, onConfirm }: { exit: boolean; busy: boolean; layout: Block[]; onClose: () => void; onConfirm: (name: string) => void }) {
  const [value, setValue] = useState("");
  const suggestions = useMemo(() => {
    const count = new Map<string, number>();
    for (const b of layout) count.set(CATALOG[b.id].category, (count.get(CATALOG[b.id].category) ?? 0) + 1);
    const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const label = CATEGORIES.find((c) => c.id === top)?.label;
    const byCategory: Record<string, string> = {
      metrics: "Indicadores principais",
      charts: "Tendências do produto",
      users: "Base de usuários",
      engagement: "Engajamento dos usuários",
      retention: "Retenção de usuários",
      acquisition: "Aquisição e canais",
      pages: "Páginas e navegação",
      devices: "Dispositivos e acesso",
      events: "Ações e eventos",
    };
    return [...new Set([top ? byCategory[top] : null, "Minha visão de produto", "Acompanhamento semanal", "Relatório executivo", label ? `Visão de ${label.toLowerCase()}` : null].filter((x): x is string => !!x))].slice(0, 4);
  }, [layout]);
  const ok = value.trim().length >= 2;
  return (
    <Dialog
      title="Como vamos chamar esta visão?"
      description="Dê um nome para encontrar esta visão depois em Minhas visões."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Voltar
          </Button>
          <Button size="sm" disabled={!ok || busy} onClick={() => onConfirm(value)}>
            <Check className="size-4" /> {exit ? "Salvar e sair" : "Salvar visão"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onConfirm(value);
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center gap-3 rounded-2xl bg-surface-brand/40 p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl [background:var(--grad-roxo)] text-white">
            <LayoutGrid className="size-5" />
          </span>
          <p className="text-xs leading-relaxed text-fg-soft">
            Sua visão tem <strong>{layout.length} {layout.length === 1 ? "bloco" : "blocos"}</strong>. Só você vê as suas visões, e pode renomear quando quiser.
          </p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-fg-soft">Nome da visão</span>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={60}
            placeholder="Ex.: Ativação de novos alunos"
            className="rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm outline-none transition focus:border-accent"
          />
        </label>
        <div>
          <div className="mb-2 text-xs font-semibold text-fg-mut">Sugestões</div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((sg) => (
              <button
                key={sg}
                type="button"
                onClick={() => setValue(sg)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  value === sg ? "border-accent bg-surface-brand text-accent" : "border-line text-fg-soft hover:border-accent/50 hover:text-accent"
                )}
              >
                {sg}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Dialog>
  );
}

/* ---------- grade editável ---------- */

type DragState = {
  id: WidgetId;
  /** tamanho do bloco ao ser pego (a "fantasia" e o espaço reservado usam) */
  w: number;
  h: number;
  /** onde o ponteiro pegou o bloco */
  offX: number;
  offY: number;
  x: number;
  y: number;
  /** posição de inserção na lista SEM o bloco arrastado */
  index: number;
};

const PH = "__placeholder";

/** Caixa da "fantasia": legível em blocos estreitos, contida em blocos largos; o ponto de pega acompanha a proporção. */
function ghostBox(d: DragState) {
  const w = Math.min(Math.max(d.w, 280), 440);
  const h = Math.min(d.h, 220);
  return { w, h, offX: (d.offX / d.w) * w, offY: Math.min(d.offY, h - 24) };
}
const EDGE = 90; // px da borda da janela em que a página rola sozinha

function EditableGrid({
  layout,
  data,
  ctx,
  selected,
  onSelect,
  onResize,
  onRemove,
  onShift,
  onReorder,
}: {
  layout: Block[];
  data: AnalyticsData;
  ctx: WidgetCtx;
  selected: WidgetId | null;
  onSelect: (id: WidgetId | null) => void;
  onResize: (id: WidgetId, span: number) => void;
  onRemove: (id: WidgetId) => void;
  onShift: (id: WidgetId, by: -1 | 1) => void;
  onReorder: (order: WidgetId[]) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const [drag, setDragState] = useState<DragState | null>(null);
  // espelho do estado para os eventos de ponteiro/animação (sempre o valor mais recente)
  const dragRef = useRef<DragState | null>(null);
  const setDrag = (d: DragState | null) => {
    dragRef.current = d;
    setDragState(d);
  };
  const [menu, setMenu] = useState<WidgetId | null>(null);
  const [resizing, setResizing] = useState<{ id: WidgetId; span: number } | null>(null);
  const justDragged = useRef(false);
  const dropFrom = useRef<{ id: WidgetId; left: number; top: number } | null>(null);

  // fecha o menu de um bloco ao clicar fora
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => !(e.target as Element).closest("[data-block-menu]") && setMenu(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  const dragged = drag ? layout.find((b) => b.id === drag.id) ?? null : null;
  const rest = drag ? layout.filter((b) => b.id !== drag.id) : layout;
  // o que está na tela: durante o arraste, o espaço reservado ocupa o lugar de destino
  const shown: (Block | typeof PH)[] = drag ? [...rest.slice(0, drag.index), PH, ...rest.slice(drag.index)] : layout;
  const orderKey = shown.map((b) => (b === PH ? PH : `${b.id}:${b.span}`)).join(",");

  /*
    Animação dos vizinhos (FLIP): quando o espaço reservado muda de lugar, cada bloco desliza da
    posição antiga para a nova em vez de pular. Posições guardadas em coordenadas da PÁGINA, para a
    rolagem automática não virar animação.
  */
  const prevPos = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const next = new Map<string, { x: number; y: number }>();
    for (const [key, el] of els.current) {
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      const pos = { x: r.left + window.scrollX, y: r.top + window.scrollY };
      next.set(key, pos);
      const before = prevPos.current.get(key);
      const from = dropFrom.current;
      if (from && key === from.id) {
        // o bloco solto "pousa" de onde a fantasia estava
        el.animate([{ transform: `translate(${from.left - r.left}px, ${from.top - r.top}px) scale(1.02)` }, { transform: "none" }], { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" });
        dropFrom.current = null;
      } else if (before && (Math.abs(before.x - pos.x) > 1 || Math.abs(before.y - pos.y) > 1) && key !== PH) {
        el.animate([{ transform: `translate(${before.x - pos.x}px, ${before.y - pos.y}px)` }, { transform: "none" }], { duration: 200, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
    }
    prevPos.current = next;
  }, [orderKey]);

  /** Onde inserir para o ponteiro em (x, y): o bloco sob o ponteiro (ou o mais próximo) e o lado dele. */
  function indexAt(x: number, y: number, d: DragState): number {
    const others = layout.filter((b) => b.id !== d.id);
    let best: { j: number; r: DOMRect; dist: number } | null = null;
    for (let j = 0; j < others.length; j++) {
      const el = els.current.get(others[j].id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const inside = x >= r.left - GAP / 2 && x <= r.right + GAP / 2 && y >= r.top - GAP / 2 && y <= r.bottom + GAP / 2;
      const dist = inside ? -1 : Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (!best || dist < best.dist) best = { j, r, dist };
    }
    // sobre o próprio espaço reservado: fica onde está (evita o vai-e-vem)
    const ph = els.current.get(PH)?.getBoundingClientRect();
    if (ph && x >= ph.left && x <= ph.right && y >= ph.top && y <= ph.bottom) return d.index;
    if (!best) return 0;
    // abaixo de tudo = fim da lista
    const last = els.current.get(others[others.length - 1]?.id)?.getBoundingClientRect();
    if (last && y > last.bottom + GAP && best.dist >= 0) return others.length;
    const r = best.r;
    // diagonal: à direita OU abaixo do centro do bloco = depois dele
    const after = (x - r.left) / r.width + (y - r.top) / r.height > 1;
    return best.j + (after ? 1 : 0);
  }

  // rolagem automática perto das bordas da janela, enquanto arrasta
  useEffect(() => {
    if (!drag) return;
    let raf = 0;
    const tick = () => {
      const d = dragRef.current;
      if (!d) return;
      const v = d.y < EDGE ? -(EDGE - d.y) / 4 : d.y > window.innerHeight - EDGE ? (d.y - (window.innerHeight - EDGE)) / 4 : 0;
      if (v) {
        window.scrollBy(0, Math.max(-24, Math.min(24, v)));
        const index = indexAt(d.x, d.y, d);
        if (index !== d.index) setDrag({ ...d, index });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag]);

  /*
    Arrastar pelo bloco INTEIRO (menos menu e alça de tamanho). Mouse: começa depois de 5px de
    movimento (um clique simples só seleciona). Toque: segurar ~0,2s — sem isso o arraste
    roubaria a rolagem da página no celular.
  */
  function onBlockPointerDown(e: React.PointerEvent<HTMLElement>, b: Block) {
    if (e.button !== 0 || (e.target as Element).closest("[data-no-drag]")) return;
    const el = e.currentTarget;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const touch = e.pointerType === "touch";
    let started = false;
    let timer = 0;
    let frame = 0;
    let last = { x: x0, y: y0 };

    const begin = (x: number, y: number) => {
      started = true;
      const r = el.getBoundingClientRect();
      const d: DragState = { id: b.id, w: r.width, h: r.height, offX: x0 - r.left, offY: y0 - r.top, x, y, index: layout.findIndex((it) => it.id === b.id) };
      setDrag(d);
      setMenu(null);
      onSelect(b.id);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      if (touch) navigator.vibrate?.(8);
    };
    const move = (ev: PointerEvent) => {
      last = { x: ev.clientX, y: ev.clientY };
      if (!started) {
        const dist = Math.hypot(ev.clientX - x0, ev.clientY - y0);
        if (touch) {
          if (dist > 8) cleanup(); // é rolagem, não arraste
          return;
        }
        if (dist < 5) return;
        begin(ev.clientX, ev.clientY);
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const d = dragRef.current;
        if (!d) return;
        const index = indexAt(last.x, last.y, d);
        setDrag({ ...d, x: last.x, y: last.y, index });
      });
    };
    const blockScroll = (ev: TouchEvent) => started && ev.preventDefault();
    const finish = (commit: boolean) => {
      const d = dragRef.current;
      if (started && d) {
        justDragged.current = true;
        window.setTimeout(() => (justDragged.current = false), 0);
        if (commit) {
          const others = layout.filter((it) => it.id !== d.id).map((it) => it.id);
          const order = [...others.slice(0, d.index), d.id, ...others.slice(d.index)];
          const g = ghostBox(d);
          dropFrom.current = { id: d.id, left: d.x - g.offX, top: d.y - g.offY };
          if (order.join() !== layout.map((it) => it.id).join()) onReorder(order);
        }
        setDrag(null);
      }
      cleanup();
    };
    const up = () => finish(true);
    const key = (ev: KeyboardEvent) => ev.key === "Escape" && finish(false);
    function cleanup() {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key);
      window.removeEventListener("touchmove", blockScroll);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key);
    if (touch) {
      window.addEventListener("touchmove", blockScroll, { passive: false });
      timer = window.setTimeout(() => begin(last.x, last.y), 220);
    }
  }

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
      const span = Math.min(12, Math.max(MIN_SPAN, s0 + Math.round((ev.clientX - x0) / step)));
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

  const setEl = (key: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(key, el);
    else els.current.delete(key);
  };

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
        {shown.map((b) => {
          if (b === PH) {
            return (
              <div
                key={PH}
                ref={setEl(PH)}
                aria-hidden
                className={cn(
                  "grid min-w-0 place-items-center rounded-2xl border-2 border-dashed border-accent bg-surface-brand/40 shadow-[inset_0_0_0_6px_color-mix(in_srgb,var(--accent)_8%,transparent)]",
                  dragged && spanClass(dragged)
                )}
                style={{ height: drag?.h }}
              >
                <span className="flex flex-col items-center gap-1 text-center">
                  <span className="grid size-9 place-items-center rounded-full bg-accent/15 text-accent">
                    <ArrowDown className="size-4 animate-bounce" />
                  </span>
                  <span className="text-sm font-semibold text-accent">Soltar aqui</span>
                </span>
              </div>
            );
          }
          const i = layout.findIndex((x) => x.id === b.id);
          const sel = selected === b.id;
          const ready = hasData(data, b.id);
          return (
            <div
              key={b.id}
              id={`blk-${b.id}`}
              ref={setEl(b.id)}
              onPointerDown={(e) => onBlockPointerDown(e, b)}
              onClick={() => !justDragged.current && onSelect(b.id)}
              className={cn(
                "group/blk relative min-w-0 cursor-grab touch-manipulation rounded-2xl outline-2 outline-offset-4 transition-[outline-color,box-shadow] active:cursor-grabbing",
                spanClass(b),
                sel ? "outline outline-accent" : "outline-dashed outline-accent/30 hover:outline-accent/70 hover:shadow-[var(--shadow-md)]"
              )}
            >
              {/* o conteúdo não responde a clique durante a edição (links, filtros, abas) */}
              <div className="pointer-events-none h-full select-none">
                {ready ? <Widget id={b.id} ctx={ctxFor(ctx, b)} /> : <div className="h-full min-h-[150px] animate-pulse rounded-2xl border border-line bg-bg-sunken" aria-label="Carregando bloco" />}
              </div>

              {/* barra do bloco: alça (também move pelo teclado) + menu */}
              <div
                data-block-menu
                className={cn(
                  "absolute -top-3.5 right-4 z-20 flex items-center rounded-lg border border-line bg-bg-elev shadow-[var(--shadow-sm)] transition",
                  sel || menu === b.id ? "opacity-100" : "opacity-75 group-hover/blk:opacity-100 focus-within:opacity-100"
                )}
              >
                <button
                  type="button"
                  aria-label={`Mover ${widgetName(b.id)} (setas do teclado)`}
                  title="Arraste o bloco para mover"
                  onKeyDown={(e) => {
                    const by = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : 0;
                    if (by) {
                      e.preventDefault();
                      onShift(b.id, by);
                    }
                  }}
                  className="grid h-7 w-7 cursor-grab place-items-center rounded-l-lg text-fg-mut transition hover:bg-surface-brand hover:text-accent"
                >
                  <GripVertical className="size-4" />
                </button>
                <span className="h-4 w-px bg-line" />
                <button
                  type="button"
                  data-no-drag
                  aria-label={`Opções de ${widgetName(b.id)}`}
                  aria-expanded={menu === b.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu(menu === b.id ? null : b.id);
                  }}
                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-r-lg text-fg-mut transition hover:bg-surface-brand hover:text-accent"
                >
                  <MoreVertical className="size-4" />
                </button>
                {menu === b.id && (
                  <div data-no-drag role="menu" className="absolute right-0 top-full mt-1.5 w-56 cursor-default overflow-hidden rounded-xl border border-line bg-bg-elev py-1 shadow-[var(--shadow-lg)] animate-[luumuSelectIn_.14s_ease-out]">
                    <MenuItem icon={ArrowUp} label="Mover para antes" disabled={i === 0} onClick={() => (onShift(b.id, -1), setMenu(null))} />
                    <MenuItem icon={ArrowDown} label="Mover para depois" disabled={i === layout.length - 1} onClick={() => (onShift(b.id, 1), setMenu(null))} />
                    <div className="my-1 border-t border-line" />
                    <div className="px-3 pb-1 pt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-mut">Tamanho</div>
                    {SIZES.filter((sz) => sz.span >= MIN_SPAN).map((sz) => (
                      <button
                        key={sz.span}
                        type="button"
                        role="menuitemradio"
                        aria-checked={b.span === sz.span}
                        onClick={() => (onResize(b.id, sz.span), setMenu(null))}
                        className={cn("flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition hover:bg-bg-sunken", b.span === sz.span && "font-semibold text-accent")}
                      >
                        {sz.label}
                        <span className="font-mono text-[11px] text-fg-mut">{sz.hint}</span>
                      </button>
                    ))}
                    <div className="my-1 border-t border-line" />
                    <MenuItem icon={Trash2} label="Remover bloco" danger onClick={() => (onRemove(b.id), setMenu(null))} />
                  </div>
                )}
              </div>

              {/* redimensionar (canto inferior direito) */}
              <span
                data-no-drag
                role="slider"
                aria-label={`Redimensionar ${widgetName(b.id)}`}
                title="Arraste para redimensionar"
                aria-valuemin={MIN_SPAN}
                aria-valuemax={12}
                aria-valuenow={b.span}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") onResize(b.id, Math.min(12, b.span + 1));
                  if (e.key === "ArrowLeft") onResize(b.id, Math.max(MIN_SPAN, b.span - 1));
                }}
                onPointerDown={(e) => startResize(e, b)}
                className={cn(
                  "absolute -bottom-2 -right-2 z-10 hidden size-4 cursor-ew-resize rounded-[5px] border-2 border-accent bg-bg-elev transition @[40rem]:block",
                  sel || resizing?.id === b.id ? "opacity-100" : "opacity-0 group-hover/blk:opacity-100 focus-visible:opacity-100"
                )}
              />
              {resizing?.id === b.id && (
                <span className="pointer-events-none absolute -bottom-9 right-0 z-10 hidden whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-[11px] font-semibold text-bg shadow-[var(--shadow-md)] @[40rem]:block">
                  {resizing.span} de 12 colunas
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* a "fantasia" do bloco seguindo o ponteiro */}
      {drag && dragged && <DragGhost block={dragged} drag={drag} />}
    </div>
  );
}

function DragGhost({ block, drag }: { block: Block; drag: DragState }) {
  const Icon = CATALOG[block.id].icon;
  const { w, h, offX, offY } = ghostBox(drag);
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[60] will-change-transform"
      style={{ width: w, height: h, transform: `translate(${drag.x - offX}px, ${drag.y - offY}px)` }}
    >
      <div className="flex h-full -rotate-[1.5deg] scale-[1.02] flex-col overflow-hidden rounded-2xl border-2 border-accent bg-bg-elev/95 p-5 shadow-[0_24px_60px_-12px_rgba(75,28,171,.45)] backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-brand text-accent">
            <Icon className="size-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[15px] font-bold">{widgetName(block.id)}</span>
            <span className="block text-xs text-fg-mut">{block.span} de 12 colunas</span>
          </span>
        </div>
        <div className="mt-4 flex flex-1 flex-col gap-2 opacity-60">
          <span className="h-2.5 w-2/3 rounded-full bg-bg-sunken" />
          <span className="h-2.5 w-1/2 rounded-full bg-bg-sunken" />
          <span className="mt-auto h-12 w-full rounded-xl bg-gradient-to-t from-accent/20 to-transparent" />
        </div>
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
