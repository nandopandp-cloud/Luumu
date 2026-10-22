import { jsonCors, preflight } from "@/lib/api/cors";
import { getDraftTourPayload } from "@/lib/db/tours";
import { authorizeTourToken } from "@/lib/tours/builder-auth";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

/**
 * GET /api/v1/tours/preview?token=...&key=pk_...
 * Rascunho do tour para o "Preview no produto". Sem cache: o administrador acabou de editar.
 */
export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  const sp = new URL(req.url).searchParams;
  const auth = await authorizeTourToken(sp.get("token"), sp.get("key"), origin, "preview");
  if (!auth.ok) return jsonCors({ error: auth.error }, { status: auth.status, origin });
  const tour = await getDraftTourPayload(auth.data.tourId, auth.data.projectId);
  if (!tour) return jsonCors({ error: "Tour não encontrado." }, { status: 404, origin });
  return jsonCors({ ...tour, startAt: auth.data.stepKey ?? null }, { origin });
}
