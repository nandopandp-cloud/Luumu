import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { events } from "@/db/schema";
import { eventId } from "./ids";

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
 * Devolve os nomes normalizados, na ordem de entrada, porque quem chama usa isso para casar
 * gatilhos de pesquisa.
 */
export async function recordEvents(
  workspaceId: string,
  projectId: string,
  rawNames: string[]
): Promise<string[]> {
  const names: string[] = [];
  for (const raw of rawNames) {
    const name = normalizeEventName(raw);
    if (name && names.indexOf(name) < 0) names.push(name);
  }
  if (names.length === 0) return [];

  const unknown = names.filter((n) => !isKnownEvent(projectId, n));
  if (unknown.length === 0) return names;

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

  return names;
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
 * Pares (projeto, evento) já gravados por esta instância. Só cresce com eventos DISTINTOS —
 * um projeto tem dezenas deles, não milhões —, e o LRU limita o pior caso (key inválida
 * gerando nomes aleatórios). Perder o cache num lambda novo custa 1 UPSERT, nada mais:
 * a unicidade real continua garantida pelo índice (project_id, name) no banco.
 */
const KNOWN_MAX = 5000;
const knownEvents = new Map<string, true>();

function isKnownEvent(projectId: string, name: string): boolean {
  return knownEvents.has(`${projectId}:${name}`);
}

function markKnownEvent(projectId: string, name: string) {
  if (knownEvents.size >= KNOWN_MAX) {
    // descarta a entrada mais antiga (Map preserva ordem de inserção)
    const oldest = knownEvents.keys().next().value;
    if (oldest !== undefined) knownEvents.delete(oldest);
  }
  knownEvents.set(`${projectId}:${name}`, true);
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
 */
export async function eventCatalogForSdk(projectId: string): Promise<{ open: boolean; known: string[] }> {
  const rows = await db
    .select({ name: events.name })
    .from(events)
    .where(eq(events.projectId, projectId))
    .limit(MAX_EVENTS_PER_PROJECT);
  if (rows.length >= MAX_EVENTS_PER_PROJECT) return { open: false, known: [] };
  return { open: true, known: rows.map((r) => r.name) };
}

/** Lista os eventos do projeto (mais recentes/frequentes primeiro) para o seletor de gatilho. */
export async function listEvents(projectId: string) {
  return db
    .select({
      name: events.name,
      count: events.count,
      lastSeenAt: events.lastSeenAt,
    })
    .from(events)
    .where(eq(events.projectId, projectId))
    .orderBy(desc(events.lastSeenAt));
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
