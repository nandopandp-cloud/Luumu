import { listActiveSurveys } from "@/lib/db/surveys";
import { normalizeAppearance } from "@/lib/builder";
import { resolveKey } from "@/lib/api/keys";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

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

  const active = await listActiveSurveys(resolved.workspaceId);
  return jsonCors(
    {
      surveys: active.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        appearance: normalizeAppearance(s.appearance),
        trigger: s.trigger,
        frequency: s.frequency,
      })),
    },
    { origin: allowOrigin }
  );
}
