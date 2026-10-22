import { NextResponse } from "next/server";

/**
 * Resolve o valor de Access-Control-Allow-Origin dado o Origin da requisição
 * e a allowlist de domínios da key. Sem allowlist → libera (modo dev/aberto).
 */
export function allowedOrigin(origin: string | null, domains: string[]): string | null {
  if (!domains || domains.length === 0) return origin || "*";
  if (!origin) return null;
  try {
    const host = new URL(origin).host;
    const ok = domains.some((d) => {
      const clean = d.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
      return host === clean || host.endsWith("." + clean);
    });
    return ok ? origin : null;
  } catch {
    return null;
  }
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

/**
 * Respostas cacheáveis usam `*` em vez de refletir o Origin.
 *
 * Refletir o Origin obriga a manter `Vary: Origin`, e aí a CDN guarda uma cópia por site
 * cliente: com muitos domínios o hit rate desaba e a borda volta a acordar a função. Como
 * o conteúdo destas rotas é idêntico para qualquer origem (a autorização é pela `key`, que
 * já faz parte da chave de cache via query string), `*` serve todo mundo com UMA entrada.
 *
 * Só vale para respostas sem credenciais — o SDK não manda cookie nestas chamadas.
 */
export function cacheableCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Origin": "*",
  };
}

/**
 * JSON com CORS resolvido para o origin permitido (ou sem header, se negado).
 *
 * `cache` aceita um valor de Cache-Control para a resposta. Sem ele a rota continua
 * dinâmica (nenhuma resposta do SDK era cacheável antes), então quem não passa nada
 * mantém exatamente o comportamento anterior.
 */
export function jsonCors(
  data: unknown,
  opts: { status?: number; origin?: string | null; cache?: string } = {}
) {
  // com `cache` a resposta vai para a borda, e aí ela não pode variar por origem
  const headers = opts.cache ? cacheableCorsHeaders() : corsHeaders(opts.origin ?? null);
  if (opts.cache) headers["Cache-Control"] = opts.cache;
  return NextResponse.json(data, {
    status: opts.status ?? 200,
    headers,
  });
}

/** Preflight OPTIONS, libera amplamente (a checagem real é no GET/POST). */
export function preflight(origin: string | null) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin || "*") });
}
