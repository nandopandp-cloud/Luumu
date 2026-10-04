import { resolveKey } from "@/lib/api/keys";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";
import { hostFromOrigin, normalizeHost } from "@/lib/db/hosts";
import { claimSnapshot, hasFreshSnapshot, isHeatmapsEnabled, saveSnapshot } from "@/lib/db/heatmaps";
import { gunzipSync } from "node:zlib";
import { HEATMAP_DEVICES, SNAPSHOT_MAX_BYTES, type HeatmapDevice } from "@/lib/heatmaps/core";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

async function context(req: Request) {
  const origin = req.headers.get("origin");
  const q = new URL(req.url).searchParams;
  const resolved = await resolveKey(q.get("key"));
  if (!resolved) return { error: jsonCors({ error: "SDK key inválida." }, { status: 401, origin }) };
  const allowOrigin = allowedOrigin(origin, resolved.domains);
  if (origin && allowOrigin === null) return { error: jsonCors({ error: "Origem não autorizada." }, { status: 403, origin: null }) };
  const path = (q.get("path") ?? "").slice(0, 200);
  const device = (HEATMAP_DEVICES as readonly string[]).includes(q.get("device") ?? "") ? (q.get("device") as HeatmapDevice) : "desktop";
  const host = hostFromOrigin(origin) || normalizeHost(q.get("host")) || "";
  if (!path) return { error: jsonCors({ error: "Página inválida." }, { status: 422, origin: allowOrigin }) };
  return { resolved, allowOrigin, path, device, host, q };
}

/**
 * GET /api/v1/heatmaps/snapshot?key&host&path&device — o SDK pergunta se precisa mandar a
 * cópia desta página. Só "sim" quando o heatmap está ativo e não há cópia dos últimos 7 dias:
 * evita que cada visitante envie a página inteira.
 */
export async function GET(req: Request) {
  const c = await context(req);
  if ("error" in c) return c.error;
  const on = await isHeatmapsEnabled(c.resolved.projectId);
  // só um navegador por página/dispositivo recebe "sim" a cada 10 min (reserva em memória)
  const need = on && !(await hasFreshSnapshot(c.resolved.projectId, c.host, c.path, c.device)) && claimSnapshot(c.resolved.projectId, c.host, c.path, c.device);
  return jsonCors({ need }, { origin: c.allowOrigin });
}

/**
 * POST (mesma query + w, h, vh) — corpo: o HTML da página, já sem scripts e com dados
 * pessoais mascarados pelo SDK. Aqui ainda removemos scripts e handlers (defesa em
 * profundidade: o painel exibe isto num iframe sem scripts, mas não confiamos no envio).
 */
export async function POST(req: Request) {
  const c = await context(req);
  if ("error" in c) return c.error;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  if (!(await checkRateLimit(`hms:${ip}:${c.resolved.projectId}`, 10, 600))) {
    return jsonCors({ error: "Muitas requisições." }, { status: 429, origin: c.allowOrigin });
  }
  if (!(await isHeatmapsEnabled(c.resolved.projectId))) return jsonCors({ ok: false }, { origin: c.allowOrigin });
  if (await hasFreshSnapshot(c.resolved.projectId, c.host, c.path, c.device)) return jsonCors({ ok: true, skipped: true }, { origin: c.allowOrigin });

  // o SDK atual manda gzip (?z=1): ~10x menos bytes trafegando
  let html = "";
  try {
    if (c.q.get("z") === "1") {
      const buf = Buffer.from(await req.arrayBuffer());
      if (buf.length > SNAPSHOT_MAX_BYTES) return jsonCors({ error: "Página grande demais." }, { status: 413, origin: c.allowOrigin });
      html = gunzipSync(buf, { maxOutputLength: SNAPSHOT_MAX_BYTES + 1 }).toString("utf8");
    } else html = await req.text();
  } catch {
    return jsonCors({ error: "Cópia inválida." }, { status: 400, origin: c.allowOrigin });
  }
  if (!html || html.length > SNAPSHOT_MAX_BYTES) return jsonCors({ error: "Página grande demais." }, { status: 413, origin: c.allowOrigin });
  const clean = html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  const n = (k: string, max: number) => Math.min(max, Math.max(0, Math.round(Number(c.q.get(k)) || 0)));
  await saveSnapshot({
    projectId: c.resolved.projectId,
    host: c.host,
    path: c.path,
    device: c.device,
    width: n("w", 10_000) || 1280,
    height: n("h", 200_000),
    viewportH: n("vh", 10_000),
    html: clean,
  });
  return jsonCors({ ok: true }, { origin: c.allowOrigin });
}
