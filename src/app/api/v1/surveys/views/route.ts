import { z } from "zod";
import { getSurvey } from "@/lib/db/surveys";
import { recordSurveyView } from "@/lib/db/survey-views";
import { hostFromOrigin } from "@/lib/db/hosts";
import { isDeviceKind } from "@/lib/surveys/device";
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
  // gerado no navegador (svv_ + aleatório) e reenviado com a resposta
  viewId: z.string().regex(/^svv_[a-z0-9]{8,32}$/),
  respondent: z.string().max(200).nullish(),
  device: z.string().max(20).nullish(),
});

/**
 * POST /api/v1/surveys/views
 * Registra que o widget de uma pesquisa apareceu na tela. Mesmas validações de /responses:
 * key → projeto, pesquisa do projeto e ativa, CORS por origem e rate-limit por (ip + key).
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

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  const ok = await checkRateLimit(`svv:${ip}:${key}`, 60, 60);
  if (!ok) return jsonCors({ error: "Muitas requisições." }, { status: 429, origin: allowOrigin });

  const survey = await getSurvey(data.surveyId, { projectId: resolved.projectId });
  if (!survey || survey.status !== "ativa") {
    return jsonCors({ error: "Pesquisa indisponível." }, { status: 403, origin: allowOrigin });
  }

  const host = hostFromOrigin(origin);
  const targets = (survey.targetHosts as string[] | null) ?? [];
  if (targets.length > 0 && host && !targets.includes(host)) {
    return jsonCors({ error: "Pesquisa indisponível nesta plataforma." }, { status: 403, origin: allowOrigin });
  }

  await recordSurveyView({
    id: data.viewId,
    surveyId: data.surveyId,
    host: host || null,
    device: isDeviceKind(data.device) ? data.device : null,
    respondent: data.respondent ?? null,
  });

  return jsonCors({ ok: true }, { origin: allowOrigin });
}
