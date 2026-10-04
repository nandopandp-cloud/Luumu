"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { firstDir, sortRows, type SortDir, type SortValue } from "@/lib/sort";

export interface SortState {
  key: string | null;
  dir: SortDir;
}

/**
 * Ordenação de tabela no cliente. `columns` diz como ler o valor de cada coluna ordenável.
 * Sem coluna escolhida, mantém a ordem que veio do servidor.
 */
export function useTableSort<T>(rows: T[], columns: Record<string, (r: T) => SortValue>, initial: SortState = { key: null, dir: "desc" }) {
  const [sort, setSort] = useState<SortState>(initial);
  const sorted = useMemo(() => {
    const get = sort.key ? columns[sort.key] : null;
    return get ? sortRows(rows, get, sort.dir) : rows;
    // as funções de leitura são estáveis por coluna; a chave basta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort.key, sort.dir]);
  function toggle(key: string) {
    setSort((cur) => {
      if (cur.key === key) return { key, dir: cur.dir === "asc" ? "desc" : "asc" };
      const sample = rows.map((r) => columns[key]?.(r)).find((v) => v !== null && v !== undefined);
      return { key, dir: firstDir(sample ?? 0) };
    });
  }
  return { sorted, sort, toggle };
}

/** Cabeçalho clicável: seta mostra o sentido; aria-sort informa leitores de tela. */
export function SortTh({
  label,
  k,
  sort,
  onSort,
  align = "left",
  className,
  title,
}: {
  label: React.ReactNode;
  k: string;
  sort: SortState;
  onSort: (key: string) => void;
  align?: "left" | "right" | "center";
  className?: string;
  title?: string;
}) {
  const active = sort.key === k;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} scope="col">
      <button
        type="button"
        onClick={() => onSort(k)}
        title={title ?? (active ? (sort.dir === "asc" ? "Crescente: clique para inverter" : "Decrescente: clique para inverter") : "Ordenar")}
        className={cn(
          "group/sort inline-flex items-center gap-1 rounded [letter-spacing:inherit] [text-transform:inherit] transition hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          align === "right" && "flex-row-reverse",
          active && "text-accent"
        )}
      >
        {label}
        <Icon className={cn("size-3 shrink-0", active ? "opacity-100" : "opacity-40 group-hover/sort:opacity-80")} aria-hidden />
      </button>
    </th>
  );
}
