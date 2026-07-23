"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
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
import {
  GripVertical, Trash2, Plus, Eye, Settings2, Rocket, Check, Loader2,
  Star, Smile, Hash, Type, AlignLeft, ListChecks, CheckSquare, ChevronDown,
  Calendar, Upload, Gauge, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { builderBlocks } from "@/lib/mock/surveys";
import { defaultConfig, type BuilderQuestion } from "@/lib/builder";
import { QuestionSettings } from "./QuestionSettings";
import { saveDraftAction, publishSurveyAction } from "@/app/(app)/surveys/actions";

const blockIcon: Record<string, React.ReactNode> = {
  rating: <Gauge className="size-4" />, emoji: <Smile className="size-4" />, stars: <Star className="size-4" />,
  scale: <Hash className="size-4" />, nps: <Gauge className="size-4" />, csat: <Smile className="size-4" />,
  ces: <Gauge className="size-4" />, short: <Type className="size-4" />, long: <AlignLeft className="size-4" />,
  choice: <ListChecks className="size-4" />, checkbox: <CheckSquare className="size-4" />,
  dropdown: <ChevronDown className="size-4" />, date: <Calendar className="size-4" />, file: <Upload className="size-4" />,
};

let idc = 100;
const newUid = () => `q_${Date.now()}_${idc++}`;

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

/* ---- Pergunta ordenável ---- */
function CanvasQuestion({
  q, index, selected, hasLogic, onSelect, onDelete,
}: {
  q: BuilderQuestion; index: number; selected: boolean; hasLogic: boolean;
  onSelect: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.uid });
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-fg-mut">{String(index + 1).padStart(2, "0")}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-brand px-2 py-0.5 text-[11px] font-semibold text-accent">
            {blockIcon[q.blockId]} {block?.label}
          </span>
          {q.required && <span className="text-erro">*</span>}
          {hasLogic && (
            <span className="rounded-full bg-sec-azul/15 px-2 py-0.5 text-[10px] font-semibold text-sec-azul">
              condicional
            </span>
          )}
        </div>
        <p className="mt-1.5 font-medium">{q.title}</p>
        {q.config?.options && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {q.config.options.slice(0, 4).map((o, i) => (
              <span key={i} className="rounded-md bg-bg-sunken px-2 py-0.5 text-xs text-fg-mut">{o}</span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="text-fg-mut opacity-0 transition hover:text-erro group-hover:opacity-100"
        aria-label="Excluir"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

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

export function SurveyBuilder({
  surveyId,
  surveyName,
  status,
  initialQuestions,
}: {
  surveyId: string;
  surveyName: string;
  status: string;
  initialQuestions: BuilderQuestion[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [questions, setQuestions] = useState<BuilderQuestion[]>(initialQuestions);
  const [selectedUid, setSelectedUid] = useState<string | null>(initialQuestions[0]?.uid ?? null);
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [, startTransition] = useTransition();
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const dirty = useRef(false);
  const firstRender = useRef(true);

  const selected = questions.find((q) => q.uid === selectedUid) ?? null;
  const selectedIndex = questions.findIndex((q) => q.uid === selectedUid);

  /* ----- salvar (chamado por autosave e botão) ----- */
  async function save(silent = false) {
    setSaveState("saving");
    try {
      await saveDraftAction({
        id: surveyId,
        name: surveyName,
        questions: questions.map((q) => ({
          blockId: q.blockId, title: q.title, required: q.required,
          config: q.config, logic: q.logic,
        })),
      });
      dirty.current = false;
      setSaveState("saved");
      if (!silent) toast("success", "Rascunho salvo.");
      setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      setSaveState("idle");
      toast("error", "Não foi possível salvar. Tente de novo.");
    }
  }

  /* ----- autosave por debounce quando há mudança ----- */
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    dirty.current = true;
    const t = setTimeout(() => save(true), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  async function handlePublish() {
    setPublishing(true);
    // garante que o rascunho atual está salvo antes de publicar
    await save(true);
    const res = await publishSurveyAction(surveyId);
    setPublishing(false);
    if (res.ok) {
      setPublishedUrl(res.url);
      toast("success", "Pesquisa publicada! 🎉");
      startTransition(() => router.refresh());
    } else {
      toast("error", res.error);
    }
  }

  function handleDragStart(e: DragStartEvent) { setActiveDrag(String(e.active.id)); }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;

    if (activeId.startsWith("palette-")) {
      const blockId = activeId.replace("palette-", "");
      const block = builderBlocks.find((b) => b.id === blockId);
      const uid = newUid();
      const nq: BuilderQuestion = {
        uid, blockId, title: `Nova pergunta — ${block?.label}`, required: false,
        config: defaultConfig(blockId), logic: {},
      };
      setQuestions((prev) => {
        const overIdx = prev.findIndex((q) => q.uid === overId);
        if (overIdx === -1) return [...prev, nq];
        const copy = [...prev];
        copy.splice(overIdx + 1, 0, nq);
        return copy;
      });
      setSelectedUid(uid);
      return;
    }

    if (activeId !== overId) {
      setQuestions((prev) => {
        const from = prev.findIndex((q) => q.uid === activeId);
        const to = prev.findIndex((q) => q.uid === overId);
        if (from === -1 || to === -1) return prev;
        return arrayMove(prev, from, to);
      });
    }
  }

  function patchSelected(patch: Partial<BuilderQuestion>) {
    if (!selectedUid) return;
    setQuestions((prev) => prev.map((q) => (q.uid === selectedUid ? { ...q, ...patch } : q)));
  }

  return (
    <div>
      {/* Header de ações */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-fg-mut">
          {saveState === "saving" && (<><Loader2 className="size-4 animate-spin" /> Salvando…</>)}
          {saveState === "saved" && (<><Check className="size-4 text-sucesso" /> Salvo</>)}
          {saveState === "idle" && <span>Autosave ativo · {questions.length} perguntas</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" href={`/surveys/${surveyId}/preview`}>
            <Eye className="size-4" /> Preview
          </Button>
          <Button variant="ghost" size="sm" onClick={() => save(false)}>
            Salvar rascunho
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={publishing}>
            {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
            {status === "ativa" ? "Republicar" : "Publicar"}
          </Button>
        </div>
      </div>

      {/* Aviso de publicada com link */}
      {publishedUrl && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sucesso/30 bg-sucesso/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-[#16a34a] dark:text-[#4ade80]">
            <Check className="size-4" /> Pesquisa ativa! Compartilhe o link público:
          </span>
          <div className="flex items-center gap-2">
            <code className="rounded-md bg-bg-elev px-2.5 py-1 font-mono text-xs">
              {typeof window !== "undefined" ? window.location.origin : ""}{publishedUrl}
            </code>
            <Button
              variant="subtle" size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}${publishedUrl}`);
                toast("success", "Link copiado!");
              }}
            >
              <Link2 className="size-3.5" /> Copiar
            </Button>
          </div>
        </div>
      )}

      <DndContext id="luumu-survey-builder" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr_300px]">
          {/* Paleta */}
          <div className="rounded-2xl border border-line bg-bg-elev p-4">
            <div className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-wide text-fg-mut">Blocos</div>
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
                {surveyName}
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
                      hasLogic={!!q.logic?.showIf}
                      onSelect={() => setSelectedUid(q.uid)}
                      onDelete={() => setQuestions((prev) => prev.filter((x) => x.uid !== q.uid))}
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
              <QuestionSettings
                question={selected}
                index={selectedIndex}
                allQuestions={questions}
                onChange={patchSelected}
              />
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
    </div>
  );
}
