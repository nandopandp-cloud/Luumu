import { getSurveyWithQuestions } from "@/lib/db/surveys";
import { normalizeAppearance, type BuilderQuestion } from "@/lib/builder";
import { resolveKey } from "@/lib/api/keys";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

/**
 * GET /api/v1/surveys/[id]?key=pk_...
 * Retorna a pesquisa (se pertencer ao workspace da key e estiver ativa) com perguntas e aparência.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const origin = req.headers.get("origin");
  const { searchParams } = new URL(req.url);
  const { id } = await params;

  const resolved = await resolveKey(searchParams.get("key"));
  if (!resolved) return jsonCors({ error: "SDK key inválida." }, { status: 401, origin });

  const allowOrigin = allowedOrigin(origin, resolved.domains);
  if (origin && allowOrigin === null) {
    return jsonCors({ error: "Origem não autorizada." }, { status: 403, origin: null });
  }

  // exige que a pesquisa pertença ao workspace da key
  const data = await getSurveyWithQuestions(id, resolved.workspaceId);
  if (!data) return jsonCors({ error: "Pesquisa não encontrada." }, { status: 404, origin: allowOrigin });
  if (data.survey.status !== "ativa") {
    return jsonCors({ error: "Pesquisa não está ativa." }, { status: 403, origin: allowOrigin });
  }

  const questions: BuilderQuestion[] = data.questions.map((q) => ({
    uid: q.id,
    blockId: q.blockId,
    title: q.title,
    required: q.required,
    config: (q.config as BuilderQuestion["config"]) ?? {},
    logic: (q.logic as BuilderQuestion["logic"]) ?? {},
  }));

  return jsonCors(
    {
      id: data.survey.id,
      name: data.survey.name,
      type: data.survey.type,
      appearance: normalizeAppearance(data.survey.appearance),
      questions,
    },
    { origin: allowOrigin }
  );
}
