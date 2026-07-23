import { getSurveyWithQuestions } from "@/lib/db/surveys";
import { normalizeAppearance, type BuilderQuestion } from "@/lib/builder";
import { jsonCors, preflight } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

/**
 * GET /api/v1/surveys/[id]
 * Retorna a pesquisa (se ativa) com perguntas e aparência — consumido pelo SDK.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await getSurveyWithQuestions(id);
  if (!data) return jsonCors({ error: "Pesquisa não encontrada." }, { status: 404 });
  if (data.survey.status !== "ativa") {
    return jsonCors({ error: "Pesquisa não está ativa." }, { status: 403 });
  }

  const questions: BuilderQuestion[] = data.questions.map((q) => ({
    uid: q.id,
    blockId: q.blockId,
    title: q.title,
    required: q.required,
    config: (q.config as BuilderQuestion["config"]) ?? {},
    logic: (q.logic as BuilderQuestion["logic"]) ?? {},
  }));

  return jsonCors({
    id: data.survey.id,
    name: data.survey.name,
    type: data.survey.type,
    appearance: normalizeAppearance(data.survey.appearance),
    questions,
  });
}
