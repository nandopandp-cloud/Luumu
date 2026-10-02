"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { normalizeHost } from "@/lib/hosts";

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
  // detectadas + adicionadas à mão que ainda não apareceram, na ordem em que surgiram
  const all = [...hosts, ...selected.filter((h) => !hosts.includes(h))];
  const allHosts = selected.length === 0;

  const toggle = (host: string) =>
    onChange(selected.includes(host) ? selected.filter((h) => h !== host) : [...selected, host]);

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
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border border-line-strong bg-bg-elev">
        <button
          type="button"
          onClick={() => onChange([])}
          className="flex w-full items-center gap-2.5 border-b border-line px-3 py-2.5 text-left text-sm hover:bg-bg-sunken"
        >
          <span
            className={`grid size-4 shrink-0 place-items-center rounded-full border ${
              allHosts ? "border-accent bg-accent text-white" : "border-line-strong"
            }`}
          >
            {allHosts && <Check className="size-3" />}
          </span>
          <span className="flex-1 font-medium text-fg-soft">Todas as plataformas do projeto</span>
        </button>
        {all.length === 0 ? (
          <div className="px-3 py-3 text-xs leading-relaxed text-fg-mut">
            Nenhuma plataforma detectada ainda. Elas aparecem aqui assim que o SDK carregar em cada
            endereço que usa a chave deste projeto.
          </div>
        ) : (
          all.map((host) => {
            const on = selected.includes(host);
            const detected = hosts.includes(host);
            return (
              <button
                key={host}
                type="button"
                onClick={() => toggle(host)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-bg-sunken"
              >
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded border ${
                    on ? "border-accent bg-accent text-white" : "border-line-strong"
                  }`}
                >
                  {on && <Check className="size-3" />}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg-soft">{host}</span>
                {!detected && (
                  <span className="shrink-0 text-[11px] text-fg-mut">aguardando o SDK</span>
                )}
              </button>
            );
          })
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
