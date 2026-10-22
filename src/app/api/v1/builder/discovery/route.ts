import { z } from "zod";
import { jsonCors, preflight } from "@/lib/api/cors";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { recordDiscovery } from "@/lib/db/product-registry";
import { authorizeTourToken } from "@/lib/tours/builder-auth";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

const schema = z.object({
  token: z.string(),
  key: z.string(),
  route: z.string().max(500),
  title: z.string().max(300).optional(),
  elements: z.array(z.unknown()).max(300),
});

/**
 * POST /api/v1/builder/discovery — elementos que o Product Discovery Engine encontrou numa
 * rota, enviados pelo overlay do builder. Só com token de administrador.
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

  const auth = await authorizeTourToken(parsed.data.token, parsed.data.key, origin, "builder");
  if (!auth.ok) return jsonCors({ error: auth.error }, { status: auth.status, origin });
  if (!auth.host) return jsonCors({ error: "Origem desconhecida." }, { status: 422, origin });
  if (!(await checkRateLimit(`bld:${auth.data.userId}`, 60, 60))) {
    return jsonCors({ error: "Muitas requisições." }, { status: 429, origin });
  }

  const saved = await recordDiscovery({
    workspaceId: auth.data.workspaceId,
    projectId: auth.data.projectId,
    host: auth.host,
    route: parsed.data.route,
    title: parsed.data.title,
    elements: parsed.data.elements,
  });
  return jsonCors({ ok: true, saved }, { origin });
}
