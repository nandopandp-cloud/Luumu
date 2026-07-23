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

/** JSON com CORS resolvido para o origin permitido (ou sem header, se negado). */
export function jsonCors(data: unknown, opts: { status?: number; origin?: string | null } = {}) {
  return NextResponse.json(data, {
    status: opts.status ?? 200,
    headers: corsHeaders(opts.origin ?? null),
  });
}

/** Preflight OPTIONS — libera amplamente (a checagem real é no GET/POST). */
export function preflight(origin: string | null) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin || "*") });
}
