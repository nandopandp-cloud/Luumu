import { z } from "zod";
import { resolveKey } from "@/lib/api/keys";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";
import { hostFromOrigin } from "@/lib/db/hosts";
import { recordTourEvents } from "@/lib/db/tour-events";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

const schema = z.object({
  key: z.string().optional(),
  events: z.array(z.unknown()).min(1).max(50),
});

/**
 * POST /api/v1/tours/events — eventos de execução em lote (o runtime agrupa e manda via
 * fetch keepalive ou sendBeacon). Corpo em text/plain pelo mesmo motivo do /events: sem
 * preflight. Só tours do projeto da key são gravados.
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
  if (!parsed.success) return jsonCors({ error: "Payload inválido." }, { status: 422, origin });

  const key = parsed.data.key ?? null;
  const resolved = await resolveKey(key);
  if (!resolved) return jsonCors({ error: "SDK key inválida." }, { status: 401, origin });
  const allowOrigin = allowedOrigin(origin, resolved.domains);
  if (origin && allowOrigin === null) return jsonCors({ error: "Origem não autorizada." }, { status: 403, origin: null });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  if (!(await checkRateLimit(`tev:${ip}:${key}`, 120, 60))) {
    return jsonCors({ error: "Muitas requisições." }, { status: 429, origin: allowOrigin });
  }

  const saved = await recordTourEvents(resolved.workspaceId, resolved.projectId, hostFromOrigin(origin), parsed.data.events);
  return jsonCors({ ok: true, saved }, { origin: allowOrigin });
}
