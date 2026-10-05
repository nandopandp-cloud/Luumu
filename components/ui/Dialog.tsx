"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Diálogo modal acessível: portal no body, ESC fecha, foco vai para dentro ao abrir e volta
 * para onde estava ao fechar.
 */
export function Dialog({
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const ref = useRef<HTMLDivElement>(null);
  /*
    onClose chega como função NOVA a cada render do pai (setOpen(false) inline). Com ele nas
    dependências do efeito, cada letra digitada num campo do diálogo re-renderizava o pai, o efeito
    rodava de novo e o foco era roubado ("só vai um caractere por vez"). Fica numa ref: o efeito de
    foco roda UMA vez, ao abrir.
  */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // prioridade: campo marcado com autoFocus, depois o 1º campo de texto, só então botões
    // (o botão de fechar vem primeiro no DOM e, sozinho, ficaria com o foco)
    const root = ref.current;
    const first =
      root?.querySelector<HTMLElement>("[autofocus]") ??
      root?.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])") ??
      root?.querySelector<HTMLElement>("button");
    // não rouba o foco de um campo que o próprio conteúdo já focou (autoFocus do React)
    if (!root?.contains(document.activeElement) || document.activeElement === document.body) first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 flex max-h-[calc(100vh-32px)] w-full flex-col rounded-2xl border border-line bg-bg-elev shadow-[var(--shadow-lg)]",
          size === "md" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-4xl"
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h3 className="font-display text-lg font-bold">{title}</h3>
            {description && <p className="mt-1 text-sm text-fg-mut">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-fg-mut hover:bg-bg-sunken hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
