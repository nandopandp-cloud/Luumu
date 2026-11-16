"use client";

import { useState, useTransition } from "react";
import { SortTh, useTableSort } from "@/components/ui/SortableHeader";
import { createPortal } from "react-dom";
import Link from "@/components/ui/Link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, MoreHorizontal, Pause, Play, Archive, Eye, Pencil, Type, Trash2, Loader2, AlertTriangle, Copy, CalendarRange, Repeat, RepeatOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { HostBadge } from "@/components/ui/HostBadge";
import { SegmentedControl } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { setStatusAction, renameSurveyAction, deleteSurveyAction, duplicateSurveyAction, stopRecurrenceAction } from "@/app/(app)/surveys/actions";
import { addDays, formatDate, scheduleLabel } from "@/lib/surveys/schedule";
import {
  baseName,
  defaultInterval,
  durationDays,
  INTERVAL_LABEL,
  intervalFits,
  nextOccurrence,
  occurrenceName,
  RECURRENCE_INTERVALS,
  recurrenceLabel,
  type RecurrenceInterval,
} from "@/lib/surveys/recurrence";
import { SURVEY_STATUS_LABEL, type SurveyDisplayStatus, type SurveyStatus } from "@/lib/surveys/types";

export interface SurveyListItem {
  id: string;
  name: string;
  type: string;
  status: SurveyStatus;
  /** status do painel: "agendada" = publicada com início da vigência no futuro */
  display: SurveyDisplayStatus;
  /** vigência legível ("09/11/2026 a 15/11/2026"); null = sem vigência */
  schedule: string | null;
  channel: string;
  targetHosts: string[]; // plataformas onde aparece ([] = todas)
  creator: { name: string; avatarUrl: string | null } | null; // null = sem registro de autor
  responseCount: number;
  score: number | null;
  updatedAtLabel: string;
  /** rodada de uma pesquisa recorrente (lib/surveys/recurrence.ts); null = avulsa */
  recurrence: {
    id: string;
    active: boolean;
    /** "Toda semana, de segunda a domingo" */
    label: string;
    /** é a rodada mais nova da série (a agendada, com a recorrência ativa) */
    latest: boolean;
  } | null;
}

type DuplicateValues = { name: string; startsAt: string; endsAt: string; schedule: boolean; repeatWeeks?: RecurrenceInterval };

const statusTone: Record<SurveyDisplayStatus, "success" | "warn" | "neutral" | "brand" | "info"> = {
  ativa: "success", agendada: "info", pausada: "warn", encerrada: "neutral", rascunho: "brand",
};

type Filter = "todas" | SurveyDisplayStatus;

// valor do filtro de plataforma para pesquisas sem alvo (aparecem em todas as plataformas)

export function SurveysTable({
  items,
  currentDate,
  hosts = [],
  initialHosts = [],
  recurrenceReady = false,
}: {
  items: SurveyListItem[];
  currentDate: string;
  /** a tabela de recorrências existe (migração 0047) */
  recurrenceReady?: boolean;
  /** plataformas (hostnames) do projeto */
  hosts?: string[];
  /** plataformas escolhidas no seletor do header (a lista vem filtrada nelas) */
  initialHosts?: string[];
}) {
  // abre em "Ativas"; "Todas" é a última aba
  const [filter, setFilter] = useState<Filter>("ativa");
  // "" = todas as plataformas
  // uma plataforma no header: o seletor da tabela abre nela; várias: a lista vem filtrada nelas
  const [q, setQ] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [renaming, setRenaming] = useState<SurveyListItem | null>(null);
  const [deleting, setDeleting] = useState<SurveyListItem | null>(null);
  const [duplicating, setDuplicating] = useState<SurveyListItem | null>(null);
  const [stopping, setStopping] = useState<SurveyListItem | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  // plataformas do projeto + as que alguma pesquisa mira e o SDK ainda não reportou
  const allHosts = Array.from(new Set([...hosts, ...items.flatMap((s) => s.targetHosts)]));
  // projeto de uma plataforma só não ganha coluna nem filtro: não há o que distinguir
  const multiHost = allHosts.length > 1 || items.some((s) => s.targetHosts.length > 0);

  /*
    Plataforma: a escolhida no seletor do header — pesquisas direcionadas a alguma delas. As sem
    plataforma definida ficam de fora (incluí-las fazia o filtro parecer quebrado: as antigas,
    todas sem alvo, continuavam na lista).
  */
  const filtered = items.filter(
    (s) =>
      (filter === "todas" || s.display === filter) &&
      (!initialHosts.length || s.targetHosts.some((h) => initialHosts.includes(h))) &&
      s.name.toLowerCase().includes(q.toLowerCase())
  );
  // ordenação pelos cabeçalhos; "Atualizada" usa a ordem do servidor (mais recente primeiro)
  const position = new Map(items.map((x, i) => [x.id, items.length - i]));
  const { sorted: sortedRows, sort, toggle } = useTableSort(filtered, {
    name: (x) => x.name,
    creator: (x) => x.creator?.name ?? null,
    type: (x) => x.type,
    status: (x) => x.display,
    channel: (x) => x.channel,
    responses: (x) => x.responseCount,
    score: (x) => x.score,
    updated: (x) => position.get(x.id) ?? null,
  });

  function changeStatus(id: string, status: SurveyStatus, label: string) {
    setMenuFor(null);
    startTransition(async () => {
      await setStatusAction(id, status);
      toast("success", label);
      router.refresh();
    });
  }

  function doRename(name: string) {
    if (!renaming) return;
    const target = renaming;
    startTransition(async () => {
      const res = await renameSurveyAction({ id: target.id, name });
      if (res.ok) {
        toast("success", "Pesquisa renomeada.");
        setRenaming(null);
        router.refresh();
      } else {
        toast("error", res.error ?? "Não foi possível renomear.");
      }
    });
  }

  function doDuplicate(values: DuplicateValues) {
    if (!duplicating) return;
    const target = duplicating;
    startTransition(async () => {
      const res = await duplicateSurveyAction({ id: target.id, ...values });
      if (res.ok && values.repeatWeeks) {
        setDuplicating(null);
        toast("success", `Pesquisa recorrente criada: ${recurrenceLabel(values.repeatWeeks, values.startsAt, values.endsAt).toLowerCase()}.`);
        router.refresh();
      } else if (res.ok && values.schedule) {
        setDuplicating(null);
        // agendada: entra no ar sozinha no início da vigência; fica na lista, na aba Agendadas
        toast("success", values.startsAt > currentDate ? `Pesquisa agendada: ${scheduleLabel(values.startsAt, values.endsAt)}.` : "Pesquisa duplicada e publicada.");
        router.refresh();
      } else if (res.ok) {
        setDuplicating(null);
        toast("success", "Pesquisa duplicada. Abrindo a cópia…");
        // rascunho: leva direto ao builder da cópia para revisar e publicar
        router.push(`/surveys/${res.id}/builder`);
      } else {
        toast("error", res.error ?? "Não foi possível duplicar.");
      }
    });
  }

  function doStopRecurrence() {
    const target = stopping?.recurrence;
    if (!target) return;
    startTransition(async () => {
      const res = await stopRecurrenceAction(target.id);
      if (res.ok) {
        setStopping(null);
        toast("success", "Recorrência parada. Nenhuma rodada nova será criada.");
        router.refresh();
      } else {
        toast("error", res.error ?? "Não foi possível parar a recorrência.");
      }
    });
  }

  function doDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      await deleteSurveyAction(target.id);
      toast("success", "Pesquisa excluída.");
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "ativa", label: "Ativas" },
            { value: "agendada", label: "Agendadas" },
            { value: "rascunho", label: "Rascunhos" },
            { value: "pausada", label: "Pausadas" },
            { value: "encerrada", label: "Arquivadas" },
            { value: "todas", label: "Todas" },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-mut" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pesquisa…" className="pl-9" />
          </div>
        </div>
      </div>

      <Card padded={false} className="overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wide text-fg-mut">
                <SortTh label="Pesquisa" k="name" sort={sort} onSort={toggle} className="px-6 py-3 font-semibold" />
                {multiHost && <th className="px-3 py-3 font-semibold">Plataforma</th>}
                <SortTh label="Criada por" k="creator" sort={sort} onSort={toggle} className="px-3 py-3 font-semibold" />
                <SortTh label="Tipo" k="type" sort={sort} onSort={toggle} className="px-3 py-3 font-semibold" />
                <SortTh label="Status" k="status" sort={sort} onSort={toggle} className="px-3 py-3 font-semibold" />
                <SortTh label="Canal" k="channel" sort={sort} onSort={toggle} className="px-3 py-3 font-semibold" />
                <SortTh label="Respostas" k="responses" sort={sort} onSort={toggle} className="px-3 py-3 font-semibold" />
                <SortTh label="Score" k="score" sort={sort} onSort={toggle} className="px-3 py-3 font-semibold" />
                <SortTh label="Atualizada" k="updated" sort={sort} onSort={toggle} align="right" className="px-6 py-3 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((s) => (
                <tr key={s.id} className="group border-b border-line last:border-0 transition-colors hover:bg-bg-sunken/50">
                  <td className="px-6 py-3.5">
                    <Link href={`/surveys/${s.id}/builder`} className="font-semibold hover:text-accent">{s.name}</Link>
                    {s.recurrence?.active && (
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-fg-mut" title="Pesquisa recorrente: a próxima rodada é criada sozinha">
                        <Repeat className="size-3 text-accent" /> {s.recurrence.label}
                      </div>
                    )}
                  </td>
                  {multiHost && (
                    <td className="px-3 py-3.5">
                      {s.targetHosts.length > 0 ? (
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {s.targetHosts.map((h) => (
                            <HostBadge key={h} host={h} all={allHosts} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-fg-mut">Todas</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-3.5">
                    {s.creator ? (
                      <div className="flex items-center gap-2" title={s.creator.name}>
                        {s.creator.avatarUrl ? (
                          <Image
                            src={s.creator.avatarUrl}
                            alt=""
                            width={24}
                            height={24}
                            className="size-6 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white [background:var(--grad-marca)]">
                            {s.creator.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="max-w-[140px] truncate text-fg-soft">{s.creator.name.split(" ")[0]}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-fg-mut">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5"><Badge tone="brand" dot={false}>{s.type}</Badge></td>
                  <td className="px-3 py-3.5">
                    <span title={s.schedule ? `Vigência: ${s.schedule}` : undefined}>
                      <Badge tone={statusTone[s.display]}>{SURVEY_STATUS_LABEL[s.display].toLowerCase()}</Badge>
                    </span>
                    {s.display === "agendada" && s.schedule && <div className="mt-1 text-[11px] text-fg-mut">{s.schedule}</div>}
                  </td>
                  <td className="px-3 py-3.5 text-fg-soft">{s.channel}</td>
                  <td className="px-3 py-3.5 text-fg-soft">{s.responseCount}</td>
                  <td className="px-3 py-3.5 font-bold text-luumu-roxo">{s.score ?? "—"}</td>
                  <td className="px-6 py-3.5 text-right text-fg-mut">
                    <div className="inline-flex items-center gap-2">
                      <span>{s.updatedAtLabel}</span>
                      <button
                        onClick={(e) => {
                          if (menuFor === s.id) {
                            setMenuFor(null);
                            setMenuPos(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                          setMenuFor(s.id);
                        }}
                        className="rounded p-1 opacity-0 transition hover:bg-bg-sunken group-hover:opacity-100 aria-expanded:opacity-100"
                        aria-label="Ações"
                        aria-expanded={menuFor === s.id}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                      {menuFor === s.id &&
                        menuPos &&
                        createPortal(
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => {
                                setMenuFor(null);
                                setMenuPos(null);
                              }}
                            />
                            <div
                              style={{ top: menuPos.top, right: menuPos.right }}
                              className="fixed z-50 w-44 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 text-left shadow-[var(--shadow-lg)]"
                            >
                              <MenuLink href={`/surveys/${s.id}/builder`} icon={<Pencil className="size-4" />}>Editar</MenuLink>
                              <MenuBtn onClick={() => { setMenuFor(null); setMenuPos(null); setRenaming(s); }} icon={<Type className="size-4" />}>Renomear</MenuBtn>
                              <MenuBtn onClick={() => { setMenuFor(null); setMenuPos(null); setDuplicating(s); }} icon={<Copy className="size-4" />}>Duplicar</MenuBtn>
                              <MenuLink href={`/surveys/${s.id}/preview`} icon={<Eye className="size-4" />}>Preview</MenuLink>
                              {s.status === "ativa" && (
                                <MenuBtn onClick={() => changeStatus(s.id, "pausada", "Pesquisa pausada.")} icon={<Pause className="size-4" />}>Pausar</MenuBtn>
                              )}
                              {s.status === "pausada" && (
                                <MenuBtn onClick={() => changeStatus(s.id, "ativa", "Pesquisa reativada.")} icon={<Play className="size-4" />}>Reativar</MenuBtn>
                              )}
                              {/* arquivar: de qualquer status (tira do ar e da lista de trabalho; fica em "Arquivadas") */}
                              {s.status !== "encerrada" && (
                                <MenuBtn onClick={() => changeStatus(s.id, "encerrada", "Pesquisa arquivada.")} icon={<Archive className="size-4" />}>Arquivar</MenuBtn>
                              )}
                              {s.recurrence?.active && (
                                <MenuBtn onClick={() => { setMenuFor(null); setMenuPos(null); setStopping(s); }} icon={<RepeatOff className="size-4" />}>Parar recorrência</MenuBtn>
                              )}
                              <div className="my-1 border-t border-line" />
                              <MenuBtn onClick={() => { setMenuFor(null); setMenuPos(null); setDeleting(s); }} icon={<Trash2 className="size-4" />} danger>Excluir</MenuBtn>
                            </div>
                          </>,
                          document.body
                        )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={multiHost ? 9 : 8} className="px-6 py-10 text-center text-fg-mut">Nenhuma pesquisa encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {renaming && (
        <RenameDialog
          initial={renaming.name}
          onCancel={() => setRenaming(null)}
          onConfirm={doRename}
        />
      )}

      {duplicating && (
        <DuplicateDialog
          survey={duplicating}
          currentDate={currentDate}
          recurrenceReady={recurrenceReady}
          onCancel={() => setDuplicating(null)}
          onConfirm={doDuplicate}
        />
      )}

      {stopping?.recurrence && (
        <StopRecurrenceDialog
          survey={stopping}
          // a rodada mais nova da série: se ainda não começou, segue agendada depois de parar
          scheduled={items.find((x) => x.recurrence?.id === stopping.recurrence?.id && x.recurrence?.latest && x.display === "agendada") ?? null}
          onCancel={() => setStopping(null)}
          onConfirm={doStopRecurrence}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Excluir pesquisa?"
          survey={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-bg-elev p-6 shadow-[var(--shadow-lg)]">
        {children}
      </div>
    </div>
  );
}

function RenameDialog({ initial, onCancel, onConfirm }: { initial: string; onCancel: () => void; onConfirm: (name: string) => void }) {
  const [name, setName] = useState(initial);
  const [saving, start] = useTransition();
  const valid = name.trim().length > 0 && name.trim() !== initial;
  return (
    <Backdrop onClose={onCancel}>
      <h3 className="font-display text-lg font-bold">Renomear pesquisa</h3>
      <p className="mt-1 text-sm text-fg-mut">Dê um novo nome a esta pesquisa.</p>
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && valid) start(() => onConfirm(name.trim())); }}
        className="mt-4"
        placeholder="Nome da pesquisa"
      />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" disabled={!valid || saving} onClick={() => start(() => onConfirm(name.trim()))}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null} Salvar
        </Button>
      </div>
    </Backdrop>
  );
}

/**
 * Diálogo de duplicar. A vigência da nova pesquisa é a primeira coisa que aparece —
 * é a decisão que muda entre uma rodada e outra (a cópia herda todo o resto da original).
 * Já vem pré-preenchida com um período de 30 dias a partir de hoje, que é o caso comum.
 *
 * "Repetir" transforma a cópia na 1ª rodada de uma pesquisa recorrente: a cada N semanas a
 * Luumu cria a próxima, com a mesma duração e começando no mesmo dia da semana.
 */
function DuplicateDialog({
  survey,
  currentDate,
  recurrenceReady,
  onCancel,
  onConfirm,
}: {
  survey: SurveyListItem;
  currentDate: string;
  recurrenceReady: boolean;
  onCancel: () => void;
  onConfirm: (values: DuplicateValues) => void;
}) {
  const defaultName = `${survey.name} (cópia)`;
  const [name, setName] = useState(defaultName);
  const [startsAt, setStartsAt] = useState(currentDate);
  const [endsAt, setEndsAt] = useState(() => addDays(currentDate, 30));
  // agendar (publica já com a vigência) ou criar como rascunho para revisar antes
  const [schedule, setSchedule] = useState(true);
  const [repeat, setRepeat] = useState(false);
  const [every, setEvery] = useState<RecurrenceInterval>(1);
  const [saving, start] = useTransition();

  const invalidRange = Boolean(startsAt && endsAt && startsAt > endsAt);
  const endPassed = Boolean(schedule && endsAt && endsAt < currentDate);
  const future = Boolean(startsAt && startsAt > currentDate);
  const duration = startsAt && endsAt && !invalidRange ? durationDays(startsAt, endsAt) : null;
  const repeatFits = duration !== null && intervalFits(every, duration);
  const valid =
    name.trim().length > 0 && !invalidRange && !endPassed && (!schedule || Boolean(startsAt)) && (!repeat || repeatFits);

  function toggleRepeat(on: boolean) {
    setRepeat(on);
    if (!on) return;
    // recorrente sempre publica: cada rodada entra no ar sozinha na data de início
    setSchedule(true);
    // nome-base: cada rodada ganha a vigência no nome, o "(cópia)" sobra
    if (name === defaultName) setName(baseName(survey.name));
    // vigência longa demais para repetir (ex.: os 30 dias sugeridos): uma semana a partir do início
    const from = startsAt || currentDate;
    let d = startsAt && endsAt && startsAt <= endsAt ? durationDays(startsAt, endsAt) : null;
    if (d === null || defaultInterval(d) === null) {
      if (!startsAt) setStartsAt(from);
      setEndsAt(addDays(from, 6));
      d = 6;
    }
    setEvery(defaultInterval(d) ?? 1);
  }

  const next = repeat && repeatFits && startsAt ? nextOccurrence(startsAt, every, duration!, startsAt) : null;
  const finalName = name.trim() || "Pesquisa";

  return (
    <Backdrop onClose={onCancel}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-brand text-accent">
          <Copy className="size-5" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold">Duplicar pesquisa</h3>
          <p className="mt-1 text-sm text-fg-soft">
            A cópia herda as perguntas, a aparência, o público, os gatilhos, a frequência e o
            limite de respostas de <strong>{survey.name}</strong>. As respostas não são copiadas.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-line bg-bg-sunken p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg-soft">
          <CalendarRange className="size-4 text-accent" /> Vigência da nova pesquisa
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Início">
            <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field label="Fim">
            <Input type="date" value={endsAt} min={startsAt || undefined} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>
        <p className={cn("mt-2.5 text-xs", invalidRange ? "text-erro" : "text-fg-mut")}>
          {invalidRange
            ? "A data de fim não pode ser anterior à de início."
            : `Vigência: ${scheduleLabel(startsAt, endsAt)}. Fora desse período a pesquisa não é exibida.`}
        </p>

        <div className="mt-3 border-t border-line pt-3">
          <label className={cn("flex items-center gap-2 text-sm font-semibold", recurrenceReady ? "cursor-pointer text-fg-soft" : "text-fg-mut")}>
            <input
              type="checkbox"
              className="accent-[var(--accent)]"
              checked={repeat}
              disabled={!recurrenceReady}
              onChange={(e) => toggleRepeat(e.target.checked)}
            />
            <Repeat className="size-4 text-accent" /> Repetir esta pesquisa
          </label>
          {!recurrenceReady && (
            <p className="mt-1.5 text-xs text-fg-mut">Indisponível até aplicar a migração drizzle/0047_survey_recurrences.sql.</p>
          )}
          {repeat && (
            <div className="mt-3 grid gap-2">
              <Select value={every} onChange={(e) => setEvery(Number(e.target.value) as RecurrenceInterval)} aria-label="Intervalo">
                {RECURRENCE_INTERVALS.map((w) => (
                  <option key={w} value={w} disabled={duration !== null && !intervalFits(w, duration)}>
                    {INTERVAL_LABEL[w]}
                  </option>
                ))}
              </Select>
              {!startsAt || !endsAt ? (
                <p className="text-xs text-erro">Para repetir, escolha o início e o fim da vigência.</p>
              ) : !repeatFits ? (
                <p className="text-xs text-erro">
                  A vigência ({(duration ?? 0) + 1} dias) é mais longa que o intervalo: uma rodada começaria antes da anterior terminar.
                </p>
              ) : (
                <p className="text-xs text-fg-mut">
                  {recurrenceLabel(every, startsAt, endsAt)}, até você parar a recorrência. A próxima rodada
                  {next ? ` (${scheduleLabel(next.startsAt, next.endsAt)})` : ""} é criada sozinha, já agendada, quando esta começar.
                  Cada rodada se chama <strong>{occurrenceName(finalName, startsAt, endsAt)}</strong>.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <Field label={repeat ? "Nome da pesquisa recorrente" : "Nome da cópia"} className="mt-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da pesquisa" />
      </Field>

      <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Depois de duplicar">
        <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition", schedule ? "border-accent bg-surface-brand" : "border-line")}>
          <input type="radio" className="mt-0.5 accent-[var(--accent)]" checked={schedule} onChange={() => setSchedule(true)} />
          <span>
            <span className="font-semibold">{future ? "Agendar" : "Publicar agora"}</span>
            <span className="block text-xs text-fg-mut">
              {future
                ? `Fica como agendada e entra no ar sozinha em ${formatDate(startsAt)}${endsAt ? `; sai do ar depois de ${formatDate(endsAt)}` : ""}.`
                : `Entra no ar hoje${endsAt ? ` e sai depois de ${formatDate(endsAt)}` : ""}.`}
            </span>
          </span>
        </label>
        <label
          className={cn(
            "flex items-start gap-3 rounded-xl border p-3 text-sm transition",
            !schedule ? "border-accent bg-surface-brand" : "border-line",
            repeat ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          )}
        >
          <input type="radio" className="mt-0.5 accent-[var(--accent)]" checked={!schedule} disabled={repeat} onChange={() => setSchedule(false)} />
          <span>
            <span className="font-semibold">Salvar como rascunho</span>
            <span className="block text-xs text-fg-mut">
              {repeat ? "Indisponível com repetição: cada rodada entra no ar sozinha." : "Abre a cópia no editor para revisar e publicar depois."}
            </span>
          </span>
        </label>
        {schedule && !startsAt && <p className="text-xs text-erro">Escolha a data de início para agendar.</p>}
        {endPassed && <p className="text-xs text-erro">A data de fim já passou: a pesquisa não entraria no ar.</p>}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button
          size="sm"
          disabled={!valid || saving}
          onClick={() =>
            start(() => onConfirm({ name: name.trim(), startsAt, endsAt, schedule, ...(repeat ? { repeatWeeks: every } : {}) }))
          }
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : repeat ? (
            <Repeat className="size-4" />
          ) : schedule ? (
            <CalendarRange className="size-4" />
          ) : (
            <Copy className="size-4" />
          )}{" "}
          {repeat ? "Duplicar e repetir" : schedule ? (future ? "Duplicar e agendar" : "Duplicar e publicar") : "Duplicar"}
        </Button>
      </div>
    </Backdrop>
  );
}

function StopRecurrenceDialog({
  survey,
  scheduled,
  onCancel,
  onConfirm,
}: {
  survey: SurveyListItem;
  /** rodada já criada e ainda não iniciada (continua agendada depois de parar) */
  scheduled: SurveyListItem | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [saving, start] = useTransition();
  return (
    <Backdrop onClose={onCancel}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-brand text-accent">
          <RepeatOff className="size-5" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold">Parar recorrência?</h3>
          <p className="mt-1 text-sm text-fg-soft">
            Nenhuma rodada nova de <strong>{baseName(survey.name)}</strong> será criada ({survey.recurrence?.label.toLowerCase()}).
            As rodadas que já existem continuam como estão.
          </p>
          {scheduled && (
            <p className="mt-2 text-sm text-fg-soft">
              A rodada <strong>{scheduled.name}</strong> já está agendada e vai entrar no ar. Se não quiser, exclua-a depois pelo menu (⋯).
            </p>
          )}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" disabled={saving} onClick={() => start(onConfirm)}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <RepeatOff className="size-4" />} Parar recorrência
        </Button>
      </div>
    </Backdrop>
  );
}

function ConfirmDialog({ title, survey, onCancel, onConfirm }: { title: string; survey: SurveyListItem; onCancel: () => void; onConfirm: () => void }) {
  const [saving, start] = useTransition();
  return (
    <Backdrop onClose={onCancel}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-erro/12 text-erro">
          <AlertTriangle className="size-5" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <p className="mt-1 text-sm text-fg-soft">
            A pesquisa <strong>{survey.name}</strong>
            {survey.responseCount > 0 ? (
              <> e suas <strong>{survey.responseCount} {survey.responseCount === 1 ? "resposta" : "respostas"}</strong> serão excluídas permanentemente.</>
            ) : (
              <> será excluída permanentemente.</>
            )}{" "}
            Esta ação não pode ser desfeita.
          </p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button variant="danger" size="sm" disabled={saving} onClick={() => start(onConfirm)}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Excluir
        </Button>
      </div>
    </Backdrop>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-fg-soft hover:bg-bg-sunken">
      {icon} {children}
    </Link>
  );
}

function MenuBtn({ onClick, icon, children, danger }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn("flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium hover:bg-bg-sunken", danger ? "text-erro" : "text-fg-soft")}
    >
      {icon} {children}
    </button>
  );
}
