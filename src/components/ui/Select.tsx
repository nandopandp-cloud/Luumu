"use client";

import {
  Children,
  Fragment,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Select da plataforma: mesma interface de um <select> (value/defaultValue, onChange com
  e.target.value, filhos <option>), com o visual do menu "Ordenar por" das Respostas.

  - Menu num portal (position: fixed): não é cortado por cards com overflow nem por diálogos,
    e abre para cima quando não há espaço embaixo.
  - Teclado: ↑ ↓ Home End navegam, Enter/Espaço escolhem, Esc fecha, letras pulam para a
    opção que começa com elas. Listas longas ganham um campo de busca.
  - Acessível: combobox + listbox com aria-activedescendant; opções desativadas são puladas.
*/

interface Opt {
  value: string;
  label: string;
  disabled: boolean;
}

type NativeProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "defaultValue">;

export interface SelectProps extends NativeProps {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  children?: ReactNode;
  /** texto quando nenhuma opção corresponde ao valor */
  placeholder?: string;
  /** ícone à esquerda do valor (ex.: filtros) */
  icon?: ReactNode;
}

const SEARCH_FROM = 9; // a partir de quantas opções o menu mostra a busca

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

function collect(children: ReactNode, out: Opt[] = []): Opt[] {
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) return;
    if (child.type === Fragment) return void collect(child.props.children, out);
    if (child.type === "option") {
      const label = textOf(child.props.children);
      out.push({ value: child.props.value != null ? String(child.props.value) : label, label, disabled: !!child.props.disabled });
    }
  });
  return out;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { value, defaultValue, onChange, children, className, disabled, placeholder, name, id, title, icon, ...rest },
  ref
) {
  const options = useMemo(() => collect(children), [children]);
  const [inner, setInner] = useState(String(defaultValue ?? options.find((o) => !o.disabled)?.value ?? ""));
  const current = value !== undefined ? String(value) : inner;
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxHeight: number; up: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const listId = useId();

  const searchable = options.length >= SEARCH_FROM;
  const visible = useMemo(
    () => (query ? options.filter((o) => fold(o.label).includes(fold(query))) : options),
    [options, query]
  );

  const setTrigger = (el: HTMLButtonElement | null) => {
    triggerRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 240 && above > below;
    // pelo menos a largura do campo; pode crescer para caber opções longas sem cortar
    const longest = Math.max(0, ...options.map((o) => o.label.length));
    const wanted = Math.min(520, 64 + longest * 7.5);
    const width = Math.min(Math.max(r.width, 220, wanted), window.innerWidth - 24);
    const left = Math.min(Math.max(12, r.left), window.innerWidth - width - 12);
    setPos({ left, width, up, top: up ? r.top - 6 : r.bottom + 6, maxHeight: Math.min(340, (up ? above : below) - 6) });
  }, [options]);

  const openMenu = () => {
    if (disabled) return;
    place();
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const choose = (o: Opt) => {
    if (o.disabled) return;
    if (value === undefined) setInner(o.value);
    if (o.value !== current) {
      const target = { value: o.value, name: name ?? "" } as HTMLSelectElement;
      onChange?.({ target, currentTarget: target } as ChangeEvent<HTMLSelectElement>);
    }
    close();
  };

  // acompanha rolagem e redimensionamento; fecha ao clicar fora
  useLayoutEffect(() => {
    if (!open) return;
    const onMove = () => place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, place]);

  // mantém a opção ativa visível
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const move = (from: number, step: 1 | -1) => {
    if (!visible.length) return -1;
    let i = from;
    for (let n = 0; n < visible.length; n++) {
      i = (i + step + visible.length) % visible.length;
      if (!visible[i].disabled) return i;
    }
    return from;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => move(a, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => move(a, -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(move(-1, 1));
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(move(visible.length, -1));
    } else if (e.key === "Enter" || (e.key === " " && !searchable)) {
      e.preventDefault();
      if (visible[active]) choose(visible[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // não fecha o diálogo em volta
      close();
    } else if (e.key === "Tab") {
      close(false);
    } else if (!searchable && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      // digitar pula para a opção que começa com o texto
      const t = typeahead.current;
      t.text = Date.now() - t.at < 700 ? t.text + e.key : e.key;
      t.at = Date.now();
      const i = visible.findIndex((o) => !o.disabled && fold(o.label).startsWith(fold(t.text)));
      if (i >= 0) setActive(i);
    }
  };

  const optionId = (i: number) => `${listId}-o${i}`;

  return (
    <>
      <button
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        ref={setTrigger}
        id={id}
        title={title}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border bg-bg-elev px-3.5 py-2.5 text-left text-sm text-fg transition",
          "focus:outline-none focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/15",
          open ? "border-accent ring-[3px] ring-accent/15" : "border-line-strong hover:border-accent/60",
          disabled && "cursor-not-allowed opacity-60 hover:border-line-strong",
          className
        )}
      >
        {icon && <span className="shrink-0 text-fg-soft [&>svg]:size-4">{icon}</span>}
        {/* texto inteiro: nomes longos (pesquisas, plataformas) quebram linha em vez de virar "…" */}
        <span className={cn("min-w-0 flex-1 break-words leading-snug", (!selected || selected.disabled) && "text-fg-mut")}>
          {selected?.label ?? placeholder ?? "Selecione…"}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-fg-mut transition-transform duration-200", open && "rotate-180 text-accent")} />
      </button>
      {name && <input type="hidden" name={name} value={current} />}

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[70] flex flex-col overflow-hidden rounded-2xl border border-line bg-bg-elev shadow-[var(--shadow-lg)] animate-[luumuSelectIn_.14s_ease-out]"
            style={{
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
          >
            {searchable && (
              <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                <Search className="size-4 shrink-0 text-fg-mut" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Buscar…"
                  aria-label="Buscar opção"
                  aria-controls={listId}
                  aria-activedescendant={active >= 0 ? optionId(active) : undefined}
                  className="w-full bg-transparent py-1 text-sm text-fg outline-none placeholder:text-fg-mut"
                />
              </div>
            )}
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label={rest["aria-label"] as string | undefined}
              className="min-h-0 flex-1 overflow-y-auto py-1.5"
            >
              {visible.length === 0 && <div className="px-4 py-3 text-sm text-fg-mut">Nada encontrado.</div>}
              {visible.map((o, i) => {
                const on = o.value === current;
                return (
                  <div
                    key={`${o.value}-${i}`}
                    id={optionId(i)}
                    data-index={i}
                    role="option"
                    aria-selected={on}
                    aria-disabled={o.disabled || undefined}
                    onMouseEnter={() => !o.disabled && setActive(i)}
                    onMouseDown={(e) => e.preventDefault()} // não tira o foco do campo
                    onClick={() => choose(o)}
                    className={cn(
                      "mx-1.5 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      on ? "bg-surface-brand font-semibold text-accent" : "text-fg-soft",
                      !on && i === active && "bg-bg-sunken text-fg",
                      on && i === active && "brightness-[.97]",
                      o.disabled && "cursor-default text-fg-mut opacity-60"
                    )}
                  >
                    <span className="min-w-0 flex-1 break-words leading-snug">{o.label}</span>
                    {on && <Check className="size-4 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
});
