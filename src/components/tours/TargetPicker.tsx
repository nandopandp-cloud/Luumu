"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MousePointerClick, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { listRegistryAction } from "@/app/(app)/tours/actions";
import { normalizeText } from "@/lib/tours/target";
import type { ElementTarget } from "@/lib/tours/types";
import { KIND_LABEL, StabilityMeter } from "./target-ui";

type RegistryItem = Awaited<ReturnType<typeof listRegistryAction>>[number];

/**
 * Escolhe o alvo de um passo entre os elementos que o Product Discovery Engine já encontrou
 * (Element Registry). Para um elemento ainda não descoberto, "Selecionar no produto".
 */
export function TargetPicker({
  hosts,
  onPick,
  onOpenProduct,
  onClose,
}: {
  hosts: string[];
  onPick: (target: ElementTarget, route: string) => void;
  onOpenProduct: () => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<RegistryItem[] | null>(null);
  const [q, setQ] = useState("");
  const [host, setHost] = useState("");

  useEffect(() => {
    let alive = true;
    listRegistryAction(host || undefined).then((r) => alive && setItems(r));
    return () => {
      alive = false;
    };
  }, [host]);

  const groups = useMemo(() => {
    const needle = normalizeText(q);
    const list = (items ?? []).filter(
      (i) => !needle || normalizeText(i.label).includes(needle) || i.route.toLowerCase().includes(needle)
    );
    const by = new Map<string, RegistryItem[]>();
    for (const i of list) {
      const k = hosts.length > 1 ? `${i.host}${i.route}` : i.route;
      by.set(k, [...(by.get(k) ?? []), i]);
    }
    return Array.from(by.entries());
  }, [items, q, hosts.length]);

  return (
    <Dialog
      size="lg"
      title="Escolher elemento alvo"
      description="Elementos que a Luumu encontrou nas telas que você já abriu no modo de edição."
      onClose={onClose}
      footer={
        <Button variant="ghost" size="sm" onClick={onOpenProduct}>
          <MousePointerClick className="size-4" /> Selecionar no produto
        </Button>
      }
    >
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-mut" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou página…" className="pl-9" />
        </div>
        {hosts.length > 1 && (
          <Select
            value={host}
            onChange={(e) => {
              setItems(null); // mostra "carregando" enquanto busca a outra plataforma
              setHost(e.target.value);
            }}
            className="w-auto"
            aria-label="Plataforma"
          >
            <option value="">Todas as plataformas</option>
            {hosts.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Select>
        )}
      </div>

      {items === null ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-fg-mut">
          <Loader2 className="size-4 animate-spin" /> Carregando elementos…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-bg-sunken px-5 py-10 text-center">
          <p className="text-sm font-semibold text-fg-soft">Nenhum elemento descoberto ainda</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-fg-mut">
            Abra o produto em modo de edição: cada tela que você visitar é analisada e os botões, links e menus aparecem aqui.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-mut">Nada corresponde à busca.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([route, list]) => (
            <div key={route}>
              <div className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-fg-mut">{route}</div>
              <div className="overflow-hidden rounded-xl border border-line">
                {list.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => onPick(i.target, i.route)}
                    className="flex w-full items-center gap-3 border-b border-line px-3.5 py-2.5 text-left last:border-0 hover:bg-surface-brand/60"
                  >
                    <span className="w-24 shrink-0 text-xs font-semibold text-fg-mut">{KIND_LABEL[i.target.kind]}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg-soft">{i.label}</span>
                    <StabilityMeter value={i.stability} compact />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
