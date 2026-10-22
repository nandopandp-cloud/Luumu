import { resolveKey } from "@/lib/api/keys";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";
import { hostFromOrigin, normalizeHost } from "@/lib/db/hosts";
import { getAnalyticsSettings, recordAnalytics } from "@/lib/db/analytics";
import { parseAnalytics } from "@/lib/analytics/core";

export const dynamic = "force-dynamic";

const MAX_BODY = 48 * 1024;

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

/**
 * POST /api/v1/analytics/collect — as telas visitadas num carregamento de página (enviadas
 * pelo SDK com sendBeacon ao sair). Só grava se o projeto ativou o Analytics.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return jsonCors({ error: "Payload inválido." }, { status: 413, origin });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonCors({ error: "JSON inválido." }, { status: 400, origin });
  }
  const p = parseAnalytics(body);
  if (!p) return jsonCors({ error: "Payload inválido." }, { status: 422, origin });

  const resolved = await resolveKey(p.key);
  if (!resolved) return jsonCors({ error: "SDK key inválida." }, { status: 401, origin });
  const allowOrigin = allowedOrigin(origin, resolved.domains);
  if (origin && allowOrigin === null) return jsonCors({ error: "Origem não autorizada." }, { status: 403, origin: null });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  if (!(await checkRateLimit(`an:${ip}:${p.key}`, 120, 60))) return jsonCors({ error: "Muitas requisições." }, { status: 429, origin: allowOrigin });

  if (!(await getAnalyticsSettings(resolved.projectId)).enabled) return jsonCors({ ok: false, reason: "disabled" }, { origin: allowOrigin });

  const host = hostFromOrigin(origin) || normalizeHost(p.host) || "";
  await recordAnalytics(resolved.workspaceId, resolved.projectId, host, p);
  return jsonCors({ ok: true }, { origin: allowOrigin });
}
