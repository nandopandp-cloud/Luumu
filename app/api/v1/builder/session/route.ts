import { jsonCors, preflight } from "@/lib/api/cors";
import { getBuilderSession } from "@/lib/db/tours";
import { authorizeTourToken } from "@/lib/tours/builder-auth";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

/** GET /api/v1/builder/session?token&key — tour e passos do rascunho, para a barra do builder. */
export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  const sp = new URL(req.url).searchParams;
  const auth = await authorizeTourToken(sp.get("token"), sp.get("key"), origin, "builder");
  if (!auth.ok) return jsonCors({ error: auth.error }, { status: auth.status, origin });
  const session = await getBuilderSession(auth.data.tourId, auth.data.projectId);
  if (!session) return jsonCors({ error: "Tour não encontrado." }, { status: 404, origin });
  return jsonCors({ ...session, retargetStepKey: auth.data.stepKey ?? null }, { origin });
}
