"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  GripVertical,
  Trash2,
  Plus,
  Eye,
  Settings2,
  Star,
  Smile,
   Hash,
  Type,
  AlignLeft,
  ListChecks,
  CheckSquare,
  ChevronDown,
  Calendar,
  Upload,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { builderBlocks, initialCanvas } from "@/lib/mock/surveys";

const blockIcon: Record<string, React.ReactNode> = {
  rating: <Gauge className="size-4" />,
  emoji: <Smile className="size-4" />,
  stars: <Star className="size-4" />,
  scale: <Hash className="size-4" />,
  nps: <Gauge className="size-4" />,
  csat: <Smile className="size-4" />,
  ces: <Gauge className="size-4" />,
  short: <Type className="size-4" />,
  long: <AlignLeft className="size-4" />,
  choice: <ListChecks className="size-4" />,
  checkbox: <CheckSquare className="size-4" />,
  dropdown: <ChevronDown className="size-4" />,
  date: <Calendar className="size-4" />,
  file: <Upload className="size-4" />,
};

interface Question {
  uid: string;
  blockId: string;
  title: string;
  required: boolean;
}

let idc = 100;

/* ---- Bloco arrastável da paleta ---- */
function PaletteItem({ id, label, hint }: { id: string; label: string; hint: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette-${id}` });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border border-line bg-bg-elev px-3 py-2 text-left transition hover:border-accent hover:text-accent",
        isDragging && "opacity-40"
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-brand text-accent">
        {blockIcon[id]}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="block truncate text-[11px] text-fg-mut">{hint}</span>
      </span>
    </button>
  );
}

/* ---- Pergunta ordenável no canvas ---- */
function CanvasQuestion({
  q,
  index,
  selected,
  onSelect,
  onDelete,
}: {
  q: Question;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: q.uid,
  });
  const block = builderBlocks.find((b) => b.id === q.blockId);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-xl border bg-bg-elev p-4 transition",
        selected ? "border-accent shadow-[var(--shadow-sm)] ring-2 ring-accent/15" : "border-line hover:border-line-strong",
        isDragging && "opacity-50"
      )}
    >
      <button
        {...listeners}
        {...attributes}
        className="mt-0.5 cursor-grab text-fg-mut hover:text-fg-soft active:cursor-grabbing"
        aria-label="Reordenar"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-fg-mut">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-brand px-2 py-0.5 text-[11px] font-semibold text-accent">
            {blockIcon[q.blockId]} {block?.label}
          </span>
          {q.required && <span className="text-erro">*</span>}
        </div>
        <p className="mt-1.5 font-medium">{q.title}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="text-fg-mut opacity-0 transition hover:text-erro group-hover:opacity-100"
        aria-label="Excluir"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

/* ---- Zona de drop do canvas ---- */
function CanvasDropZone({ children, empty }: { children: React.ReactNode; empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[300px] flex-col gap-3 rounded-2xl border-2 border-dashed p-4 transition",
        isOver ? "border-accent bg-surface-brand/30" : "border-line",
        empty && "items-center justify-center"
      )}
    >
      {children}
    </div>
  );
}

export function SurveyBuilder({ surveyName }: { surveyName: string }) {
  const [questions, setQuestions] = useState<Question[]>(initialCanvas);
  const [selectedUid, setSelectedUid] = useState<string | null>(initialCanvas[0]?.uid ?? null);
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const selected = questions.find((q) => q.uid === selectedUid) ?? null;

  function handleDragStart(e: DragStartEvent) {
    setActiveDrag(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;

    // Soltar bloco da paleta → adiciona pergunta
    if (activeId.startsWith("palette-")) {
      const blockId = activeId.replace("palette-", "");
      const block = builderBlocks.find((b) => b.id === blockId);
      const uid = `q${idc++}`;
      const newQ: Question = {
        uid,
        blockId,
        title: `Nova pergunta — ${block?.label}`,
        required: false,
      };
      setQuestions((prev) => {
        const overIdx = prev.findIndex((q) => q.uid === overId);
        if (overIdx === -1) return [...prev, newQ];
        const copy = [...prev];
        copy.splice(overIdx + 1, 0, newQ);
        return copy;
      });
      setSelectedUid(uid);
      return;
    }

    // Reordenar dentro do canvas
    if (activeId !== overId) {
      setQuestions((prev) => {
        const from = prev.findIndex((q) => q.uid === activeId);
        const to = prev.findIndex((q) => q.uid === overId);
        if (from === -1 || to === -1) return prev;
        return arrayMove(prev, from, to);
      });
    }
  }

  function updateSelected(patch: Partial<Question>) {
    if (!selectedUid) return;
    setQuestions((prev) => prev.map((q) => (q.uid === selectedUid ? { ...q, ...patch } : q)));
  }

  return (
    <DndContext id="luumu-survey-builder" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr_300px]">
        {/* Paleta */}
        <div className="rounded-2xl border border-line bg-bg-elev p-4">
          <div className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-wide text-fg-mut">
            Blocos
          </div>
          <div className="flex flex-col gap-2">
            {builderBlocks.map((b) => (
              <PaletteItem key={b.id} id={b.id} label={b.label} hint={b.hint} />
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-fg-mut">
              {surveyName} · {questions.length} perguntas
            </div>
            <span className="text-xs text-fg-mut">Arraste um bloco para adicionar</span>
          </div>
          <SortableContext items={questions.map((q) => q.uid)} strategy={verticalListSortingStrategy}>
            <CanvasDropZone empty={questions.length === 0}>
              {questions.length === 0 ? (
                <div className="text-center text-fg-mut">
                  <Plus className="mx-auto mb-2 size-6" />
                  <p className="text-sm">Arraste blocos aqui para montar sua pesquisa</p>
                </div>
              ) : (
                questions.map((q, i) => (
                  <CanvasQuestion
                    key={q.uid}
                    q={q}
                    index={i}
                    selected={q.uid === selectedUid}
                    onSelect={() => setSelectedUid(q.uid)}
                    onDelete={() =>
                      setQuestions((prev) => prev.filter((x) => x.uid !== q.uid))
                    }
                  />
                ))
              )}
            </CanvasDropZone>
          </SortableContext>
        </div>

        {/* Propriedades */}
        <div className="rounded-2xl border border-line bg-bg-elev p-4">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-fg-mut">
            <Settings2 className="size-3.5" /> Propriedades
          </div>
          {selected ? (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-fg-soft">Pergunta</span>
                <textarea
                  value={selected.title}
                  onChange={(e) => updateSelected({ title: e.target.value })}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-line-strong bg-bg-elev px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
                />
              </label>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-fg-soft">Obrigatória</span>
                <Switch
                  checked={selected.required}
                  onChange={(v) => updateSelected({ required: v })}
                  label="Obrigatória"
                />
              </div>
              <div className="rounded-xl bg-bg-sunken p-3 text-xs text-fg-mut">
                <div className="mb-1 font-semibold text-fg-soft">Lógica condicional</div>
                Exibir esta pergunta apenas se a anterior tiver nota ≤ 6.
                <Button variant="subtle" size="sm" className="mt-2 w-full">
                  <Plus className="size-3.5" /> Adicionar regra
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-fg-mut">Selecione uma pergunta para editar.</p>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeDrag?.startsWith("palette-") ? (
          <div className="flex items-center gap-2 rounded-lg border border-accent bg-bg-elev px-3 py-2 shadow-[var(--shadow-lg)]">
            <span className="grid size-8 place-items-center rounded-md bg-surface-brand text-accent">
              {blockIcon[activeDrag.replace("palette-", "")]}
            </span>
            <span className="text-sm font-semibold">
              {builderBlocks.find((b) => `palette-${b.id}` === activeDrag)?.label}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
