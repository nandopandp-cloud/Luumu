"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, MessageCircleHeart, MoreHorizontal, Pencil, Settings2, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RecentSurvey {
  id: string;
  name: string;
  type: string;
  status: string;
  range: string; // "28/09/26 a 02/10/26" ou ""
  responses: number;
  score: string; // "74%", "+32", "—"
  createdAt: string; // "28 set 2026"
}

const STATUS: Record<string, { label: string; cls: string }> = {
  ativa: { label: "Ativa", cls: "bg-sucesso/10 text-sucesso" },
  pausada: { label: "Pausada", cls: "bg-aviso/15 text-aviso" },
  encerrada: { label: "Encerrada", cls: "bg-fg/10 text-fg-soft" },
  rascunho: { label: "Rascunho", cls: "bg-surface-brand text-accent" },
};

function TypeIcon({ type }: { type: string }) {
  if (type === "NPS") return <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sec-laranja/15 text-sec-laranja"><Star className="size-5" /></span>;
  if (type === "CES") return <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sec-azul/15 text-sec-azul"><Zap className="size-5" /></span>;
  return <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-brand text-accent"><MessageCircleHeart className="size-5" /></span>;
}

function RowMenu({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const items = [
    { href: `/surveys/${id}/builder`, label: "Editar", icon: <Pencil className="size-4" /> },
    { href: `/surveys/${id}/responses`, label: "Ver respostas", icon: <BarChart3 className="size-4" /> },
    { href: `/surveys/${id}/settings`, label: "Configurações", icon: <Settings2 className="size-4" /> },
  ];
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Ações da pesquisa" aria-expanded={open} className="rounded-lg p-1.5 text-fg-mut hover:bg-bg-sunken hover:text-fg">
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 text-sm shadow-[var(--shadow-lg)]">
            {items.map((it) => (
              <Link key={it.href} href={it.href} role="menuitem" className="flex items-center gap-2.5 px-3.5 py-2 text-fg-soft hover:bg-bg-sunken">
                {it.icon}
                {it.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function RecentSurveys({ items }: { items: RecentSurvey[] }) {
  return (
    <section className="rounded-2xl border border-line bg-bg-elev shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-3 p-6 pb-4">
        <h2 className="font-display text-lg font-bold tracking-tight">Pesquisas recentes</h2>
        <Link href="/surveys" className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong px-3.5 py-2 text-sm font-semibold text-fg-soft transition hover:border-accent hover:text-accent">
          Ver todas <ArrowRight className="size-4" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-fg-mut">Nenhuma pesquisa ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line bg-bg-sunken/40 text-left font-mono text-[11px] uppercase tracking-wide text-fg-mut">
                <th className="px-6 py-2.5 font-semibold">Pesquisa</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Respostas</th>
                <th className="px-3 py-2.5 font-semibold">Tipo</th>
                <th className="px-3 py-2.5 font-semibold">Score</th>
                <th className="px-3 py-2.5 font-semibold">Criada em</th>
                <th className="w-12 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const st = STATUS[s.status] ?? STATUS.rascunho;
                return (
                  <tr key={s.id} className="border-b border-line last:border-0 hover:bg-bg-sunken/40">
                    <td className="px-6 py-3.5">
                      <div className="flex min-w-[220px] items-center gap-3">
                        <TypeIcon type={s.type} />
                        <div className="min-w-0">
                          <Link href={`/surveys/${s.id}/responses`} className="block truncate font-semibold hover:text-accent">
                            {s.name}
                          </Link>
                          {s.range && <div className="text-xs text-fg-mut">{s.range}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", st.cls)}>
                        <span className="size-1.5 rounded-full bg-current" />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-fg-soft">{s.responses.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-3.5 text-fg-soft">{s.type}</td>
                    <td className="px-3 py-3.5 font-bold text-luumu-roxo">{s.score}</td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-fg-soft">{s.createdAt}</td>
                    <td className="px-4 py-3.5">
                      <RowMenu id={s.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
