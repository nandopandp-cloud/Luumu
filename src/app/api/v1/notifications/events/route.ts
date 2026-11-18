import { z } from "zod";
import { resolveKey } from "@/lib/api/keys";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";
import { recordNotificationEvents } from "@/lib/db/notifications";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

const schema = z.object({
  key: z.string().max(200),
  // hash da chave do usuário (lib/notifications/model.ts → audienceHash); nunca o id/e-mail
  user: z.string().min(1).max(40),
  events: z
    .array(z.object({ id: z.string().min(1).max(40), kind: z.enum(["delivered", "seen", "click"]) }))
    .min(1)
    .max(60),
});

/**
 * POST /api/v1/notifications/events — métricas do sino (recebida, vista no painel, clicada), em
 * lote. O SDK manda cada (recado, tipo) uma vez por usuário e agrupa os envios; corpo em text/plain
 * para não ter preflight (mesmo motivo do /events). Só recados do projeto da key são gravados.
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

  const resolved = await resolveKey(parsed.data.key);
  if (!resolved) return jsonCors({ error: "SDK key inválida." }, { status: 401, origin });
  const allowOrigin = allowedOrigin(origin, resolved.domains);
  if (origin && allowOrigin === null) return jsonCors({ error: "Origem não autorizada." }, { status: 403, origin: null });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  if (!(await checkRateLimit(`ntf:${ip}:${parsed.data.key}`, 60, 60))) {
    return jsonCors({ error: "Muitas requisições." }, { status: 429, origin: allowOrigin });
  }

  const saved = await recordNotificationEvents(resolved.projectId, parsed.data.user, parsed.data.events).catch(() => 0);
  return jsonCors({ ok: true, saved }, { origin: allowOrigin });
}
