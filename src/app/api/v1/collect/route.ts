import { resolveKey } from "@/lib/api/keys";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";
import { hostFromOrigin, normalizeHost } from "@/lib/db/hosts";
import { getAnalyticsSettings, recordAnalytics } from "@/lib/db/analytics";
import { heatmapQuota, isHeatmapsEnabled, pageviewsInsert, recordPageviews } from "@/lib/db/heatmaps";
import { parseAnalytics } from "@/lib/analytics/core";
import { parsePageview } from "@/lib/heatmaps/core";

export const dynamic = "force-dynamic";

/** sendBeacon aceita ~64 KB; acima disso é payload adulterado */
const MAX_BODY = 66 * 1024;
const MAX_VISITS = 30;

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

/**
 * POST /api/v1/collect — envio ÚNICO do SDK ao sair da página: { key, host, a?, h? }
 *   a = telas/eventos da visita (Analytics), h = visitas com cliques/movimento (Heatmaps).
 * Um request por saída de página em vez de um por tela + um por módulo. Cada parte só é
 * gravada se o recurso estiver ativo no projeto (configurações em cache por instância).
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return jsonCors({ error: "Payload inválido." }, { status: 413, origin });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonCors({ error: "JSON inválido." }, { status: 400, origin });
  }
  const key = typeof body.key === "string" ? body.key : null;
  const resolved = await resolveKey(key);
  if (!resolved || !key) return jsonCors({ error: "SDK key inválida." }, { status: 401, origin });
  const allowOrigin = allowedOrigin(origin, resolved.domains);
  if (origin && allowOrigin === null) return jsonCors({ error: "Origem não autorizada." }, { status: 403, origin: null });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  if (!(await checkRateLimit(`col:${ip}:${key}`, 120, 60))) return jsonCors({ error: "Muitas requisições." }, { status: 429, origin: allowOrigin });

  const host = hostFromOrigin(origin) || normalizeHost(typeof body.host === "string" ? body.host : "") || "";
  const a = body.a && typeof body.a === "object" ? parseAnalytics({ ...(body.a as object), key }) : null;
  const visits = (Array.isArray(body.h) ? body.h.slice(0, MAX_VISITS) : [])
    .map((v) => (v && typeof v === "object" ? parsePageview({ ...(v as object), key, host }) : null))
    .filter((v): v is NonNullable<typeof v> => !!v);

  // o que vale gravar (configurações e cota em cache por instância: sem ida ao banco no caso comum)
  const [analyticsOn, heatmapOk] = await Promise.all([
    a ? getAnalyticsSettings(resolved.projectId).then((s) => s.enabled).catch(() => false) : false,
    visits.length ? heatmapAllowed(resolved.workspaceId, resolved.projectId).catch(() => false) : false,
  ]);
  const { workspaceId, projectId } = resolved;

  /*
    Uma ida ao banco por envio: as telas de heatmap entram no lote do Analytics. Se o lote
    conjunto falhar, grava cada parte sozinha — um problema numa não derruba a outra.
  */
  const tasks: Promise<unknown>[] = [];
  if (a && analyticsOn && heatmapOk) {
    tasks.push(
      recordAnalytics(workspaceId, projectId, host, a, [pageviewsInsert(workspaceId, projectId, host, visits)]).catch(async (e) => {
        console.error("[collect] lote conjunto, gravando separado", e);
        const r = await Promise.allSettled([recordAnalytics(workspaceId, projectId, host, a), recordPageviews(workspaceId, projectId, host, visits)]);
        const bad = r.find((x) => x.status === "rejected");
        if (bad) throw (bad as PromiseRejectedResult).reason;
      })
    );
  } else {
    if (a && analyticsOn) tasks.push(recordAnalytics(workspaceId, projectId, host, a));
    if (heatmapOk) tasks.push(recordPageviews(workspaceId, projectId, host, visits));
  }

  const results = await Promise.allSettled(tasks);
  const failed = results.find((r) => r.status === "rejected");
  if (failed) console.error("[collect]", (failed as PromiseRejectedResult).reason);
  return jsonCors({ ok: !failed }, { origin: allowOrigin });
}

/** Heatmaps ligados no projeto e dentro da cota do plano. */
async function heatmapAllowed(workspaceId: string, projectId: string) {
  if (!(await isHeatmapsEnabled(projectId))) return false;
  const quota = await heatmapQuota(workspaceId);
  return quota.limit === Infinity || quota.used < quota.limit;
}
