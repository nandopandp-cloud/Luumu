import { getSurveyWithQuestions } from "@/lib/db/surveys";
import { normalizeAppearance, type BuilderQuestion } from "@/lib/builder";
import { isWithinSchedule } from "@/lib/schedule";
import { resolveKey } from "@/lib/api/keys";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";

/*
  Sem `dynamic = "force-dynamic"`: ele anunciava `no-store` para a borda e anulava o
  `Cache-Control` definido abaixo, então o cache desta rota nunca chegou a valer.
*/

/*
  Cache de borda do conteúdo da pesquisa (perguntas + aparência).

  É o que o widget baixa toda vez que uma pesquisa vai aparecer para alguém: numa pesquisa
  que dispara bem, isso é uma invocação por exibição, todas devolvendo exatamente o mesmo
  JSON. Perguntas e aparência mudam quando alguém edita no painel, não a cada exibição.

  A janela é mais curta que a de /config porque esta resposta também carrega estado
  (status e vigência): 30s é o atraso máximo para uma pesquisa pausada parar de ser servida
  pela borda. Quem responde depois disso ainda é barrado na gravação — POST /responses
  revalida status e vigência no banco, sem cache, então uma pesquisa encerrada não recebe
  resposta mesmo que o widget tenha sido montado com um JSON de alguns segundos atrás.

  Só o caminho de sucesso é cacheado: as respostas de erro (401/403/404) continuam
  dinâmicas, para uma key revogada ou pesquisa despublicada não ficarem presas na borda.
*/
const SURVEY_CACHE = "public, s-maxage=30, stale-while-revalidate=120";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

/**
 * GET /api/v1/surveys/[id]?key=pk_...
 * Retorna a pesquisa (se pertencer ao workspace da key, estiver ativa e dentro da vigência)
 * com perguntas e aparência.
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
  const data = await getSurveyWithQuestions(id, { projectId: resolved.projectId });
  if (!data) return jsonCors({ error: "Pesquisa não encontrada." }, { status: 404, origin: allowOrigin });
  if (data.survey.status !== "ativa") {
    return jsonCors({ error: "Pesquisa não está ativa." }, { status: 403, origin: allowOrigin });
  }
  // /config já filtra por vigência, mas esta rota também é chamada por id direto (ex.: Luumu.show)
  if (!isWithinSchedule(data.survey.startsAt, data.survey.endsAt)) {
    return jsonCors({ error: "Pesquisa fora do período de vigência." }, { status: 403, origin: allowOrigin });
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
    { origin: allowOrigin, cache: SURVEY_CACHE }
  );
}
