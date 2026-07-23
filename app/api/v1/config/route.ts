import { listActiveSurveys } from "@/lib/db/surveys";
import { normalizeAppearance } from "@/lib/builder";
import { jsonCors, preflight } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

/**
 * GET /api/v1/config?key=pk_...
 * Retorna as pesquisas ativas do workspace (nesta fase, workspace único).
 * O SDK usa isto para saber o que exibir no produto do cliente.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key || !key.startsWith("pk_")) {
    return jsonCors({ error: "SDK key inválida ou ausente." }, { status: 401 });
  }

  const active = await listActiveSurveys();
  return jsonCors({
    surveys: active.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      appearance: normalizeAppearance(s.appearance),
      trigger: s.trigger,
      frequency: s.frequency,
    })),
  });
}
