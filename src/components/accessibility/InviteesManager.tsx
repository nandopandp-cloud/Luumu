"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Info, Loader2, Lock, Plus, Search, Trash2, Upload, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { PROFILES, profileInfo, isProfileId } from "@/lib/accessibility/features";
import { INVITEE_STATUS, type InviteeStatus } from "@/lib/accessibility/invitees";
import {
  addInviteesAction,
  importInviteesFileAction,
  listInviteesAction,
  removeInviteesAction,
  type InviteePage,
} from "@/app/(app)/accessibility/actions";

const TONE: Record<InviteeStatus, "neutral" | "info" | "success" | "warn"> = { pending: "neutral", shown: "info", accepted: "success", dismissed: "warn" };
const TEMPLATE = `data:text/csv;charset=utf-8,${encodeURIComponent("﻿id,nome,perfil\n123456,Ana Souza,Mais conforto na leitura\nbia@escola.sp.gov.br,Beatriz Lima,\n")}`;

type ImportSummary = { added: number; updated: number; invalid: string[]; duplicates: number };

/**
 * Convidados do convite de acessibilidade (accessibility_invitees). As mudanças valem na hora:
 * não passam pela barra "Salvar" da configuração. A lista é dado sensível e nunca vai para o
 * navegador do estudante.
 */
export function InviteesManager({ canManage }: { canManage: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [data, setData] = useState<InviteePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<InviteeStatus | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, start] = useTransition();
  const [mode, setMode] = useState<"none" | "one" | "bulk">("none");
  const [confirmAll, setConfirmAll] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async (opts: { q: string; status: InviteeStatus | null; page: number }) => {
    const id = ++reqId.current;
    // a action pode falhar sem resposta (rede, sessão expirada): mostra o erro em vez de ficar carregando
    const r = await listInviteesAction(opts).catch(() => ({ ok: false as const, error: "Não foi possível carregar os convidados. Tente de novo." }));
    if (id !== reqId.current) return; // resposta de uma busca antiga
    if (!r.ok) return setError(r.error);
    setError(null);
    setData(r);
    setSelected(new Set());
  }, []);

  // busca com atraso curto: digitar não dispara uma consulta por tecla
  useEffect(() => {
    const t = setTimeout(() => void load({ q, status, page }), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, status, page, load]);

  // a contagem de convidados também aparece fora daqui (Ativação, prévia): atualiza a página
  const refresh = async () => {
    await load({ q, status, page });
    router.refresh();
  };
  const total = data ? Object.values(data.totals).reduce((a, b) => a + b, 0) : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function summary(r: ImportSummary) {
    const parts = [`${r.added} ${r.added === 1 ? "adicionado" : "adicionados"}`];
    if (r.updated) parts.push(`${r.updated} já estavam na lista (atualizados)`);
    if (r.duplicates) parts.push(`${r.duplicates} repetidos ignorados`);
    if (r.invalid.length) parts.push(`${r.invalid.length} inválidos`);
    return parts.join(" · ");
  }

  function remove(keys: string[] | "all") {
    start(async () => {
      const r = await removeInviteesAction(keys === "all" ? { all: true } : { keys });
      if (!r.ok) return toast("error", r.error);
      toast("success", keys === "all" ? "Lista de convidados esvaziada." : `${keys.length} ${keys.length === 1 ? "convidado removido" : "convidados removidos"}.`);
      setConfirmAll(false);
      await refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* resumo por status (clicar filtra) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setStatus(null);
            setPage(0);
          }}
          className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition", status === null ? "border-accent bg-surface-brand text-accent" : "border-line text-fg-soft hover:border-line-strong")}
        >
          Todos · {total.toLocaleString("pt-BR")}
        </button>
        {(Object.keys(INVITEE_STATUS) as InviteeStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(status === s ? null : s);
              setPage(0);
            }}
            className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition", status === s ? "border-accent bg-surface-brand text-accent" : "border-line text-fg-soft hover:border-line-strong")}
          >
            {INVITEE_STATUS[s]} · {(data?.totals[s] ?? 0).toLocaleString("pt-BR")}
          </button>
        ))}
        <Badge tone="success" dot={false} className="ml-auto">
          <Lock className="mr-0.5 size-3" /> Nunca vai para o navegador
        </Badge>
      </div>

      {/* adicionar */}
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode(mode === "one" ? "none" : "one")} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition", mode === "one" ? "border-accent bg-surface-brand text-accent" : "border-line-strong text-fg-soft hover:border-accent hover:text-accent")}>
            <UserPlus className="size-4" /> Adicionar estudante
          </button>
          <button type="button" onClick={() => setMode(mode === "bulk" ? "none" : "bulk")} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition", mode === "bulk" ? "border-accent bg-surface-brand text-accent" : "border-line-strong text-fg-soft hover:border-accent hover:text-accent")}>
            <FileSpreadsheet className="size-4" /> Importar em lote
          </button>
        </div>
      )}
      {mode === "one" && (
        <AddOne
          onDone={async (msg) => {
            toast("success", msg);
            setQ("");
            setStatus(null);
            setPage(0);
            await load({ q: "", status: null, page: 0 });
            router.refresh();
          }}
        />
      )}
      {mode === "bulk" && (
        <BulkImport
          onDone={async (r) => {
            toast("success", summary(r));
            setPage(0);
            await load({ q: "", status: null, page: 0 });
            router.refresh();
            setQ("");
            setStatus(null);
          }}
          summary={summary}
        />
      )}

      {/* lista */}
      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bg-sunken/60 px-3 py-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-mut" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar por ID, e-mail ou nome"
              className="py-2 pl-9 text-sm"
              aria-label="Buscar convidados"
            />
          </div>
          {canManage && selected.size > 0 && (
            <button type="button" disabled={busy} onClick={() => remove([...selected])} className="inline-flex items-center gap-1.5 rounded-lg bg-erro/10 px-3 py-2 text-xs font-semibold text-erro hover:bg-erro/15">
              <Trash2 className="size-3.5" /> Remover {selected.size}
            </button>
          )}
          {canManage && total > 0 && !confirmAll && (
            <button type="button" onClick={() => setConfirmAll(true)} className="rounded-lg px-3 py-2 text-xs font-semibold text-fg-mut hover:text-erro">
              Remover todos
            </button>
          )}
          {confirmAll && (
            <span className="flex items-center gap-2 text-xs font-semibold">
              Remover os {total.toLocaleString("pt-BR")} convidados?
              <button type="button" disabled={busy} onClick={() => remove("all")} className="rounded-lg bg-erro px-3 py-1.5 text-white">
                Sim, remover
              </button>
              <button type="button" onClick={() => setConfirmAll(false)} className="rounded-lg px-2 py-1.5 text-fg-mut">
                Cancelar
              </button>
            </span>
          )}
        </div>

        {error ? (
          <p className="px-4 py-8 text-center text-sm text-erro">{error}</p>
        ) : !data ? (
          <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-fg-mut">
            <Loader2 className="size-4 animate-spin" /> Carregando convidados…
          </p>
        ) : data.rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-fg-mut">
            {q || status ? "Nenhum convidado encontrado com esse filtro." : "Nenhum convidado ainda. Adicione estudantes um a um ou importe uma lista."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-fg-mut">
                  {canManage && (
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label="Selecionar todos desta página"
                        checked={data.rows.length > 0 && data.rows.every((r) => selected.has(r.key))}
                        onChange={(e) => setSelected(e.target.checked ? new Set(data.rows.map((r) => r.key)) : new Set())}
                      />
                    </th>
                  )}
                  <th className="px-3 py-2">ID ou e-mail</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Perfil sugerido</th>
                  <th className="px-3 py-2">Convite</th>
                  {canManage && <th className="w-10 px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.key} className="border-b border-line last:border-0 hover:bg-bg-sunken/40">
                    {canManage && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${r.key}`}
                          checked={selected.has(r.key)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(r.key);
                            else next.delete(r.key);
                            setSelected(next);
                          }}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 font-mono text-xs">{r.key}</td>
                    <td className="px-3 py-2">{r.name || <span className="text-fg-mut">—</span>}</td>
                    <td className="px-3 py-2 text-xs">{r.profile && isProfileId(r.profile) ? profileInfo(r.profile).label : <span className="text-fg-mut">O do convite</span>}</td>
                    <td className="px-3 py-2">
                      <Badge tone={TONE[r.status]} dot={false}>{INVITEE_STATUS[r.status]}</Badge>
                      {r.lastEventAt && <span className="ml-2 text-[11px] text-fg-mut">{new Date(r.lastEventAt).toLocaleDateString("pt-BR")}</span>}
                    </td>
                    {canManage && (
                      <td className="px-3 py-2">
                        <button type="button" disabled={busy} onClick={() => remove([r.key])} className="grid size-7 place-items-center rounded-lg text-fg-mut hover:bg-erro/10 hover:text-erro" aria-label={`Remover ${r.key}`}>
                          <X className="size-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-fg-mut">
            <span>
              {(data.page * data.pageSize + 1).toLocaleString("pt-BR")}–{Math.min(data.total, (data.page + 1) * data.pageSize).toLocaleString("pt-BR")} de {data.total.toLocaleString("pt-BR")}
            </span>
            <span className="flex gap-1">
              <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="grid size-7 place-items-center rounded-lg hover:bg-bg-sunken disabled:opacity-40" aria-label="Página anterior">
                <ChevronLeft className="size-4" />
              </button>
              <button type="button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="grid size-7 place-items-center rounded-lg hover:bg-bg-sunken disabled:opacity-40" aria-label="Próxima página">
                <ChevronRight className="size-4" />
              </button>
            </span>
          </div>
        )}
      </div>
      <p className="flex gap-2 text-xs leading-relaxed text-fg-mut">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Indicar que um estudante precisa de acessibilidade é dado sensível (LGPD). A lista fica só no servidor: o produto pergunta “este estudante está
        na lista?” apenas para quem está logado. O status mostra se ele viu, aceitou ou dispensou o convite.
      </p>
    </div>
  );
}

function AddOne({ onDone }: { onDone: (msg: string) => Promise<void> }) {
  const toast = useToast();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [profile, setProfile] = useState("");
  const [busy, start] = useTransition();
  return (
    <form
      className="grid gap-2 rounded-2xl border border-line bg-bg-sunken/50 p-4 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addInviteesAction({ one: { key, name, profile: profile || null } });
          if (!r.ok) return toast("error", r.error);
          setKey("");
          setName("");
          setProfile("");
          await onDone(r.updated ? "Convidado atualizado." : "Convidado adicionado.");
        });
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-semibold text-fg-soft">
        ID ou e-mail
        <Input id="a11y-inv-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="123456 ou ana@escola.br" required className="py-2 font-mono text-xs" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-fg-soft">
        Nome (opcional)
        <Input id="a11y-inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Souza" className="py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-fg-soft">
        Perfil sugerido
        <Select id="a11y-inv-profile" value={profile} onChange={(e) => setProfile(e.target.value)}>
          <option value="">O do convite</option>
          {PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </label>
      <button type="submit" disabled={busy || !key.trim()} className="inline-flex h-[42px] items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 [background:var(--grad-roxo)]">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Adicionar
      </button>
    </form>
  );
}

function BulkImport({ onDone, summary }: { onDone: (r: ImportSummary) => Promise<void>; summary: (r: ImportSummary) => string }) {
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [last, setLast] = useState<ImportSummary | null>(null);
  const [busy, start] = useTransition();

  function finish(r: Awaited<ReturnType<typeof addInviteesAction>>) {
    if (!r.ok) return toast("error", r.error);
    setLast(r);
    setText("");
    return onDone(r);
  }

  function pick(f: File) {
    start(async () => {
      if (/\.xlsx$/i.test(f.name)) {
        const fd = new FormData();
        fd.append("file", f);
        await finish(await importInviteesFileAction(fd));
      } else {
        // CSV/TXT lidos aqui mesmo: o texto vai para a mesma action da lista colada
        await finish(await addInviteesAction({ text: await f.text() }));
      }
      if (file.current) file.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-bg-sunken/50 p-4">
      <p className="text-xs leading-relaxed text-fg-mut">
        Cole uma lista (um ID ou e-mail por linha) ou suba uma planilha <strong>CSV ou Excel</strong> com as colunas <code>id</code> (ou <code>email</code>,{" "}
        <code>matrícula</code>), <code>nome</code> e <code>perfil</code>, em qualquer ordem. Quem já está na lista é atualizado e mantém o status do convite.
      </p>
      <Textarea id="a11y-inv-bulk" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={"123456\nana@escola.sp.gov.br\n789012, Bruno Reis, Mais foco"} className="font-mono text-xs" spellCheck={false} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => start(async () => void (await finish(await addInviteesAction({ text }))))}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 [background:var(--grad-roxo)]"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Adicionar lista
        </button>
        <button type="button" disabled={busy} onClick={() => file.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-2 text-sm font-semibold text-fg-soft hover:border-accent hover:text-accent">
          <Upload className="size-4" /> Subir CSV ou Excel
        </button>
        <a href={TEMPLATE} download="convidados-acessibilidade.csv" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-fg-mut hover:text-accent">
          <Download className="size-4" /> Baixar modelo
        </a>
        <input ref={file} type="file" accept=".csv,.txt,.tsv,.xlsx,text/csv,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
      </div>
      {last && (
        <div className="rounded-xl bg-bg-elev px-3 py-2 text-xs">
          <p className="font-semibold">{summary(last)}</p>
          {last.invalid.length > 0 && <p className="mt-1 text-fg-mut">Não reconhecidos: {last.invalid.join(", ")}</p>}
        </div>
      )}
    </div>
  );
}
