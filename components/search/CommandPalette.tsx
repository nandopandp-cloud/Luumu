"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  CircleHelp,
  Clock,
  Code2,
  CornerDownLeft,
  Crown,
  FileText,
  Flame,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  MessageSquareText,
  Moon,
  Pencil,
  Plus,
  Route,
  Search,
  Settings,
  Sparkles,
  UserPlus,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Mascot } from "@/components/ui/Mascot";
import { toggleTheme } from "@/components/shell/ThemeToggle";
import { getResponseDetailAction } from "@/app/(app)/responses/actions";
import { searchHelp } from "@/lib/help/articles";
import {
  COMMANDS,
  highlight,
  matchCommands,
  MIN_QUERY,
  relativeTime,
  snippet,
  type CommandItem,
  type ResponseHit,
  type SearchResults,
  type SurveyHit,
  type TourHit,
} from "@/lib/search/core";

/* ---------- modelo ---------- */

type TabId = "all" | "surveys" | "responses" | "tours" | "pages";
const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "surveys", label: "Pesquisas" },
  { id: "responses", label: "Respostas" },
  { id: "tours", label: "Tours" },
  { id: "pages", label: "Páginas e ações" },
];

type Preview =
  | { kind: "survey"; hit: SurveyHit }
  | { kind: "response"; hit: ResponseHit }
  | { kind: "tour"; hit: TourHit }
  | { kind: "command"; item: CommandItem }
  | { kind: "recent"; entry: RecentEntry };

interface Row {
  key: string;
  group: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  subtitle: string;
  badge?: { label: string; cls: string };
  href?: string;
  run?: CommandItem["run"];
  preview: Preview;
  recent: RecentEntry;
}

interface RecentEntry {
  key: string;
  kind: "survey" | "response" | "tour" | "page" | "action";
  title: string;
  subtitle: string;
  href?: string;
  run?: CommandItem["run"];
}

const COMMAND_ICON: Record<string, LucideIcon> = {
  plus: Plus,
  route: Route,
  "user-plus": UserPlus,
  moon: Moon,
  dashboard: LayoutDashboard,
  surveys: ClipboardList,
  responses: MessageSquare,
  sparkles: Sparkles,
  reports: FileText,
  code: Code2,
  settings: Settings,
  user: UserRound,
  users: Users,
  crown: Crown,
  flame: Flame,
  help: CircleHelp,
  chart: BarChart3,
};

const RECENT_ICON: Record<RecentEntry["kind"], LucideIcon> = {
  survey: ClipboardList,
  response: MessageSquareText,
  tour: Route,
  page: ArrowRight,
  action: Sparkles,
};

const SURVEY_STATUS: Record<string, { label: string; cls: string }> = {
  ativa: { label: "Ativa", cls: "bg-sucesso/12 text-sucesso" },
  rascunho: { label: "Rascunho", cls: "bg-fg/8 text-fg-mut" },
  pausada: { label: "Pausada", cls: "bg-aviso/15 text-aviso" },
  encerrada: { label: "Encerrada", cls: "bg-fg/8 text-fg-mut" },
};
const TOUR_STATUS: Record<string, { label: string; cls: string }> = {
  published: { label: "Publicado", cls: "bg-sucesso/12 text-sucesso" },
  draft: { label: "Rascunho", cls: "bg-fg/8 text-fg-mut" },
  paused: { label: "Pausado", cls: "bg-aviso/15 text-aviso" },
  archived: { label: "Arquivado", cls: "bg-fg/8 text-fg-mut" },
};
const SENTIMENT = {
  positivo: { label: "Positivo", cls: "bg-sucesso/12 text-sucesso" },
  neutro: { label: "Neutro", cls: "bg-aviso/15 text-aviso" },
  negativo: { label: "Negativo", cls: "bg-erro/10 text-erro" },
} as const;

const surveyHref = (s: SurveyHit) => (s.status === "rascunho" ? `/surveys/${s.id}/builder` : `/surveys/${s.id}/responses`);
const scoreLabel = (n: number | null) => (n === null ? null : Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

/* ---------- últimos abertos (por navegador) ---------- */

const RECENT_KEY = "luumu-search-recent";
function loadRecent(): RecentEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.slice(0, 5) : [];
  } catch {
    return [];
  }
}
function saveRecent(e: RecentEntry) {
  try {
    const next = [e, ...loadRecent().filter((r) => r.key !== e.key)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

/* ---------- peças ---------- */

function Hl({ text, q }: { text: string; q: string }) {
  return (
    <>
      {highlight(text, q).map((s, i) =>
        s.match ? (
          <mark key={i} className="rounded-[4px] bg-accent/15 px-0.5 text-accent">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </>
  );
}

const Kbd = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <kbd
    className={cn(
      "inline-grid h-[22px] min-w-[22px] place-items-center rounded-md border border-line-strong bg-bg-elev px-1.5 font-sans text-[11px] font-semibold text-fg-mut shadow-[0_1px_0_var(--line-strong)]",
      className
    )}
  >
    {children}
  </kbd>
);

/** "⌘" no Mac, "Ctrl" no resto */
const noop = () => () => {};
export function useModKey() {
  return useSyncExternalStore(
    noop,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"),
    () => "⌘"
  );
}

/* ---------- prévia (coluna da direita) ---------- */

type Detail = Awaited<ReturnType<typeof getResponseDetailAction>>;
const detailCache = new Map<string, Detail>();

function ResponsePreview({ hit, q }: { hit: ResponseHit; q: string }) {
  const [detail, setDetail] = useState<Detail | undefined>(() => detailCache.get(hit.id));
  useEffect(() => {
    if (detailCache.has(hit.id)) return;
    let alive = true;
    // espera o usuário parar na linha: setas rápidas não disparam uma busca por linha
    const t = window.setTimeout(() => {
      getResponseDetailAction(hit.id)
        .then((d) => {
          detailCache.set(hit.id, d);
          if (alive) setDetail(d);
        })
        .catch(() => {});
    }, 220);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [hit.id]);

  const s = hit.sentiment ? SENTIMENT[hit.sentiment] : null;
  const shown = detail?.id === hit.id ? detail : detailCache.get(hit.id);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {scoreLabel(hit.score) && (
          <span className="rounded-lg bg-surface-brand px-2.5 py-1 font-display text-lg font-extrabold leading-none text-accent">
            {scoreLabel(hit.score)}
          </span>
        )}
        {s && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", s.cls)}>{s.label}</span>}
        <span className="ml-auto text-xs text-fg-mut">{relativeTime(hit.createdAt)}</span>
      </div>
      {hit.comment && (
        <blockquote className="relative rounded-xl border border-line bg-bg-sunken/60 px-4 py-3 text-sm leading-relaxed text-fg-soft">
          <span className="absolute -top-2 left-3 font-display text-3xl leading-none text-accent/40" aria-hidden>
            “
          </span>
          <Hl text={hit.comment.length > 420 ? `${hit.comment.slice(0, 420).trimEnd()}…` : hit.comment} q={q} />
        </blockquote>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-fg-mut">Pesquisa</dt>
        <dd className="truncate font-semibold text-fg-soft">{hit.surveyName}</dd>
        {hit.respondent && (
          <>
            <dt className="text-fg-mut">Quem</dt>
            <dd className="truncate font-semibold text-fg-soft">
              <Hl text={hit.respondent} q={q} />
            </dd>
          </>
        )}
      </dl>
      {shown && shown.answers.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-mut">Todas as respostas</div>
          <ul className="flex flex-col gap-2">
            {shown.answers.slice(0, 4).map((a, i) => (
              <li key={i} className="text-xs leading-snug">
                <span className="block text-fg-mut">{a.question}</span>
                <span className="line-clamp-2 font-semibold text-fg-soft">{a.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PreviewPane({ row, q, onOpen }: { row: Row | null; q: string; onOpen: (href: string, newTab?: boolean) => void }) {
  const mod = useModKey();
  if (!row) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <Mascot name="Analisando" size={96} />
        <p className="mt-3 text-sm font-semibold text-fg-soft">Encontre qualquer coisa</p>
        <p className="mt-1 text-xs leading-relaxed text-fg-mut">Pesquisas, comentários de clientes, tours e páginas, tudo num só lugar.</p>
      </div>
    );
  }
  const p = row.preview;
  const Icon = row.icon;
  const head = (
    <div className="flex items-start gap-3">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", row.tone)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="line-clamp-2 font-display text-[15px] font-bold leading-snug text-fg">
          {p.kind === "response" ? `Resposta em ${p.hit.surveyName}` : <Hl text={row.title} q={q} />}
        </div>
        <div className="mt-0.5 text-xs text-fg-mut">{row.group}</div>
      </div>
    </div>
  );

  const actions: { label: string; href: string; icon: LucideIcon }[] = [];
  if (p.kind === "survey") {
    actions.push({ label: "Ver respostas", href: `/surveys/${p.hit.id}/responses`, icon: MessageSquare });
    actions.push({ label: "Editar pesquisa", href: `/surveys/${p.hit.id}/builder`, icon: Pencil });
  } else if (p.kind === "tour") {
    actions.push({ label: "Abrir tour", href: `/tours/${p.hit.id}`, icon: Route });
    actions.push({ label: "Ver analytics", href: `/tours/${p.hit.id}/analytics`, icon: BarChart3 });
  } else if (p.kind === "response") {
    actions.push({ label: "Ver no feed de respostas", href: `/responses?surveyId=${p.hit.surveyId}`, icon: MessageSquare });
  }

  return (
    <div key={row.key} className="flex h-full flex-col gap-4 animate-[luumuFade_.18s_ease-out]">
      {head}
      {p.kind === "survey" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-line p-3">
            <div className="font-display text-2xl font-extrabold leading-none tabular-nums">{p.hit.responses.toLocaleString("pt-BR")}</div>
            <div className="mt-1 text-[11px] text-fg-mut">respostas</div>
          </div>
          <div className="rounded-xl border border-line p-3">
            <div className="font-display text-2xl font-extrabold leading-none">{p.hit.type}</div>
            <div className="mt-1 text-[11px] text-fg-mut">tipo</div>
          </div>
          <div className="col-span-2 flex items-center justify-between text-xs text-fg-mut">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", (SURVEY_STATUS[p.hit.status] ?? SURVEY_STATUS.rascunho).cls)}>
              {(SURVEY_STATUS[p.hit.status] ?? SURVEY_STATUS.rascunho).label}
            </span>
            <span>Atualizada {relativeTime(p.hit.updatedAt)}</span>
          </div>
        </div>
      )}
      {p.kind === "tour" && (
        <div className="flex flex-col gap-3">
          {p.hit.description && <p className="text-sm leading-relaxed text-fg-soft">{p.hit.description}</p>}
          <div className="flex items-center justify-between text-xs text-fg-mut">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", (TOUR_STATUS[p.hit.status] ?? TOUR_STATUS.draft).cls)}>
              {(TOUR_STATUS[p.hit.status] ?? TOUR_STATUS.draft).label}
            </span>
            <span>Atualizado {relativeTime(p.hit.updatedAt)}</span>
          </div>
        </div>
      )}
      {p.kind === "response" && <ResponsePreview hit={p.hit} q={q} />}
      {(p.kind === "command" || p.kind === "recent") && (
        <p className="text-sm leading-relaxed text-fg-soft">{p.kind === "command" ? p.item.subtitle : p.entry.subtitle}</p>
      )}

      <div className="mt-auto flex flex-col gap-1.5">
        {actions.map((a) => (
          <button
            key={a.href}
            type="button"
            onClick={(e) => onOpen(a.href, e.metaKey || e.ctrlKey)}
            className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-left text-xs font-semibold text-fg-soft transition hover:border-accent/40 hover:bg-surface-brand/50 hover:text-accent"
          >
            <a.icon className="size-3.5" aria-hidden />
            {a.label}
            <ArrowRight className="ml-auto size-3.5" aria-hidden />
          </button>
        ))}
        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-fg-mut">
          <Kbd>
            <CornerDownLeft className="size-3" />
          </Kbd>
          {row.run ? "executar" : "abrir"}
          <span className="mx-1 text-line-strong">·</span>
          <Kbd>{mod}</Kbd>
          <Kbd>
            <CornerDownLeft className="size-3" />
          </Kbd>
          nova aba
        </div>
      </div>
    </div>
  );
}

/* ---------- paleta ---------- */

export function CommandPalette({ projectName, onClose }: { projectName: string | null; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<TabId>("all");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [recent] = useState<RecentEntry[]>(loadRecent);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, SearchResults>());
  const listId = useId();
  const term = q.trim();
  const [lastTerm, setLastTerm] = useState(term);
  if (lastTerm !== term) {
    setLastTerm(term);
    setError(null);
  }
  const searching = term.length >= MIN_QUERY;

  // foco no campo, rolagem da página travada e foco devolvido ao fechar
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, []);

  // busca no servidor com debounce; a anterior é cancelada a cada tecla
  useEffect(() => {
    if (!searching) return;
    const hit = cache.current.get(term);
    if (hit) {
      setResults(hit);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal, cache: "no-store" });
        const data = (await res.json()) as SearchResults & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Não foi possível buscar agora.");
        cache.current.set(term, data);
        setResults(data);
        setError(null);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message || "Não foi possível buscar agora.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250); // espera a pessoa parar de digitar: cada termo intermediário era uma invocação
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [term, searching]);

  // enquanto a nova busca não chega, a lista anterior fica na tela (sem piscar)
  const data = searching ? results : null;

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const commandRow = (c: CommandItem): Row => ({
      key: c.id,
      group: c.kind === "action" ? "Ações rápidas" : "Ir para",
      icon: COMMAND_ICON[c.icon] ?? ArrowRight,
      tone: c.kind === "action" ? "bg-surface-brand text-accent" : "bg-bg-sunken text-fg-soft",
      title: c.title,
      subtitle: c.subtitle,
      href: c.href,
      run: c.run,
      preview: { kind: "command", item: c },
      recent: { key: c.id, kind: c.kind, title: c.title, subtitle: c.subtitle, href: c.href, run: c.run },
    });

    if (!searching) {
      if (tab === "all") {
        for (const r of recent)
          out.push({
            key: `recent-${r.key}`,
            group: "Abertos recentemente",
            icon: RECENT_ICON[r.kind] ?? Clock,
            tone: "bg-bg-sunken text-fg-soft",
            title: r.title,
            subtitle: r.subtitle,
            href: r.href,
            run: r.run,
            preview: { kind: "recent", entry: r },
            recent: r,
          });
        COMMANDS.filter((c) => c.kind === "action").forEach((c) => out.push(commandRow(c)));
        COMMANDS.filter((c) => c.kind === "page").forEach((c) => out.push(commandRow(c)));
      } else if (tab === "pages") {
        COMMANDS.forEach((c) => out.push(commandRow(c)));
      }
      return out;
    }

    const d = data;
    if (d && (tab === "all" || tab === "surveys")) {
      for (const s of d.surveys) {
        const st = SURVEY_STATUS[s.status] ?? SURVEY_STATUS.rascunho;
        const sub = `${s.type} · ${s.responses.toLocaleString("pt-BR")} ${s.responses === 1 ? "resposta" : "respostas"}`;
        out.push({
          key: `s-${s.id}`,
          group: "Pesquisas",
          icon: ClipboardList,
          tone: "bg-surface-brand text-accent",
          title: s.name,
          subtitle: sub,
          badge: st,
          href: surveyHref(s),
          preview: { kind: "survey", hit: s },
          recent: { key: `s-${s.id}`, kind: "survey", title: s.name, subtitle: sub, href: surveyHref(s) },
        });
      }
    }
    if (d && (tab === "all" || tab === "responses")) {
      for (const r of d.responses) {
        const title = r.comment ? snippet(r.comment, term, 60) : (r.respondent ?? "Resposta sem comentário");
        const sub = `${r.surveyName} · ${relativeTime(r.createdAt)}`;
        const sc = scoreLabel(r.score);
        out.push({
          key: `r-${r.id}`,
          group: "Respostas",
          icon: MessageSquareText,
          tone: "bg-sec-azul/10 text-sec-azul",
          title,
          subtitle: sub,
          badge: sc ? { label: `Nota ${sc}`, cls: r.sentiment ? SENTIMENT[r.sentiment].cls : "bg-fg/8 text-fg-mut" } : undefined,
          href: `/responses?surveyId=${r.surveyId}`,
          preview: { kind: "response", hit: r },
          recent: { key: `r-${r.id}`, kind: "response", title, subtitle: sub, href: `/responses?surveyId=${r.surveyId}` },
        });
      }
    }
    if (d && (tab === "all" || tab === "tours")) {
      for (const t of d.tours) {
        const st = TOUR_STATUS[t.status] ?? TOUR_STATUS.draft;
        const sub = t.description || `Tour · atualizado ${relativeTime(t.updatedAt)}`;
        out.push({
          key: `t-${t.id}`,
          group: "Tours",
          icon: Route,
          tone: "bg-luumu-verde/15 text-sucesso",
          title: t.name,
          subtitle: sub,
          badge: st,
          href: `/tours/${t.id}`,
          preview: { kind: "tour", hit: t },
          recent: { key: `t-${t.id}`, kind: "tour", title: t.name, subtitle: sub, href: `/tours/${t.id}` },
        });
      }
    }
    if (tab === "all" || tab === "pages") {
      matchCommands(term)
        .slice(0, tab === "all" ? 4 : 20)
        .forEach((c) => out.push({ ...commandRow(c), group: "Páginas e ações" }));
      // artigos da Central de Ajuda (busca local, sem servidor)
      for (const h of searchHelp(term).slice(0, 3)) {
        const item: CommandItem = {
          id: `help-${h.article.id}`,
          kind: "page",
          title: h.article.q,
          subtitle: `Ajuda · ${h.category.title}`,
          href: `/help?a=${h.article.id}`,
          keywords: [],
          icon: "help",
        };
        out.push({ ...commandRow(item), group: "Ajuda", tone: "bg-surface-brand text-accent" });
      }
    }
    return out;
  }, [searching, tab, recent, data, term]);

  const counts = useMemo(() => {
    const d = searching ? data : null;
    return {
      all: null,
      surveys: d?.surveys.length ?? null,
      responses: d?.responses.length ?? null,
      tours: d?.tours.length ?? null,
      pages: searching ? matchCommands(term).length : null,
    } as Record<TabId, number | null>;
  }, [searching, data, term]);

  // nova busca ou nova aba: volta para o primeiro resultado
  const [lastKey, setLastKey] = useState(`${term}|${tab}|${rows.length}`);
  const nowKey = `${term}|${tab}|${rows.length}`;
  if (lastKey !== nowKey) {
    setLastKey(nowKey);
    setActive(0);
  }
  const current = rows[Math.min(active, rows.length - 1)] ?? null;

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const open = useCallback(
    (row: Row, newTab = false) => {
      saveRecent(row.recent);
      if (row.run === "toggle-theme") {
        toggleTheme();
        onClose();
        return;
      }
      if (!row.href) return;
      if (newTab) {
        window.open(row.href, "_blank", "noopener");
        return;
      }
      onClose();
      router.push(row.href);
    },
    [onClose, router]
  );

  const openHref = useCallback(
    (href: string, newTab = false) => {
      if (current) saveRecent(current.recent);
      if (newTab) return void window.open(href, "_blank", "noopener");
      onClose();
      router.push(href);
    },
    [current, onClose, router]
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
      e.preventDefault();
      setActive((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
      e.preventDefault();
      setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (current) open(current, e.metaKey || e.ctrlKey);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const i = TABS.findIndex((t) => t.id === tab);
      setTab(TABS[(i + (e.shiftKey ? -1 : 1) + TABS.length) % TABS.length].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  // agrupa mantendo a ordem (o índice global continua valendo para o teclado)
  const groups: { name: string; items: { row: Row; index: number }[] }[] = [];
  rows.forEach((row, index) => {
    const g = groups[groups.length - 1];
    if (g && g.name === row.group) g.items.push({ row, index });
    else groups.push({ name: row.group, items: [{ row, index }] });
  });

  const noResults = searching && !loading && !error && data && rows.length === 0;
  const needsTerm = !searching && (tab === "surveys" || tab === "responses" || tab === "tours");
  const activeId = current ? `${listId}-${rows.indexOf(current)}` : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[9vh] sm:pt-[12vh]" role="presentation">
      <div
        className="absolute inset-0 bg-[rgba(18,10,42,.42)] backdrop-blur-[6px] animate-[luumuBackdropIn_.18s_ease-out]"
        onClick={onClose}
        aria-hidden
      />
      {/* brilho da marca atrás da caixa */}
      <div
        className="pointer-events-none absolute left-1/2 top-[10vh] h-[320px] w-[min(760px,90vw)] -translate-x-1/2 rounded-full bg-accent/25 blur-[90px] animate-[luumuBackdropIn_.4s_ease-out]"
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar na Luumu"
        onKeyDown={onKeyDown}
        className="relative flex max-h-[min(640px,82vh)] w-full max-w-[880px] flex-col overflow-hidden rounded-[22px] border border-line bg-bg-elev/95 shadow-[0_30px_80px_rgba(24,10,60,.35),0_0_0_1px_rgba(107,43,217,.10)] backdrop-blur-xl animate-[luumuPaletteIn_.22s_cubic-bezier(.16,1,.3,1)]"
      >
        {/* campo */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          {loading ? (
            <Loader2 className="size-5 shrink-0 animate-spin text-accent" aria-hidden />
          ) : (
            <Search className="size-5 shrink-0 text-accent" aria-hidden />
          )}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pesquisas, comentários, tours e páginas…"
            maxLength={80}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent font-display text-[18px] font-medium text-fg outline-none placeholder:font-sans placeholder:text-[16px] placeholder:font-normal placeholder:text-fg-mut"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
              aria-label="Limpar busca"
              className="grid size-7 place-items-center rounded-full text-fg-mut transition hover:bg-bg-sunken hover:text-fg"
            >
              <X className="size-4" />
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Fechar busca" className="hidden sm:block">
            <Kbd>Esc</Kbd>
          </button>
        </div>

        {/* filtros */}
        <div className="flex gap-1 overflow-x-auto border-b border-line px-4 py-2.5 [scrollbar-width:none]" role="tablist" aria-label="Filtrar resultados">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              tabIndex={-1}
              onClick={() => {
                setTab(t.id);
                inputRef.current?.focus();
              }}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition",
                tab === t.id ? "bg-accent text-white shadow-[0_4px_14px_rgba(107,43,217,.3)]" : "text-fg-mut hover:bg-bg-sunken hover:text-fg-soft"
              )}
            >
              {t.label}
              {counts[t.id] !== null && (
                <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", tab === t.id ? "bg-white/20" : "bg-bg-sunken")}>
                  {counts[t.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* resultados + prévia */}
        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_300px]">
          <div ref={listRef} id={listId} role="listbox" aria-label="Resultados" className="min-h-[280px] overflow-y-auto overscroll-contain px-2.5 py-2">
            {error && (
              <div className="m-3 rounded-xl border border-erro/25 bg-erro/[.06] px-4 py-3 text-sm text-erro" role="alert">
                {error}
              </div>
            )}

            {needsTerm && (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <Search className="size-8 text-accent/50" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-fg-soft">Digite ao menos {MIN_QUERY} letras</p>
                <p className="mt-1 text-xs text-fg-mut">
                  {tab === "responses" ? "Buscamos no texto dos comentários e em quem respondeu." : "Buscamos pelo nome, ignorando acentos."}
                </p>
              </div>
            )}

            {noResults && (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <Mascot name="Pensativo" size={92} />
                <p className="mt-3 text-sm font-semibold text-fg-soft">
                  Nada encontrado para “<span className="text-accent">{term}</span>”
                </p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-fg-mut">
                  {tab === "all" ? "Tente outra palavra, ou um trecho do comentário do cliente." : "Tente a aba Tudo para buscar em todos os tipos."}
                </p>
              </div>
            )}

            {searching && loading && rows.length === 0 && !error && (
              <div className="flex flex-col gap-2 p-2" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2">
                    <span className="size-9 animate-pulse rounded-lg bg-bg-sunken" />
                    <span className="flex-1">
                      <span className="block h-3.5 w-3/5 animate-pulse rounded bg-bg-sunken" />
                      <span className="mt-1.5 block h-3 w-2/5 animate-pulse rounded bg-bg-sunken" />
                    </span>
                  </div>
                ))}
              </div>
            )}

            {groups.map((g) => (
              <div key={g.name} role="group" aria-label={g.name} className="mb-1.5">
                <div className="sticky top-0 z-10 bg-bg-elev/95 px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-mut backdrop-blur">
                  {g.name}
                </div>
                {g.items.map(({ row, index }) => {
                  const on = index === active;
                  const Icon = row.icon;
                  return (
                    <div
                      key={row.key}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={on}
                      data-index={index}
                      onMouseMove={() => !on && setActive(index)}
                      onClick={(e) => open(row, e.metaKey || e.ctrlKey)}
                      className={cn(
                        "group relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                        on ? "bg-surface-brand" : "hover:bg-bg-sunken/60"
                      )}
                    >
                      {on && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" aria-hidden />}
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", row.tone)}>
                        <Icon className="size-[18px]" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm font-semibold", on ? "text-fg" : "text-fg-soft")}>
                          <Hl text={row.title} q={term} />
                        </span>
                        <span className="block truncate text-xs text-fg-mut">{row.subtitle}</span>
                      </span>
                      {row.badge && (
                        <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold sm:inline", row.badge.cls)}>{row.badge.label}</span>
                      )}
                      <CornerDownLeft className={cn("size-4 shrink-0 text-accent transition-opacity", on ? "opacity-100" : "opacity-0")} aria-hidden />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <aside className="hidden border-l border-line bg-bg-sunken/35 p-5 md:block" aria-label="Prévia">
            <PreviewPane row={needsTerm || noResults ? null : current} q={term} onOpen={openHref} />
          </aside>
        </div>

        {/* rodapé */}
        <div className="flex items-center justify-between gap-4 border-t border-line bg-bg-sunken/40 px-5 py-2.5 text-[11px] text-fg-mut">
          <div className="hidden items-center gap-3 sm:flex">
            <span className="inline-flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navegar
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>
                <CornerDownLeft className="size-3" />
              </Kbd>{" "}
              abrir
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>Tab</Kbd> filtrar
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>Esc</Kbd> fechar
            </span>
          </div>
          {projectName && (
            <span className="ml-auto inline-flex items-center gap-1.5 truncate">
              Buscando em <strong className="truncate font-semibold text-fg-soft">{results?.project?.name ?? projectName}</strong>
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
