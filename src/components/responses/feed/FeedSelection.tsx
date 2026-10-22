"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Loader2, Minus, RotateCcw, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { setResponsesExcludedAction } from "@/app/(app)/responses/actions";

/*
  Seleção de respostas no feed para desconsiderá-las do cálculo (spam, teste) ou, na aba
  "Desconsideradas", voltar a considerá-las. A resposta nunca é apagada: só sai das notas,
  contagens, gráficos, insights, relatórios e exportações.
*/

type Mode = "exclude" | "restore";

interface SelectionCtx {
  enabled: boolean;
  mode: Mode;
  selected: Set<string>;
  toggle: (id: string) => void;
  /** desconsidera / volta a considerar já, sem passar pela seleção (menu do card) */
  apply: (ids: string[], excluded: boolean) => void;
  pending: boolean;
}

const Ctx = createContext<SelectionCtx>({
  enabled: false,
  mode: "exclude",
  selected: new Set(),
  toggle: () => {},
  apply: () => {},
  pending: false,
});

export const useFeedSelection = () => useContext(Ctx);

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;

export function FeedSelection({
  ids,
  mode,
  enabled,
  children,
}: {
  /** respostas da página atual (o "selecionar todas" age sobre elas) */
  ids: string[];
  mode: Mode;
  /** false para quem é somente leitura: sem caixas nem ações */
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  // ids que saíram da página (após recarregar) não ficam presos na seleção
  const live = new Set(ids.filter((id) => selected.has(id)));
  const n = live.size;
  const allState = n === 0 ? "off" : n === ids.length ? "on" : "some";

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = (target: string[], excluded: boolean) =>
    start(async () => {
      const res = await setResponsesExcludedAction({ ids: target, excluded });
      if (!res.ok) {
        toast("error", res.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
      toast(
        "success",
        excluded
          ? `${plural(res.changed, "resposta desconsiderada", "respostas desconsideradas")}. Os cálculos já foram atualizados; elas ficam na aba Desconsideradas.`
          : `${plural(res.changed, "resposta voltou", "respostas voltaram")} a contar nos cálculos.`
      );
    });

  return (
    <Ctx.Provider value={{ enabled, mode, selected: live, toggle, apply, pending }}>
      {enabled && ids.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-1">
          <button
            type="button"
            onClick={() => setSelected(allState === "on" ? new Set() : new Set(ids))}
            className="flex items-center gap-2 rounded-md py-1 text-[13px] font-semibold text-fg-soft hover:text-accent"
          >
            <SelectBox state={allState} />
            {allState === "on" ? "Desmarcar todas" : "Selecionar todas desta página"}
          </button>
          <span className="hidden text-xs text-fg-mut sm:inline">
            {mode === "exclude"
              ? "Selecione spam ou testes para tirar dos cálculos sem apagar a resposta."
              : "Estas respostas estão guardadas, mas não contam em nenhum cálculo."}
          </span>
        </div>
      )}

      {children}

      {/* barra de ações: aparece só com algo selecionado */}
      {enabled && n > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div
            role="toolbar"
            aria-label="Ações nas respostas selecionadas"
            className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-line-strong bg-bg-elev py-2 pl-4 pr-2 shadow-[var(--shadow-lg)]"
          >
            <span className="text-sm font-semibold">{plural(n, "selecionada", "selecionadas")}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => apply(Array.from(live), mode === "exclude")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60",
                mode === "exclude" ? "bg-erro" : "[background:var(--grad-roxo)]"
              )}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : mode === "exclude" ? <Ban className="size-4" /> : <RotateCcw className="size-4" />}
              {mode === "exclude" ? "Desconsiderar do cálculo" : "Voltar a considerar"}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              aria-label="Limpar seleção"
              className="grid size-9 place-items-center rounded-xl text-fg-mut hover:bg-bg-sunken hover:text-fg"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function SelectBox({ state }: { state: "on" | "off" | "some" }) {
  return (
    <span
      className={cn(
        "grid size-[18px] shrink-0 place-items-center rounded-md border transition",
        state === "off" ? "border-line-strong bg-bg-elev" : "border-accent bg-accent text-white"
      )}
    >
      {state === "on" && <Check className="size-3.5" />}
      {state === "some" && <Minus className="size-3.5" />}
    </span>
  );
}
