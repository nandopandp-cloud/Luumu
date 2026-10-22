import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCurrentProject } from "@/lib/auth/current";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { searchProject } from "@/lib/db/search";
import { cleanQuery, MIN_QUERY, type SearchResults } from "@/lib/search/core";

export const dynamic = "force-dynamic";

/** GET /api/search?q= — busca do ⌘K no projeto ativo do usuário. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  // digitação gera várias buscas por segundo (com debounce); isto só barra abuso
  if (!(await checkRateLimit(`search:${session.userId}`, 90, 60))) {
    return NextResponse.json({ error: "Muitas buscas seguidas. Aguarde alguns segundos." }, { status: 429 });
  }

  const q = cleanQuery(new URL(req.url).searchParams.get("q"));
  const project = await getCurrentProject();
  const empty: SearchResults = { query: q, project: project ? { id: project.id, name: project.name } : null, surveys: [], tours: [], responses: [] };
  if (q.length < MIN_QUERY || !project) return NextResponse.json(empty, { headers: { "Cache-Control": "no-store" } });

  const hits = await searchProject(project.id, q);
  return NextResponse.json({ ...empty, ...hits } satisfies SearchResults, { headers: { "Cache-Control": "no-store" } });
}
