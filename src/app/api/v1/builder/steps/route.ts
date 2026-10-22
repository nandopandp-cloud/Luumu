import { z } from "zod";
import { jsonCors, preflight } from "@/lib/api/cors";
import { appendDraftStep, retargetDraftStep } from "@/lib/db/tours";
import { authorizeTourToken } from "@/lib/tours/builder-auth";
import { defaultStep } from "@/lib/tours/defaults";
import { normalizeTarget } from "@/lib/tours/normalize";
import { STEP_TYPES } from "@/lib/tours/types";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

const schema = z.object({
  token: z.string(),
  key: z.string(),
  action: z.enum(["add", "retarget"]),
  target: z.unknown(),
  route: z.string().max(500).optional(),
  stepKey: z.string().max(60).optional(),
  type: z.enum(STEP_TYPES).optional(),
  title: z.string().max(120).optional(),
  body: z.string().max(600).optional(),
});

/**
 * POST /api/v1/builder/steps — o administrador escolheu um elemento no próprio produto:
 * adiciona um passo ao RASCUNHO (action=add) ou troca o alvo de um passo (action=retarget).
 * Nada vai ao ar sem "Publicar" no painel.
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
  if (!parsed.success) return jsonCors({ error: "Payload inválido." }, { status: 422, origin });
  const d = parsed.data;

  const auth = await authorizeTourToken(d.token, d.key, origin, "builder");
  if (!auth.ok) return jsonCors({ error: auth.error }, { status: auth.status, origin });
  const target = normalizeTarget(d.target);
  if (!target) return jsonCors({ error: "Elemento inválido." }, { status: 422, origin });

  if (d.action === "retarget") {
    const key = d.stepKey ?? auth.data.stepKey;
    if (!key) return jsonCors({ error: "Passo não informado." }, { status: 422, origin });
    const step = await retargetDraftStep(auth.data.tourId, auth.data.projectId, key, target, d.route);
    if (!step) return jsonCors({ error: "Passo não encontrado." }, { status: 404, origin });
    return jsonCors({ ok: true, step }, { origin });
  }

  const type = d.type && d.type !== "modal" ? d.type : "tooltip";
  const base = defaultStep(type);
  const step = await appendDraftStep(auth.data.tourId, auth.data.projectId, {
    ...base,
    title: d.title?.trim() || target.label || base.title,
    body: d.body ?? base.body,
    target,
    route: d.route ?? null,
  });
  if (!step) return jsonCors({ error: "Tour não encontrado." }, { status: 404, origin });
  return jsonCors({ ok: true, step }, { origin });
}
