import { z } from "zod";
import { recordEvent } from "@/lib/db/events";
import { resolveKey } from "@/lib/api/keys";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

const schema = z.object({
  key: z.string().optional(),
  event: z.string().min(1).max(64),
});

/**
 * POST /api/v1/events
 * Ingere um evento rastreado pelo SDK no produto do cliente (luumu.track).
 * Valida a key → workspace, aplica CORS por origem e rate-limit por (ip + key).
 * A resposta indica se algum evento novo foi registrado (para telemetria do SDK).
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonCors({ error: "JSON inválido." }, { status: 400, origin });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonCors({ error: "Payload inválido." }, { status: 422, origin });
  }

  const key = parsed.data.key ?? new URL(req.url).searchParams.get("key") ?? undefined;
  const resolved = await resolveKey(key ?? null);
  if (!resolved) return jsonCors({ error: "SDK key inválida." }, { status: 401, origin });

  const allowOrigin = allowedOrigin(origin, resolved.domains);
  if (origin && allowOrigin === null) {
    return jsonCors({ error: "Origem não autorizada." }, { status: 403, origin: null });
  }

  // rate limit por ip+key (mais permissivo que respostas: eventos são frequentes)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  const ok = await checkRateLimit(`evt:${ip}:${key}`, 240, 60);
  if (!ok) return jsonCors({ error: "Muitas requisições." }, { status: 429, origin: allowOrigin });

  const name = await recordEvent(resolved.workspaceId, parsed.data.event);
  return jsonCors({ ok: true, event: name }, { origin: allowOrigin });
}
