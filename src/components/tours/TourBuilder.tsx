"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  MoreHorizontal,
  Copy,
  Eye,
  EyeOff,
  Play,
  Trash2,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Tablet,
  Smartphone,
  MousePointerClick,
  AlertTriangle,
  Square,
  MessageSquare,
  Focus,
  PanelTop,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { defaultStep, newStepKey, STEP_TYPE_LABEL } from "@/lib/tours/defaults";
import type { Device, StepType, TourSettings, TourStep } from "@/lib/tours/types";
import { getTourDraftAction, saveTourDraftAction } from "@/app/(app)/tours/actions";
import { StepCanvas } from "./StepCanvas";
import { StepEditor } from "./StepEditor";
import { TargetPicker } from "./TargetPicker";
import { OpenProductDialog, type ProductMode } from "./OpenProductDialog";
import { registerDraftFlush } from "./draft-sync";

const AUTOSAVE_MS = 900;

const TYPE_ICON: Record<StepType, React.ReactNode> = {
  modal: <PanelTop className="size-4" />,
  tooltip: <MessageSquare className="size-4" />,
  popover: <Square className="size-4" />,
  spotlight: <Focus className="size-4" />,
};

function stepSubtitle(s: TourStep): string {
  if (s.type === "modal") return "Modal centralizado";
  const where = s.target ? s.target.label : "sem elemento";
  return `${STEP_TYPE_LABEL[s.type]} · ${where}`;
}

function SortableStep({
  step,
  index,
  active,
  onSelect,
  onDuplicate,
  onToggle,
  onPreviewFrom,
  onDelete,
}: {
  step: TourStep;
  index: number;
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onPreviewFrom: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.key });
  const [menu, setMenu] = useState(false);
  const missingTarget = step.enabled && step.type !== "modal" && !step.target;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10")}
    >
      <div
        className={cn(
          "group flex items-center gap-2 rounded-xl border bg-bg-elev px-2 py-2.5 transition",
          active ? "border-accent shadow-[0_0_0_3px_var(--surface-brand)]" : "border-line hover:border-line-strong",
          !step.enabled && "opacity-55",
          isDragging && "shadow-[var(--shadow-lg)]"
        )}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reordenar passo ${index + 1}`}
          className="cursor-grab touch-none rounded p-1 text-fg-mut hover:text-fg active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg font-display text-sm font-bold",
              active ? "bg-accent text-white" : "bg-surface-brand text-accent"
            )}
          >
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{step.title || "Sem título"}</span>
            <span className="flex items-center gap-1 truncate text-xs text-fg-mut">
              {missingTarget && <AlertTriangle className="size-3 shrink-0 text-aviso" />}
              {step.enabled ? stepSubtitle(step) : "Desativado"}
            </span>
          </span>
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-label={`Ações do passo ${index + 1}`}
            aria-expanded={menu}
            className="rounded-lg p-1.5 text-fg-mut hover:bg-bg-sunken hover:text-fg"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
              <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 text-sm shadow-[var(--shadow-lg)]">
                {[
                  { icon: <Play className="size-4" />, label: "Preview a partir daqui", fn: onPreviewFrom },
                  { icon: <Copy className="size-4" />, label: "Duplicar", fn: onDuplicate },
                  { icon: step.enabled ? <EyeOff className="size-4" /> : <Eye className="size-4" />, label: step.enabled ? "Desativar" : "Ativar", fn: onToggle },
                  { icon: <Trash2 className="size-4" />, label: "Excluir", fn: onDelete, danger: true },
                ].map((it) => (
                  <button
                    key={it.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      it.fn();
                    }}
                    className={cn("flex w-full items-center gap-2.5 px-3.5 py-2 text-left hover:bg-bg-sunken", it.danger ? "text-erro" : "text-fg-soft")}
                  >
                    {it.icon}
                    {it.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function AddStepMenu({ onAdd, onSelectInProduct }: { onAdd: (t: StepType) => void; onSelectInProduct: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full bg-surface-brand px-3 py-1.5 text-xs font-bold text-accent hover:brightness-95"
      >
        <Plus className="size-3.5" /> Adicionar passo
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-line bg-bg-elev py-1.5 shadow-[var(--shadow-lg)]">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelectInProduct();
              }}
              className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left hover:bg-surface-brand/60"
            >
              <MousePointerClick className="mt-0.5 size-4 text-accent" />
              <span>
                <span className="block text-sm font-semibold">Selecionar no produto</span>
                <span className="block text-xs text-fg-mut">Clique no elemento e o passo é criado</span>
              </span>
            </button>
            <div className="my-1 border-t border-line" />
            {(["modal", "tooltip", "popover", "spotlight"] as StepType[]).map((t) => (
              <button
                key={t}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onAdd(t);
                }}
                className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-sm text-fg-soft hover:bg-bg-sunken"
              >
                <span className="text-fg-mut">{TYPE_ICON[t]}</span>
                {STEP_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function TourBuilder({
  tourId,
  initialSteps,
  settings,
  hosts,
}: {
  tourId: string;
  initialSteps: TourStep[];
  settings: TourSettings;
  hosts: string[];
}) {
  const [steps, setSteps] = useState<TourStep[]>(initialSteps);
  const [selected, setSelected] = useState<string | null>(initialSteps[0]?.key ?? null);
  const [device, setDevice] = useState<Device>("desktop");
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [picker, setPicker] = useState(false);
  const [product, setProduct] = useState<{ mode: ProductMode; stepKey?: string; label?: string } | null>(null);
  const toast = useToast();

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(steps);
  const dirty = useRef(false);
  const inflight = useRef<Promise<void> | null>(null);

  const save = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inflight.current) await inflight.current;
    if (!dirty.current) return;
    dirty.current = false;
    setSaveState("saving");
    inflight.current = (async () => {
      const res = await saveTourDraftAction({ id: tourId, steps: latest.current });
      if (res.ok) setSaveState("saved");
      else {
        dirty.current = true;
        setSaveState("error");
        toast("error", res.error);
      }
    })();
    await inflight.current;
    inflight.current = null;
  }, [tourId, toast]);

  // Publicar / Preview esperam o save pendente
  useEffect(() => {
    registerDraftFlush(save);
    return () => registerDraftFlush(null);
  }, [save]);

  // salva ao sair da página com mudança pendente
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        void save();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  const commit = (next: TourStep[]) => {
    setSteps(next);
    latest.current = next;
    dirty.current = true;
    setSaveState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  };

  /*
    O overlay no produto adiciona passos direto no rascunho e avisa por postMessage. Ao
    receber (ou ao voltar para esta aba), relê o rascunho — sem perder o passo selecionado.
  */
  const reload = useCallback(async () => {
    if (dirty.current) await save();
    const res = await getTourDraftAction(tourId);
    if (!res.ok) return;
    const before = latest.current.map((s) => s.key);
    latest.current = res.steps;
    setSteps(res.steps);
    const added = res.steps.find((s) => !before.includes(s.key));
    if (added) {
      setSelected(added.key);
      toast("success", `Passo "${added.title}" adicionado pelo produto.`);
    }
  }, [tourId, save, toast]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; tourId?: string } | null;
      if (d?.type === "luumu:tour-updated" && d.tourId === tourId) void reload();
    };
    const onVisible = () => {
      if (!document.hidden) void reload();
    };
    window.addEventListener("message", onMessage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tourId, reload]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = steps.findIndex((s) => s.key === e.active.id);
    const to = steps.findIndex((s) => s.key === e.over!.id);
    commit(arrayMove(steps, from, to));
  };

  const current = steps.find((s) => s.key === selected) ?? null;
  const visible = steps.filter((s) => s.enabled);
  const previewIndex = current ? Math.max(0, visible.findIndex((s) => s.key === current.key)) : 0;

  const update = (patch: Partial<TourStep>) => {
    if (!current) return;
    commit(steps.map((s) => (s.key === current.key ? { ...s, ...patch } : s)));
  };

  const add = (type: StepType) => {
    const step = defaultStep(type, { title: type === "modal" ? "Novo modal" : "Novo passo" });
    const idx = current ? steps.findIndex((s) => s.key === current.key) + 1 : steps.length;
    commit([...steps.slice(0, idx), step, ...steps.slice(idx)]);
    setSelected(step.key);
  };

  const remove = (key: string) => {
    const idx = steps.findIndex((s) => s.key === key);
    const next = steps.filter((s) => s.key !== key);
    commit(next);
    if (selected === key) setSelected(next[Math.min(idx, next.length - 1)]?.key ?? null);
  };

  const onCanvasAction = useCallback(
    (a: "next" | "back" | "close") => {
      const vis = latest.current.filter((s) => s.enabled);
      const i = vis.findIndex((s) => s.key === selected);
      if (a === "next" && i < vis.length - 1) setSelected(vis[i + 1].key);
      if (a === "back" && i > 0) setSelected(vis[i - 1].key);
    },
    [selected]
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
      {/* passos */}
      <Card className="h-fit" padded={false}>
        <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
          <h2 className="font-display text-base font-bold">Passos do tour</h2>
          <AddStepMenu onAdd={add} onSelectInProduct={() => setProduct({ mode: "builder" })} />
        </div>
        {steps.length === 0 ? (
          <div className="px-4 pb-5 text-sm text-fg-mut">Nenhum passo ainda. Adicione um modal de boas-vindas ou selecione um elemento no produto.</div>
        ) : (
          <DndContext id={`tour-${tourId}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={steps.map((s) => s.key)} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-2 px-3 pb-3" aria-label="Passos do tour">
                {steps.map((s, i) => (
                  <SortableStep
                    key={s.key}
                    step={s}
                    index={i}
                    active={s.key === selected}
                    onSelect={() => setSelected(s.key)}
                    onDuplicate={() => {
                      const copy = { ...s, key: newStepKey(), title: `${s.title} (cópia)` };
                      commit([...steps.slice(0, i + 1), copy, ...steps.slice(i + 1)]);
                      setSelected(copy.key);
                    }}
                    onToggle={() => commit(steps.map((x) => (x.key === s.key ? { ...x, enabled: !x.enabled } : x)))}
                    onPreviewFrom={() => setProduct({ mode: "preview", stepKey: s.key, label: s.title })}
                    onDelete={() => remove(s.key)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
        <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-xs text-fg-mut" aria-live="polite">
          {saveState === "saving" || saveState === "pending" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Salvando rascunho…
            </>
          ) : saveState === "error" ? (
            <span className="text-erro">Não foi possível salvar. Tentaremos de novo na próxima alteração.</span>
          ) : (
            <>
              <Check className="size-3.5 text-sucesso" /> Rascunho salvo. Publique para colocar no ar.
            </>
          )}
        </div>
      </Card>

      {/* preview */}
      <Card className="h-fit min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold">Pré-visualização</h2>
            <p className="text-xs text-fg-mut">Como o passo aparece para o usuário. Teste o real em “Preview no produto”.</p>
          </div>
          <SegmentedControl<Device>
            size="sm"
            value={device}
            onChange={setDevice}
            options={[
              { value: "desktop", label: "Desktop", icon: <Monitor className="size-3.5" /> },
              { value: "tablet", label: "Tablet", icon: <Tablet className="size-3.5" /> },
              { value: "mobile", label: "Mobile", icon: <Smartphone className="size-3.5" /> },
            ]}
          />
        </div>
        <StepCanvas
          steps={visible}
          index={current?.enabled ? previewIndex : -1}
          appearance={settings.appearance}
          device={device}
          url={settings.startUrl}
          onAction={onCanvasAction}
        />
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => onCanvasAction("back")}
            disabled={previewIndex <= 0}
            className="rounded-full border border-line p-1.5 text-fg-soft hover:border-accent disabled:opacity-40"
            aria-label="Passo anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="font-semibold text-fg-soft">
            {current && !current.enabled ? "Passo desativado" : visible.length ? `Passo ${previewIndex + 1} de ${visible.length}` : "Sem passos"}
          </span>
          <button
            type="button"
            onClick={() => onCanvasAction("next")}
            disabled={previewIndex >= visible.length - 1}
            className="rounded-full border border-line p-1.5 text-fg-soft hover:border-accent disabled:opacity-40"
            aria-label="Próximo passo"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </Card>

      {/* configuração do passo */}
      <Card className="h-fit">
        {current ? (
          <StepEditor
            key={current.key}
            step={current}
            device={device}
            onDevice={setDevice}
            onChange={update}
            onDelete={() => remove(current.key)}
            onPickTarget={() => setPicker(true)}
            onSelectInProduct={() => setProduct({ mode: "builder", stepKey: current.key, label: current.title })}
          />
        ) : (
          <p className="text-sm text-fg-mut">Selecione um passo para configurar.</p>
        )}
      </Card>

      {picker && current && (
        <TargetPicker
          hosts={hosts}
          onClose={() => setPicker(false)}
          onOpenProduct={() => {
            setPicker(false);
            setProduct({ mode: "builder", stepKey: current.key, label: current.title });
          }}
          onPick={(target, route) => {
            setPicker(false);
            update({
              target,
              route,
              type: current.type === "modal" ? "tooltip" : current.type,
              placement: current.type === "modal" ? "auto" : current.placement,
            });
          }}
        />
      )}

      {product && (
        <OpenProductDialog
          tourId={tourId}
          mode={product.mode}
          stepKey={product.stepKey}
          stepLabel={product.label}
          startUrl={settings.startUrl}
          hosts={hosts}
          onClose={() => setProduct(null)}
        />
      )}
    </div>
  );
}
