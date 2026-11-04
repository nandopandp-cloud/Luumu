import "server-only";
import { after } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "./client";
import {
  getAnalyticsSettings,
  getAnalyticsSharedCached,
  listAnalyticsUsers,
  resolvePeriod,
  runDataset,
  TREND_EVENTS,
  type AnalyticsData,
  type AnalyticsSettings,
  DATASETS,
  type Dataset,
  type PeriodScope,
} from "./analytics";
import { claimResults, pruneResults, readResults, recentResultKeys, releaseResult, touchResults, writeResult } from "./analytics-results";
import { rollupAnalyticsDays } from "./analytics-rollup";
import { brDay } from "@/lib/analytics/rollup-range";
import { datasetsFor, TAB_LAYOUT } from "@/lib/analytics/derive";
import { startOfTodayBR } from "@/lib/utils/period";

/*
  O painel de Analytics nunca espera um cálculo.

  Cada bloco (dataset) de cada recorte tem um resultado guardado em analytics_results. Ao abrir,
  a página responde na hora com o que existe:
   - resultado dentro do prazo → mostra;
   - resultado vencido → mostra o que tem e recalcula DEPOIS da resposta (after);
   - sem resultado → o bloco aparece como "Calculando…" e é calculado depois da resposta.
  Os cálculos rodam um de cada vez, do mais leve ao mais pesado, e a tela (AnalyticsShell)
  pergunta de novo a cada poucos segundos, preenchendo bloco a bloco. Em seguida são adiantadas
  as outras abas do mesmo recorte e Hoje/7/30 dias da mesma plataforma (prefetch).
  O cron da madrugada (warmAnalyticsResults) recalcula, uma consulta por vez, o que foi aberto
  nos últimos 7 dias e Hoje/7/30 dias de cada projeto ativo, então a primeira abertura do dia
  também é instantânea. Os resultados ficam no banco: sobrevivem a deploys (o cache do Next não,
  porque a chave dele inclui o código da função).

  Prazos: Hoje 10 min; 7 dias 30 min; períodos maiores 1 h (mudam pouco de uma hora para outra, e
  cada recálculo custa compute). Um resultado de 7 dias ou mais com mais de 3 dias não é mostrado:
  é recalculado na hora.
*/

const MIN = 60_000;
/** Listas guardadas com o tamanho máximo que alguma aba pede; cada aba corta o que mostra. */
const PAGES_MAX = 50;
const EVENTS_MAX = 40;

type Id = Dataset | "usersList";

interface Spec {
  k: Id;
  period: string;
  from?: string;
  to?: string;
  host?: string;
  device?: string;
  /** dia de Brasília, só em "Hoje" (o resultado de ontem não vale para hoje) */
  day?: string;
  /** o que mais muda o resultado: eventos configurados, opções da lista de usuários */
  extra?: unknown;
}

const SETTINGS_USED: Partial<Record<Dataset, (keyof AnalyticsSettings)[]>> = {
  configured: ["northStarEvent", "activationEvent", "taskStartEvent", "taskDoneEvent"],
  funnel: ["taskStartEvent", "taskDoneEvent"],
  outcomes: ["activationEvent"],
  outcomesPrev: ["activationEvent"],
};

function specOf(k: Id, p: PeriodScope, st: AnalyticsSettings, extra?: unknown): Spec {
  const custom = p.period === "custom";
  const used = k === "usersList" ? undefined : SETTINGS_USED[k];
  return {
    k,
    period: p.period,
    from: custom ? p.from : undefined,
    to: custom ? p.to : undefined,
    host: p.host || undefined,
    device: p.device || undefined,
    day: p.period === "today" ? brDay(new Date()) : undefined,
    extra: k === "usersList" ? extra : used ? Object.fromEntries(used.map((x) => [x, st[x]])) : undefined,
  };
}

const keyOf = (s: Spec) => JSON.stringify([s.k, s.period, s.from ?? null, s.to ?? null, s.host ?? null, s.device ?? null, s.day ?? null, s.extra ?? null]);

function parseKey(key: string): Spec | null {
  try {
    const [k, period, from, to, host, device, day, extra] = JSON.parse(key) as [Id, string, string | null, string | null, string | null, string | null, string | null, unknown];
    return { k, period, from: from ?? undefined, to: to ?? undefined, host: host ?? undefined, device: device ?? undefined, day: day ?? undefined, extra: extra ?? undefined };
  } catch {
    return null;
  }
}

const scopeOf = (projectId: string, s: Spec): PeriodScope => ({ projectId, period: s.period, from: s.from, to: s.to, host: s.host, device: s.device });

/** Prazo de validade e idade máxima mostrável de um resultado do recorte. */
function policy(p: PeriodScope): { fresh: number; maxStale: number } {
  if (p.period === "custom") {
    const closed = resolvePeriod(p).to.getTime() <= startOfTodayBR().getTime();
    return { fresh: closed ? 24 * 60 * MIN : 30 * MIN, maxStale: Infinity };
  }
  if (p.period === "today") return { fresh: 10 * MIN, maxStale: Infinity };
  return { fresh: (p.period === "7d" ? 30 : 60) * MIN, maxStale: 3 * 24 * 60 * MIN };
}

/** Calcula um resultado. A tendência de eventos usa a lista de eventos já obtida, se houver. */
async function compute(projectId: string, s: Spec, st: AnalyticsSettings, have: Map<Id, unknown>): Promise<unknown> {
  const scope = resolvePeriod(scopeOf(projectId, s));
  if (s.k === "usersList") return listAnalyticsUsers(scope, (s.extra ?? {}) as Parameters<typeof listAnalyticsUsers>[1]);
  if (s.k === "eventTrend") {
    const ev = (have.get("events") ?? (await runDataset("events", scope, st, { eventsLimit: EVENTS_MAX }))) as { name: string }[];
    return runDataset("eventTrend", scope, st, { trendEvents: ev.slice(0, TREND_EVENTS).map((e) => e.name) });
  }
  return runDataset(s.k, scope, st, { pagesLimit: PAGES_MAX, eventsLimit: EVENTS_MAX });
}

/** Roda depois da resposta (fora de uma requisição — scripts, testes — roda já, sem esperar). */
function later(fn: () => Promise<unknown>) {
  const run = () => fn().catch((e) => console.error("[analytics] recálculo em segundo plano", e));
  try {
    after(run);
  } catch {
    void run();
  }
}

/** Do mais leve ao mais pesado (medido no maior projeto): o que é barato aparece primeiro. */
const COST_ORDER: Id[] = [
  "usersList", "daily", "totals", "devices", "channels", "entry", "exit", "campaigns", "frequency", "hours", "techs", "deviceTrend",
  "newUsers", "recurrent", "mau", "wau", "pages", "configured", "funnel", "retention", "outcomes", "outcomesPrev", "events", "eventTrend",
];
const byCost = (a: Id, b: Id) => COST_ORDER.indexOf(a) - COST_ORDER.indexOf(b);

interface Item {
  k: Id;
  spec: Spec;
  key: string;
}

/**
 * Trava e calcula os itens, UM DE CADA VEZ e do mais leve ao mais pesado, guardando cada um assim
 * que fica pronto (a tela, que pergunta de novo a cada 2 s, vai preenchendo bloco a bloco). Um de
 * cada vez: várias consultas pesadas juntas saturam a compute e atrasam todas.
 */
async function computeClaimed(projectId: string, st: AnalyticsSettings, items: Item[], have: Map<Id, unknown>) {
  if (!items.length) return;
  const claimed = await claimResults(projectId, items.map((i) => i.key));
  for (const it of [...items].sort((a, b) => byCost(a.k, b.k))) {
    if (!claimed.has(it.key)) continue;
    try {
      const v = await compute(projectId, it.spec, st, have);
      have.set(it.k, v);
      await writeResult(projectId, it.key, v);
    } catch (e) {
      console.error("[analytics] cálculo", it.key, e);
      await releaseResult(projectId, it.key).catch(() => {});
    }
  }
}

/**
 * Depois do que foi pedido, adianta o que a pessoa provavelmente abre em seguida: as outras abas
 * do mesmo recorte e Hoje/7/30 dias da mesma plataforma. Só o que ainda não existe (o que existe e
 * venceu é recalculado quando alguém abre).
 */
async function prefetch(p: PeriodScope, st: AnalyticsSettings) {
  const scopes: [PeriodScope, readonly Id[]][] = [[p, DATASETS]];
  for (const period of SEED_PERIODS) {
    if (period !== p.period) scopes.push([{ projectId: p.projectId, period, host: p.host, device: p.device }, SEED_FIRST]);
  }
  for (const [scope, ids] of scopes) {
    const items: Item[] = ids.map((k) => {
      const spec = specOf(k, scope, st);
      return { k, spec, key: keyOf(spec) };
    });
    const stored = (await readResults(scope.projectId, items.map((i) => i.key))) ?? new Map();
    const have = new Map<Id, unknown>();
    const todo = items.filter((i) => {
      const e = stored.get(i.key);
      if (e && e.at > 0) have.set(i.k, e.value);
      return !(e && e.at > 0);
    });
    await computeClaimed(scope.projectId, st, todo, have);
  }
}

export interface Freshness {
  /** quando foi calculado o resultado mais antigo mostrado (ISO); null = nenhum pronto ainda */
  at: string | null;
  /** algum resultado mostrado está vencido e está sendo recalculado */
  stale: boolean;
  /** blocos ainda sem resultado, sendo calculados agora */
  pending: string[];
}

/**
 * Lê os resultados e responde NA HORA com o que existe. O que falta e o que venceu é calculado
 * depois da resposta (after); a tela mostra "Calculando…" nesses blocos e pergunta de novo.
 */
async function readThrough(p: PeriodScope, st: AnalyticsSettings, specs: Map<Id, Spec>): Promise<{ have: Map<Id, unknown>; freshness: Freshness } | null> {
  const keys = new Map([...specs].map(([k, s]) => [k, keyOf(s)]));
  const stored = await readResults(p.projectId, [...keys.values()]);
  if (!stored) return null;

  const pol = policy(p);
  const now = Date.now();
  const have = new Map<Id, unknown>();
  const stale: Id[] = [];
  const missing: Id[] = [];
  let oldest: number | null = null;
  for (const [k, key] of keys) {
    const e = stored.get(key);
    // at = 0: linha reservada por um cálculo em andamento, ainda sem resultado
    if (e && e.at > 0 && now - e.at <= pol.maxStale) {
      have.set(k, e.value);
      oldest = Math.min(oldest ?? e.at, e.at);
      if (now - e.at > pol.fresh) stale.push(k);
    } else missing.push(k);
  }

  later(async () => {
    await touchResults(p.projectId, [...keys.values()]);
    const items = [...missing, ...stale].map((k) => ({ k, spec: specs.get(k)!, key: keys.get(k)! }));
    await computeClaimed(p.projectId, st, items, new Map(have));
    await prefetch(p, st);
  });

  return { have, freshness: { at: oldest === null ? null : new Date(oldest).toISOString(), stale: stale.length > 0, pending: missing } };
}

/** Datasets do painel (mesmo formato de getAnalytics), servidos dos resultados prontos. */
export async function getAnalyticsPanel(
  p: PeriodScope,
  st: AnalyticsSettings,
  want: Set<Dataset>,
  opts: { pagesLimit?: number; eventsLimit?: number } = {}
): Promise<{ data: AnalyticsData; freshness: Freshness | null }> {
  const need = new Set<Dataset>(want);
  if (need.has("eventTrend")) need.add("events");
  const specs = new Map<Id, Spec>([...need].map((k) => [k, specOf(k, p, st)]));
  const r = await readThrough(p, st, specs);
  if (!r) return { data: await getAnalyticsSharedCached(p, st, want, opts), freshness: null };
  const data: Record<string, unknown> = {};
  for (const k of want) data[k] = r.have.get(k);
  if (data.pages) data.pages = (data.pages as unknown[]).slice(0, opts.pagesLimit ?? 10);
  if (data.events) data.events = (data.events as unknown[]).slice(0, opts.eventsLimit ?? 10);
  return { data: data as AnalyticsData, freshness: r.freshness };
}

type UsersOpts = Parameters<typeof listAnalyticsUsers>[1];

/** Lista de usuários do painel (busca, segmento, ordem e página fazem parte da chave). */
export async function listAnalyticsUsersPanel(p: PeriodScope, st: AnalyticsSettings, opts: UsersOpts) {
  const norm = { q: (opts.q ?? "").trim().toLowerCase(), segment: opts.segment ?? "all", sort: opts.sort ?? "recent", dir: opts.dir ?? "desc", page: opts.page ?? 1 };
  const r = await readThrough(p, st, new Map<Id, Spec>([["usersList", specOf("usersList", p, st, norm)]]));
  if (!r) return { list: await listAnalyticsUsers(resolvePeriod(p), opts), freshness: null };
  return { list: r.have.get("usersList") as Awaited<ReturnType<typeof listAnalyticsUsers>> | undefined, freshness: r.freshness };
}

/* ---------- cron ---------- */

/** Recortes semeados para todo projeto com dados recentes: Hoje, 7 e 30 dias, sem filtro. */
const SEED_PERIODS = ["today", "7d", "30d"];
/** Primeiro a Visão geral (onde o painel abre), depois o resto das abas, se sobrar tempo. */
const SEED_FIRST = [...datasetsFor(TAB_LAYOUT.overview.map((b) => b.id))];
const SEED_LATER = DATASETS.filter((k) => !SEED_FIRST.includes(k));

/**
 * Recalcula, uma consulta por vez e até o fim do orçamento, os resultados abertos nos últimos 7
 * dias (Hoje passa para o dia novo) e semeia os projetos ativos: em duas rodadas, para um projeto
 * grande não gastar o orçamento dos outros — primeiro o que foi aberto e a Visão geral, depois as
 * outras abas. Apaga o que ninguém abre há 14 dias. Pula o que ainda está dentro do prazo.
 */
export async function warmAnalyticsResults(budgetMs = 200_000) {
  const deadline = Date.now() + budgetMs;
  const pruned = await pruneResults(14);
  const recent = await recentResultKeys(7);
  const active = (
    (await db.execute(sql`select distinct project_id from analytics_sessions where started_at > now() - interval '3 days'`)) as unknown as {
      rows: { project_id: string }[];
    }
  ).rows;

  type Round = Map<string, Map<string, Spec>>;
  const rounds: [Round, Round] = [new Map(), new Map()];
  const seen = new Set<string>();
  const add = (round: Round, projectId: string, s: Spec) => {
    const id = `${projectId} ${keyOf(s)}`;
    if (seen.has(id)) return;
    seen.add(id);
    const m = round.get(projectId) ?? new Map<string, Spec>();
    m.set(keyOf(s), s);
    round.set(projectId, m);
  };
  const openedScopes: [string, Spec][] = [];
  for (const r of recent) {
    const s = parseKey(r.key);
    if (!s || s.period === "custom") continue;
    add(rounds[0], r.projectId, s);
    openedScopes.push([r.projectId, s]);
  }
  for (const { project_id } of active) for (const period of SEED_PERIODS) for (const k of SEED_FIRST) add(rounds[0], project_id, { k, period });
  for (const { project_id } of active) for (const period of SEED_PERIODS) for (const k of SEED_LATER) add(rounds[1], project_id, { k, period });
  // as outras abas de cada recorte aberto (plataforma/dispositivo/período), para a troca de aba
  for (const [projectId, s] of openedScopes) for (const k of DATASETS) add(rounds[1], projectId, { ...s, k, extra: undefined });

  let computed = 0;
  let skipped = 0;
  let pending = 0;
  for (const [projectId, specsByKey] of rounds.flatMap((r) => [...r])) {
    const st = await getAnalyticsSettings(projectId);
    // a chave muda com a configuração e com o dia ("Hoje"): refaz a especificação com os de agora
    const specs = [...specsByKey.values()].map((s) => specOf(s.k, scopeOf(projectId, s), st, s.extra));
    const keys = specs.map(keyOf);
    const stored = (await readResults(projectId, keys)) ?? new Map();
    // por recorte: a tendência de eventos depois da lista de eventos do mesmo recorte
    const order = [...specs.keys()].sort((a, b) => Number(specs[a].k === "eventTrend") - Number(specs[b].k === "eventTrend"));
    const have = new Map<string, Map<Id, unknown>>();
    for (const i of order) {
      const s = specs[i];
      const key = keys[i];
      const e = stored.get(key);
      const scopeKey = keyOf({ ...s, k: "events", extra: undefined });
      const h = have.get(scopeKey) ?? new Map<Id, unknown>();
      have.set(scopeKey, h);
      if (e && Date.now() - e.at <= policy(scopeOf(projectId, s)).fresh) {
        if (s.k === "events") h.set("events", e.value);
        skipped++;
        continue;
      }
      if (Date.now() > deadline) {
        pending++;
        continue;
      }
      try {
        // tendência de eventos: usa a lista de eventos já guardada (pode ser de outra rodada)
        if (s.k === "eventTrend" && !h.has("events")) {
          const ev = (await readResults(projectId, [scopeKey]))?.get(scopeKey);
          if (ev) h.set("events", ev.value);
        }
        const v = await compute(projectId, s, st, h);
        h.set(s.k, v);
        await writeResult(projectId, key, v);
        computed++;
      } catch (err) {
        console.error("[analytics] aquecimento", projectId, key, err);
      }
    }
  }
  return { computed, skipped, pending, pruned };
}

/** Rotina diária do Analytics: resumo dos últimos dias, depois os resultados do painel. */
export async function runAnalyticsCron() {
  const rollup = await rollupAnalyticsDays().catch((e) => ({ error: String(e) }));
  const warm = await warmAnalyticsResults().catch((e) => ({ error: String(e) }));
  return { rollup, warm };
}
