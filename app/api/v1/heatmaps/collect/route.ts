import { resolveKey } from "@/lib/api/keys";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";
import { hostFromOrigin, normalizeHost } from "@/lib/db/hosts";
import { heatmapQuota, isHeatmapsEnabled, recordPageview } from "@/lib/db/heatmaps";
import { parsePageview } from "@/lib/heatmaps/core";

export const dynamic = "force-dynamic";

/** Uma visita cabe com folga nisto; acima, é payload adulterado. */
const MAX_BODY = 96 * 1024;

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

/**
 * POST /api/v1/heatmaps/collect — uma visita a uma página (enviada pelo SDK com sendBeacon ao
 * sair dela). Só grava se o projeto ativou os heatmaps e ainda tem sessões no plano do mês.
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
  const p = parsePageview(body);
  if (!p) return jsonCors({ error: "Payload inválido." }, { status: 422, origin });

  const resolved = await resolveKey(p.key);
  if (!resolved) return jsonCors({ error: "SDK key inválida." }, { status: 401, origin });
  const allowOrigin = allowedOrigin(origin, resolved.domains);
  if (origin && allowOrigin === null) return jsonCors({ error: "Origem não autorizada." }, { status: 403, origin: null });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  if (!(await checkRateLimit(`hm:${ip}:${p.key}`, 120, 60))) {
    return jsonCors({ error: "Muitas requisições." }, { status: 429, origin: allowOrigin });
  }

  if (!(await isHeatmapsEnabled(resolved.projectId))) return jsonCors({ ok: false, reason: "disabled" }, { origin: allowOrigin });
  const quota = await heatmapQuota(resolved.workspaceId);
  if (quota.limit !== Infinity && quota.used >= quota.limit) return jsonCors({ ok: false, reason: "quota" }, { origin: allowOrigin });

  // plataforma: vale o Origin posto pelo navegador; o que o SDK declarou só na falta dele
  const host = hostFromOrigin(origin) || normalizeHost(p.host) || "";
  await recordPageview(resolved.workspaceId, resolved.projectId, host, p);
  return jsonCors({ ok: true }, { origin: allowOrigin });
}
