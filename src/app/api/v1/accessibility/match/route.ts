import { z } from "zod";
import { getAccessibilitySettings } from "@/lib/db/accessibility";
import { matchesStudentList } from "@/lib/accessibility/audience";
import { resolveKey } from "@/lib/api/keys";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

const schema = z.object({
  key: z.string().max(100),
  id: z.union([z.string().max(200), z.number()]).nullish(),
  email: z.string().max(200).nullish(),
});

/**
 * POST /api/v1/accessibility/match
 * O estudante logado está na lista individual do convite de acessibilidade?
 *
 * Existe para a lista NÃO sair no /config público (é dado sensível: diz que uma pessoa
 * identificada tem uma necessidade de acessibilidade). O SDK só chama quando o convite está
 * ligado, a lista existe e o estudante não caiu em nenhum grupo; guarda a resposta por 12h.
 *
 * A resposta não diz nada além de sim/não para o PRÓPRIO id/e-mail enviado, e o rate limit
 * por IP + key contém varredura de identificadores. Nunca é cacheada na borda (depende do
 * corpo e não pode ficar em cache compartilhado).
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

  const resolved = await resolveKey(parsed.data.key);
  if (!resolved) return jsonCors({ error: "SDK key inválida." }, { status: 401, origin });
  const allowOrigin = allowedOrigin(origin, resolved.domains);
  if (origin && allowOrigin === null) return jsonCors({ error: "Origem não autorizada." }, { status: 403, origin: null });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  if (!(await checkRateLimit(`a11y:${ip}:${parsed.data.key}`, 20, 60))) {
    return jsonCors({ error: "Muitas requisições." }, { status: 429, origin: allowOrigin });
  }

  const settings = await getAccessibilitySettings(resolved.projectId).catch(() => null);
  const nudge = settings?.enabled ? settings.config.nudge : null;
  const match = !!nudge?.enabled && nudge.audience === "targeted" && matchesStudentList(nudge.students, parsed.data);
  return jsonCors({ match }, { origin: allowOrigin });
}
