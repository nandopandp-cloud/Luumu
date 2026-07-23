import { revalidatePath } from "next/cache";
import { z } from "zod";
import { submitResponse } from "@/lib/db/responses";
import { getSurvey } from "@/lib/db/surveys";
import { deriveSentiment } from "@/lib/sentiment";
import { resolveKey } from "@/lib/api/keys";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

const schema = z.object({
  key: z.string().optional(),
  surveyId: z.string(),
  channel: z.string().optional(),
  answers: z.array(z.object({ questionId: z.string(), value: z.unknown() })),
  score: z.number().nullable(),
});

/**
 * POST /api/v1/responses
 * Grava uma resposta do widget. Valida key → workspace, pesquisa ∈ workspace e ativa,
 * aplica rate-limit por (ip + key) e CORS por origem.
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
  if (!parsed.success) {
    return jsonCors({ error: "Payload inválido." }, { status: 422, origin });
  }
  const data = parsed.data;

  const key = data.key ?? new URL(req.url).searchParams.get("key") ?? undefined;
  const resolved = await resolveKey(key ?? null);
  if (!resolved) return jsonCors({ error: "SDK key inválida." }, { status: 401, origin });

  const allowOrigin = allowedOrigin(origin, resolved.domains);
  if (origin && allowOrigin === null) {
    return jsonCors({ error: "Origem não autorizada." }, { status: 403, origin: null });
  }

  // rate limit por ip+key (60/min)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  const ok = await checkRateLimit(`res:${ip}:${key}`, 60, 60);
  if (!ok) return jsonCors({ error: "Muitas requisições." }, { status: 429, origin: allowOrigin });

  // a pesquisa precisa pertencer ao workspace da key e estar ativa
  const survey = await getSurvey(data.surveyId, resolved.workspaceId);
  if (!survey || survey.status !== "ativa") {
    return jsonCors({ error: "Pesquisa indisponível." }, { status: 403, origin: allowOrigin });
  }

  await submitResponse({
    surveyId: data.surveyId,
    channel: data.channel ?? "SDK",
    answers: data.answers as { questionId: string; value: unknown }[],
    score: data.score,
    sentiment: deriveSentiment(data.score),
  });

  revalidatePath("/responses");
  revalidatePath(`/surveys/${data.surveyId}/responses`);
  revalidatePath("/dashboard");

  return jsonCors({ ok: true }, { origin: allowOrigin });
}
