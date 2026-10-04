import { listActiveSurveysForSdk } from "@/lib/db/surveys";
import { eventCatalogForSdk } from "@/lib/db/events";
import { hostStateForSdk, normalizeHost } from "@/lib/db/hosts";
import { listPublishedToursForSdk } from "@/lib/db/tours";
import { isHeatmapsEnabled } from "@/lib/db/heatmaps";
import { getAnalyticsSettings } from "@/lib/db/analytics";
import { SDK_BUNDLE_VERSION } from "@/lib/tours/sdk-version";
import { normalizeAppearance } from "@/lib/builder";
import { resolveKey } from "@/lib/api/keys";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";

/*
  Sem `dynamic = "force-dynamic"` de propósito.

  Esta rota lê a query string (`?key=`) e o header `Origin`, então já é dinâmica por
  natureza — o `force-dynamic` não a tornava dinâmica, ele apenas fazia o Next anunciar
  `no-store` para a borda, o que ANULAVA o `Cache-Control` montado logo abaixo. O cache
  existia no código e nunca valia na prática: toda chamada do SDK virava invocação.
*/

/**
 * Cache de borda do catálogo de pesquisas.
 *
 * Esta é a rota que TODO visitante de TODO site cliente chama no carregamento da página —
 * o maior volume da plataforma. O conteúdo dela é configuração: muda quando alguém publica,
 * pausa ou reagenda uma pesquisa no painel, não a cada request.
 *
 * Com `s-maxage` a CDN da Vercel responde sem acordar a função, o que corta de uma vez
 * invocação, Active CPU e Fast Origin Transfer do caminho mais quente. A chave da CDN inclui
 * a query string (`?key=pk_...`), então workspaces diferentes não compartilham resposta, e
 * `Vary: Origin` (em corsHeaders) separa as variantes de CORS.
 *
 * 60s é o atraso máximo para uma pesquisa publicada começar a aparecer, e
 * `stale-while-revalidate` evita que a expiração vire uma rajada no origin. Trocamos
 * "imediato" por "até 1 minuto" de propagação — aceitável para publicação de pesquisa,
 * que não é uma operação de tempo real.
 */
const CONFIG_CACHE = "public, s-maxage=60, stale-while-revalidate=300";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

/**
 * GET /api/v1/config?key=pk_...&host=plataforma.cliente.com
 * Resolve o workspace pela SDK key e retorna as pesquisas ativas DAQUELE workspace que valem
 * para a plataforma informada.
 *
 * Uma mesma key pode estar instalada em vários produtos do cliente. `host` é o hostname em
 * que o SDK está rodando: pesquisas com `targetHosts` só são devolvidas para esses hosts.
 * Ele vai na query string (e não é lido do header Origin) porque a resposta é cacheada na
 * borda por URL e sem `Vary: Origin` — o host precisa fazer parte da chave de cache.
 *
 * Sem `host` (versões do SDK anteriores a este parâmetro) só saem as pesquisas sem
 * plataforma definida: melhor não exibir do que exibir no produto errado.
 */
export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  const { searchParams } = new URL(req.url);
  const resolved = await resolveKey(searchParams.get("key"));
  if (!resolved) {
    return jsonCors({ error: "SDK key inválida." }, { status: 401, origin });
  }

  const allowOrigin = allowedOrigin(origin, resolved.domains);
  if (origin && allowOrigin === null) {
    // CORS liberado só nesta resposta de erro (não expõe nada): sem ele o navegador esconde o
    // status do SDK, que tomava o 403 por queda de rede e voltava a tentar em 1 min em vez
    // de 10 — num site com domínio fora da lista, é uma invocação por visitante a cada minuto.
    return jsonCors({ error: "Origem não autorizada." }, { status: 403, origin });
  }

  const host = normalizeHost(searchParams.get("host"));
  const [active, eventCatalog, hostState, tours, heatmaps, analytics] = await Promise.all([
    listActiveSurveysForSdk(resolved.projectId),
    eventCatalogForSdk(resolved.projectId, host),
    hostStateForSdk(resolved.projectId, host),
    // tours publicados para esta plataforma, SEM os passos: o runtime só é baixado se algum
    // for elegível neste navegador (ver docs/tours/ARQUITETURA.md §4)
    // tolerante a falha: um problema nos tours (ex.: migração ainda não aplicada) não pode
    // derrubar a rota de que as pesquisas de todos os clientes dependem
    listPublishedToursForSdk(resolved.projectId, host).catch(() => []),
    // idem: sem a migração dos heatmaps (ou com falha), a coleta só fica desligada
    isHeatmapsEnabled(resolved.projectId).catch(() => false),
    getAnalyticsSettings(resolved.projectId).then((a) => a.enabled).catch(() => false),
  ]);
  const forHost = active.filter((s) => {
    const targets = (s.targetHosts as string[] | null) ?? [];
    return targets.length === 0 || (!!host && targets.includes(host));
  });
  return jsonCors(
    {
      surveys: forHost.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        appearance: normalizeAppearance(s.appearance),
        trigger: s.trigger,
        triggerEvent: s.triggerEvent, // [legado] evento único que dispara a survey
        triggerEvents: (s.triggerEvents as string[]) ?? [], // gatilhos por evento (dispara se QUALQUER um ocorrer)
        audience: s.audience, // "Todos os usuários" | "Usuários específicos"
        audienceMode: s.audienceMode, // "email" | "id" | null
        audienceList: (s.audienceList as string[]) ?? [], // emails/IDs alvo
        targetHosts: (s.targetHosts as string[]) ?? [], // plataformas onde pode aparecer ([] = todas)
        frequency: s.frequency,
      })),
      // estado do catálogo de eventos (desta plataforma, se `host` veio): diz ao SDK quando NÃO mandar POST /events
      events: eventCatalog,
      // diz ao SDK se ele precisa se apresentar (POST /events) para esta plataforma entrar no painel
      host: hostState,
      tours,
      // coleta de heatmaps ativa neste projeto: o SDK baixa sdk-heatmaps.js só se for true
      heatmaps: heatmaps,
      // coleta de analytics de produto ativa: o SDK baixa sdk-analytics.js só se for true
      analytics,
      // versão atual de sdk-tours.js / sdk-builder.js (o core pode estar em cache e ser mais velho)
      sdk: SDK_BUNDLE_VERSION,
    },
    { origin: allowOrigin, cache: CONFIG_CACHE }
  );
}
