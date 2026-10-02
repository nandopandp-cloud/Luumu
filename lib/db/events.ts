import "server-only";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { events, eventHosts } from "@/db/schema";
import { eventHostId, eventId } from "./ids";

/**
 * Normaliza o nome do evento em um slug estável e determinístico.
 * Remove acentos (NFD) antes do slug para que "Concluído" e "concluido" colidam.
 * DEVE ser idêntico ao slug() do SDK (sdk/luumu.ts).
 */
export function normalizeEventName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove marcas de acento combinantes
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}

/**
 * Registra os eventos INÉDITOS do projeto (ingestão do SDK).
 *
 * O catálogo responde a uma única pergunta: "que eventos existem neste produto?" — é a lista
 * que o cliente usa para escolher gatilhos de pesquisa. A primeira vez que alguém entra em
 * /biblioteca, a rota vira um evento conhecido; as visitas seguintes não acrescentam nada.
 * Por isso repetição não é gravada: nem em memória (caso comum), nem no banco.
 *
 * O SDK agrupa os nomes inéditos de uma visita e manda todos juntos. Os que esta instância já
 * conhece são descartados em memória, e o que sobra vira UM único INSERT com várias linhas —
 * não um INSERT por nome. No caso comum (tudo já catalogado) o banco não é tocado nenhuma vez.
 * `onConflictDoNothing` fecha a conta quando o cache está frio: o índice (project_id, name)
 * descarta o que já existe sem escrever nada.
 *
 * `host` é a plataforma de onde o lote veio: além do catálogo do projeto, o nome entra no
 * catálogo daquela plataforma (event_hosts), que é o que permite ao painel dizer de qual
 * produto do cliente cada evento vem.
 *
 * Devolve os nomes normalizados, na ordem de entrada, porque quem chama usa isso para casar
 * gatilhos de pesquisa.
 */
export async function recordEvents(
  workspaceId: string,
  projectId: string,
  rawNames: string[],
  host = ""
): Promise<string[]> {
  const names: string[] = [];
  for (const raw of rawNames) {
    const name = normalizeEventName(raw);
    if (name && names.indexOf(name) < 0) names.push(name);
  }
  if (names.length === 0) return [];

  await Promise.all([
    recordProjectCatalog(workspaceId, projectId, names),
    host ? recordHostCatalog(workspaceId, projectId, host, names) : null,
  ]);
  return names;
}

/** Catálogo do projeto inteiro (tabela `events`), sem distinção de plataforma. */
async function recordProjectCatalog(workspaceId: string, projectId: string, names: string[]) {
  const unknown = names.filter((n) => !isKnownEvent(projectId, n));
  if (unknown.length === 0) return;

  /*
    Filtro barato em memória primeiro: quando o projeto já está cheio, nem monta o INSERT.
    Ele é uma OTIMIZAÇÃO, não a garantia — quem garante o teto é o próprio INSERT abaixo.
  */
  const free = await catalogHeadroom(projectId, unknown.length);
  const toInsert = free <= 0 ? [] : unknown.slice(0, free);

  if (toInsert.length > 0) {
    /*
      O teto é aplicado DENTRO do INSERT, não antes dele.

      `catalogHeadroom` conta em memória, por instância. Com várias lambdas ativas — que é o
      estado normal sob carga — cada uma achava que tinha o catálogo inteiro disponível e
      liberava o próprio lote: N instâncias produziam até N× o teto. Foi assim que um projeto
      com MAX_EVENTS_PER_PROJECT = 300 chegou a 7.273 linhas (~25 instâncias simultâneas).

      Aqui o `where` é avaliado pelo Postgres no momento da escrita, contra a contagem real da
      tabela, então instâncias concorrentes disputam o mesmo limite em vez de cada uma ter o
      seu. O `select ... where (subselect) < MAX` descarta as linhas excedentes na própria
      operação: o teto passa a valer de verdade, independente de quantas lambdas estiverem no ar.
    */
    const rows = toInsert.map((name) => ({ id: eventId(), workspaceId, projectId, name }));
    const values = sql.join(
      rows.map((r) => sql`(${r.id}, ${r.workspaceId}, ${r.projectId}, ${r.name}, 1)`),
      sql`, `
    );
    const inserted = await db.execute<{ name: string }>(sql`
      insert into ${events} (id, workspace_id, project_id, name, count)
      select v.id, v.workspace_id, v.project_id, v.name, v.count
        from (values ${values}) as v(id, workspace_id, project_id, name, count)
       where (select count(*) from ${events} where ${events.projectId} = ${projectId})
             < ${MAX_EVENTS_PER_PROJECT}
      on conflict (project_id, name) do nothing
      returning name
    `);

    const insertedNames = (inserted.rows ?? []) as { name: string }[];
    // só marca como conhecido o que REALMENTE entrou: se o teto barrou, o nome continua
    // inédito e não deve ser dado como catalogado
    for (const row of insertedNames) markKnownEvent(projectId, row.name);

    /*
      A contagem otimista em memória mentiria se o banco tivesse recusado parte do lote.
      Invalidar força a próxima chamada a reler a contagem real — uma query a cada 10 min por
      projeto, e só quando houve nome inédito.
    */
    if (insertedNames.length !== rows.length) catalogCount.delete(projectId);
  }
}

/**
 * Teto do catálogo de CADA plataforma. Separado do teto do projeto de propósito: o catálogo
 * do projeto pode estar cheio de nomes antigos (antes da normalização de rotas e rótulos),
 * e isso não deve impedir uma plataforma de ter a sua lista de eventos.
 */
const MAX_EVENTS_PER_HOST = 300;
const FULL_HOST_TTL_MS = 10 * 60 * 1000;
// plataformas no teto, por instância: evita montar INSERT que o banco recusaria
const fullHosts = new Map<string, number>();

/** Catálogo da plataforma (tabela `event_hosts`): em qual hostname cada evento foi visto. */
async function recordHostCatalog(workspaceId: string, projectId: string, host: string, names: string[]) {
  const unknown = names.filter((n) => !isKnownEvent(projectId, n, host));
  if (unknown.length === 0) return;
  const hostKey = `${projectId}|${host}`;
  if ((fullHosts.get(hostKey) ?? 0) > Date.now()) return;

  // mesmo padrão de recordProjectCatalog: o teto vale dentro do INSERT, contra a contagem real
  const values = sql.join(
    unknown.map((name) => sql`(${eventHostId()}, ${name})`),
    sql`, `
  );
  const inserted = await db.execute<{ name: string }>(sql`
    insert into ${eventHosts} (id, workspace_id, project_id, host, name)
    select v.id, ${workspaceId}, ${projectId}, ${host}, v.name
      from (values ${values}) as v(id, name)
     where (select count(*) from ${eventHosts}
             where ${eventHosts.projectId} = ${projectId} and ${eventHosts.host} = ${host})
           < ${MAX_EVENTS_PER_HOST}
    on conflict (project_id, host, name) do nothing
    returning name
  `);
  const insertedNames = ((inserted.rows ?? []) as { name: string }[]).map((r) => r.name);
  for (const name of insertedNames) markKnownEvent(projectId, name, host);
  if (insertedNames.length === unknown.length) return;

  /*
    Parte do lote não entrou: ou o nome já estava catalogado (cache frio desta instância), ou
    a plataforma chegou ao teto. Só aqui vale a consulta extra para separar os dois casos —
    marcar o que já existe como conhecido, e parar de tentar se o catálogo encheu.
  */
  const rest = unknown.filter((n) => !insertedNames.includes(n));
  const [existing, [total]] = await Promise.all([
    db
      .select({ name: eventHosts.name })
      .from(eventHosts)
      .where(and(eq(eventHosts.projectId, projectId), eq(eventHosts.host, host), inArray(eventHosts.name, rest))),
    db
      .select({ n: count() })
      .from(eventHosts)
      .where(and(eq(eventHosts.projectId, projectId), eq(eventHosts.host, host))),
  ]);
  for (const row of existing) markKnownEvent(projectId, row.name, host);
  if (Number(total?.n ?? 0) >= MAX_EVENTS_PER_HOST) fullHosts.set(hostKey, Date.now() + FULL_HOST_TTL_MS);
}

/** Limite de eventos distintos por projeto: o catálogo é uma lista para escolher gatilhos. */
const MAX_EVENTS_PER_PROJECT = 300;
const catalogCount = new Map<string, { n: number; checkedAt: number }>();
const COUNT_TTL_MS = 10 * 60 * 1000;

/*
  Quantos nomes novos ainda cabem no catálogo do projeto (0 = cheio), resolvido uma vez para
  o lote inteiro em vez de uma consulta por nome.

  O teto existe porque o SDK roda no navegador do cliente: mesmo com rotas e rótulos
  normalizados, uma versão antiga, um `luumu.track()` com id concatenado ou uma página
  adulterada ainda podem inventar nomes novos indefinidamente — e cada nome inédito é uma
  linha nova e uma escrita. Foi assim que o catálogo chegou a 200 mil. Atingido o limite, o
  evento continua valendo como gatilho (o nome é devolvido), só não entra no catálogo.
*/
async function catalogHeadroom(projectId: string, wanted: number): Promise<number> {
  const now = Date.now();
  const cached = catalogCount.get(projectId);
  let n: number;
  if (cached && now - cached.checkedAt < COUNT_TTL_MS) {
    n = cached.n;
  } else {
    const [row] = await db
      .select({ n: count() })
      .from(events)
      .where(eq(events.projectId, projectId));
    n = Number(row?.n ?? 0);
    catalogCount.set(projectId, { n, checkedAt: now });
  }
  const free = Math.max(0, MAX_EVENTS_PER_PROJECT - n);
  const granted = Math.min(free, wanted);
  // otimista: conta as inserções que estão prestes a acontecer
  if (granted > 0) catalogCount.set(projectId, { n: n + granted, checkedAt: cached?.checkedAt ?? now });
  return granted;
}

/**
 * Pares (projeto, evento) — e trios (projeto, plataforma, evento) — já gravados por esta instância. Só cresce com eventos DISTINTOS —
 * um projeto tem dezenas deles, não milhões —, e o LRU limita o pior caso (key inválida
 * gerando nomes aleatórios). Perder o cache num lambda novo custa 1 UPSERT, nada mais:
 * a unicidade real continua garantida pelo índice (project_id, name) no banco.
 */
const KNOWN_MAX = 5000;
const knownEvents = new Map<string, true>();

// host "" = catálogo do projeto; com host = catálogo daquela plataforma
function isKnownEvent(projectId: string, name: string, host = ""): boolean {
  return knownEvents.has(`${projectId}|${host}|${name}`);
}

function markKnownEvent(projectId: string, name: string, host = "") {
  if (knownEvents.size >= KNOWN_MAX) {
    // descarta a entrada mais antiga (Map preserva ordem de inserção)
    const oldest = knownEvents.keys().next().value;
    if (oldest !== undefined) knownEvents.delete(oldest);
  }
  knownEvents.set(`${projectId}|${host}|${name}`, true);
}

/** Esquece o catálogo em memória de um projeto (usar se os eventos forem apagados). */
export function invalidateEventCache() {
  knownEvents.clear();
}

/**
 * Estado do catálogo que o SDK precisa para decidir se vale a pena mandar um nome.
 *
 * O dedupe do SDK é POR NAVEGADOR: cada visitante novo reenviava "page_view_home",
 * "click_entrar"... mesmo com o projeto já tendo esses nomes há semanas. E num projeto com o
 * catálogo cheio, `recordEvents` descarta tudo — o POST /events vira invocação sem efeito
 * nenhum. Foi o que fez essa rota responder por ~85% das invocações da plataforma, quase todas
 * de projetos já no teto.
 *
 * Vai junto com /config, que já é cacheado na borda e no navegador, então informar isso ao
 * SDK não custa request nenhuma a mais.
 *  - `open: false` → catálogo cheio: o SDK não manda mais nada (o servidor descartaria).
 *  - `known`       → nomes já catalogados: o SDK só manda o que for realmente novo.
 *
 * `limit` no teto: o que importa é saber se cabe mais, não contar além disso.
 *
 * Com `host`, o estado é o do catálogo DAQUELA plataforma: o SDK só manda o que ela ainda não
 * tem, e continua mandando mesmo que o catálogo do projeto esteja cheio — senão nenhum evento
 * de uma plataforma nova seria identificado num projeto antigo.
 */
export async function eventCatalogForSdk(
  projectId: string,
  host = ""
): Promise<{ open: boolean; known: string[] }> {
  if (host) {
    const rows = await db
      .select({ name: eventHosts.name })
      .from(eventHosts)
      .where(and(eq(eventHosts.projectId, projectId), eq(eventHosts.host, host)))
      .limit(MAX_EVENTS_PER_HOST);
    if (rows.length >= MAX_EVENTS_PER_HOST) return { open: false, known: [] };
    return { open: true, known: rows.map((r) => r.name) };
  }
  const rows = await db
    .select({ name: events.name })
    .from(events)
    .where(eq(events.projectId, projectId))
    .limit(MAX_EVENTS_PER_PROJECT);
  if (rows.length >= MAX_EVENTS_PER_PROJECT) return { open: false, known: [] };
  return { open: true, known: rows.map((r) => r.name) };
}

export interface ProjectEvent {
  name: string;
  count: number;
  lastSeenAt: Date;
  /** plataformas onde o evento foi visto; [] = só no catálogo do projeto (origem não identificada) */
  hosts: string[];
}

/**
 * Lista os eventos do projeto (mais recentes primeiro) para o seletor de gatilho, com as
 * plataformas de cada um. Junta os dois catálogos: um evento pode existir só no do projeto
 * (capturado antes de existir a separação por plataforma) ou só no de uma plataforma
 * (catálogo do projeto já cheio quando ele apareceu).
 */
export async function listEvents(projectId: string): Promise<ProjectEvent[]> {
  const [projectRows, hostRows] = await Promise.all([
    db
      .select({ name: events.name, count: events.count, lastSeenAt: events.lastSeenAt })
      .from(events)
      .where(eq(events.projectId, projectId)),
    db
      .select({ name: eventHosts.name, host: eventHosts.host, firstSeenAt: eventHosts.firstSeenAt })
      .from(eventHosts)
      .where(eq(eventHosts.projectId, projectId)),
  ]);

  const byName = new Map<string, ProjectEvent>();
  for (const r of projectRows) byName.set(r.name, { ...r, hosts: [] });
  for (const r of hostRows) {
    const ev = byName.get(r.name);
    if (!ev) {
      byName.set(r.name, { name: r.name, count: 1, lastSeenAt: r.firstSeenAt, hosts: [r.host] });
      continue;
    }
    if (!ev.hosts.includes(r.host)) ev.hosts.push(r.host);
    if (r.firstSeenAt > ev.lastSeenAt) ev.lastSeenAt = r.firstSeenAt;
  }
  return Array.from(byName.values()).sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
}

/** Verifica se um evento existe no projeto (usado ao salvar o gatilho de uma survey). */
export async function eventExists(projectId: string, name: string) {
  const [row] = await db
    .select({ name: events.name })
    .from(events)
    .where(and(eq(events.projectId, projectId), eq(events.name, normalizeEventName(name))))
    .limit(1);
  return !!row;
}
