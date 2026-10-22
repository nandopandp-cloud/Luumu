import { resolveKey } from "@/lib/api/keys";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";
import { getPublishedTourPayload } from "@/lib/db/tours";

/*
  Cache de borda dos passos publicados. Como /surveys/[id]: o conteúdo muda quando alguém
  publica no painel, não a cada exibição, e o runtime manda `?v=<versão>` — uma publicação
  nova muda a URL, então o cache nunca serve uma versão velha para quem já sabe da nova.
*/
const TOUR_CACHE = "public, s-maxage=60, stale-while-revalidate=300";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

/** GET /api/v1/tours/[id]?key=pk_...&v=3 — passos da versão publicada do tour. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  const { id } = await params;
  const resolved = await resolveKey(new URL(req.url).searchParams.get("key"));
  if (!resolved) return jsonCors({ error: "SDK key inválida." }, { status: 401, origin });
  const allowOrigin = allowedOrigin(origin, resolved.domains);
  if (origin && allowOrigin === null) return jsonCors({ error: "Origem não autorizada." }, { status: 403, origin: null });

  const tour = await getPublishedTourPayload(id, resolved.projectId);
  if (!tour) return jsonCors({ error: "Tour não encontrado." }, { status: 404, origin: allowOrigin });
  return jsonCors(tour, { origin: allowOrigin, cache: TOUR_CACHE });
}
