import { listActiveSurveysForSdk } from "@/lib/db/surveys";
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
 * GET /api/v1/config?key=pk_...
 * Resolve o workspace pela SDK key e retorna as pesquisas ativas DAQUELE workspace.
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
    return jsonCors({ error: "Origem não autorizada." }, { status: 403, origin: null });
  }

  const active = await listActiveSurveysForSdk(resolved.projectId);
  return jsonCors(
    {
      surveys: active.map((s) => ({
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
        frequency: s.frequency,
      })),
    },
    { origin: allowOrigin, cache: CONFIG_CACHE }
  );
}
