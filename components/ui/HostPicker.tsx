"use client";

import { useState } from "react";
import { Check, Minus, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { normalizeHost } from "@/lib/hosts";
import { cn } from "@/lib/utils";

// a partir de quantas plataformas a busca aparece (abaixo disso ela só ocupa espaço)
const SEARCH_FROM = 6;

/**
 * Corte do hostname para truncar NO MEIO: o começo (subdomínio, o que diferencia um produto
 * do outro) encolhe com reticências e o domínio final fica sempre inteiro.
 * "dev-preparasp2026.jovensgenios.com" → ["dev-preparasp2026", ".jovensgenios.com"]
 */
function splitHost(host: string): [string, string] {
  const labels = host.split(".");
  if (labels.length >= 3) {
    const tail = "." + labels.slice(-2).join(".");
    return [host.slice(0, -tail.length), tail];
  }
  // domínio curto (ex.: meusite.com, localhost): metade de cada lado
  const cut = Math.ceil(host.length / 2);
  return [host.slice(0, cut), host.slice(cut)];
}

function HostName({ host }: { host: string }) {
  const [head, tail] = splitHost(host);
  return (
    <span className="flex min-w-0 flex-1 font-mono text-[12.5px]" title={host}>
      <span className="truncate text-fg-soft">{head}</span>
      <span className="shrink-0 text-fg-mut">{tail}</span>
    </span>
  );
}

function Box({ state, round = false }: { state: "on" | "off" | "some"; round?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-4 shrink-0 place-items-center border",
        round ? "rounded-full" : "rounded",
        state === "off" ? "border-line-strong" : "border-accent bg-accent text-white"
      )}
    >
      {state === "on" && <Check className="size-3" />}
      {state === "some" && <Minus className="size-3" />}
    </span>
  );
}

/**
 * Plataformas onde uma pesquisa ou um tour aparece. Uma mesma SDK key pode estar instalada
 * em vários produtos do cliente; a lista vem dos hostnames que o SDK do projeto já reportou,
 * e o usuário pode adicionar um que ainda não foi detectado (SDK recém-instalado).
 * Nenhuma selecionada = todas as plataformas (comportamento padrão).
 */
export function HostPicker({
  hosts,
  selected,
  onChange,
}: {
  hosts: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [onlySelectedPref, setOnlySelected] = useState(false);
  // detectadas + adicionadas à mão que ainda não apareceram, na ordem em que surgiram
  const all = [...hosts, ...selected.filter((h) => !hosts.includes(h))];
  const allHosts = selected.length === 0;
  // sem nada marcado o filtro "só selecionadas" esvaziaria a lista: desliga sozinho
  const onlySelected = onlySelectedPref && !allHosts;

  const q = query.trim().toLowerCase();
  const visible = all.filter((h) => (!q || h.includes(q)) && (!onlySelected || selected.includes(h)));
  const visibleOn = visible.filter((h) => selected.includes(h)).length;
  const bulkState = visibleOn === 0 ? "off" : visibleOn === visible.length ? "on" : "some";

  const toggle = (host: string) =>
    onChange(selected.includes(host) ? selected.filter((h) => h !== host) : [...selected, host]);

  // ação em lote sobre o que está visível (a busca define o grupo: ex. "dev-" marca todos os de homologação)
  const toggleVisible = () =>
    onChange(
      bulkState === "on"
        ? selected.filter((h) => !visible.includes(h))
        : [...selected, ...visible.filter((h) => !selected.includes(h))]
    );

  const add = () => {
    if (!draft.trim()) return;
    const host = normalizeHost(draft);
    if (!host || (!host.includes(".") && host !== "localhost")) {
      setError("Informe um endereço válido, ex.: matematicaem.jovensgenios.com");
      return;
    }
    if (!selected.includes(host)) onChange([...selected, host]);
    setDraft("");
    setError("");
  };

  return (
    // @container: no card largo vira grade, no diálogo estreito (duplicar tour) fica em uma coluna
    <div className="@container flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border border-line-strong bg-bg-elev">
        <button
          type="button"
          onClick={() => onChange([])}
          className="flex w-full items-center gap-2.5 border-b border-line px-3 py-2.5 text-left text-sm hover:bg-bg-sunken"
        >
          <Box state={allHosts ? "on" : "off"} round />
          <span className="flex-1 font-medium text-fg-soft">Todas as plataformas do projeto</span>
          <span className="hidden text-xs text-fg-mut @lg:inline">inclui as que forem detectadas depois</span>
        </button>

        {all.length === 0 ? (
          <div className="px-3 py-3 text-xs leading-relaxed text-fg-mut">
            Nenhuma plataforma detectada ainda. Elas aparecem aqui assim que o SDK carregar em cada
            endereço que usa a chave deste projeto.
          </div>
        ) : (
          <>
            {/* barra: busca + seleção em lote + contador */}
            <div className="flex flex-col gap-2 border-b border-line bg-bg-sunken/50 px-3 py-2 @lg:flex-row @lg:items-center">
              {all.length >= SEARCH_FROM && (
                <div className="relative @lg:w-72">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-mut" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                    placeholder={`Buscar entre ${all.length} plataformas`}
                    aria-label="Buscar plataforma"
                    className="w-full rounded-lg border border-line-strong bg-bg-elev py-1.5 pl-8 pr-7 text-[13px] text-fg placeholder:text-fg-mut focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Limpar busca"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-fg-mut hover:text-fg"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-1 items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={toggleVisible}
                  disabled={visible.length === 0}
                  className="flex items-center gap-2 rounded-md py-1 text-[13px] font-semibold text-fg-soft hover:text-accent disabled:opacity-50"
                >
                  <Box state={bulkState} />
                  {bulkState === "on" ? "Desmarcar" : "Selecionar"} {q || onlySelected ? `${visible.length} exibidas` : "todas"}
                </button>
                <span className="flex items-center gap-2 text-xs text-fg-mut">
                  {selected.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setOnlySelected((v) => !v)}
                      className={cn("rounded-full px-2 py-0.5 font-semibold", onlySelected ? "bg-accent text-white" : "bg-surface-brand text-accent hover:brightness-95")}
                      title={onlySelected ? "Mostrar todas" : "Mostrar só as selecionadas"}
                    >
                      {selected.length} de {all.length} selecionadas
                    </button>
                  ) : (
                    <span>{all.length} plataformas</span>
                  )}
                </span>
              </div>
            </div>

            {/* lista com altura limitada: rola em vez de esticar a página */}
            <div className="max-h-64 overflow-y-auto overscroll-contain p-1">
              {visible.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-fg-mut">
                  Nenhuma plataforma com “{query.trim()}”{onlySelected ? " entre as selecionadas" : ""}. Se ela ainda não foi detectada, adicione o endereço abaixo.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-x-1 @xl:grid-cols-2 @4xl:grid-cols-3">
                  {visible.map((host) => {
                    const on = selected.includes(host);
                    const detected = hosts.includes(host);
                    return (
                      <button
                        key={host}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggle(host)}
                        className={cn(
                          "flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-bg-sunken",
                          on && "bg-surface-brand/60"
                        )}
                      >
                        <Box state={on ? "on" : "off"} />
                        <HostName host={host} />
                        {!detected && <span className="shrink-0 text-[11px] text-fg-mut">aguardando o SDK</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Adicionar endereço, ex.: matematicaem.jovensgenios.com"
        />
        <Button type="button" variant="ghost" onClick={add} disabled={!draft.trim()}>
          <Plus className="size-4" /> Adicionar
        </Button>
      </div>
      {error && <p className="text-xs text-erro">{error}</p>}
    </div>
  );
}
