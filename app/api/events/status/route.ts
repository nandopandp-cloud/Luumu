import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCurrentProject, canAccessProject } from "@/lib/auth/current";
import { listEvents } from "@/lib/db/events";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/status?projectId=...
 * Rota INTERNA do painel (autenticada por sessão, não por SDK key).
 * Retorna os eventos já detectados do projeto, usada no onboarding para
 * perceber ao vivo quando a instalação do SDK começa a enviar eventos.
 *
 * O `projectId` é uma dica do cliente para evitar re-resolver o projeto ativo (cookie +
 * escopo + SELECT projects) a cada poll. Não é credencial: `canAccessProject` confere que
 * o projeto está no escopo do usuário, então um id forjado é recusado, não obedecido.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const hinted = new URL(req.url).searchParams.get("projectId");
  let projectId: string | null = null;
  if (hinted && (await canAccessProject(hinted))) {
    projectId = hinted;
  } else {
    projectId = (await getCurrentProject())?.id ?? null;
  }
  if (!projectId) return NextResponse.json({ connected: false, total: 0, events: [] });

  const events = await listEvents(projectId);
  return NextResponse.json({
    connected: events.length > 0,
    total: events.length, // eventos distintos detectados
    events: events.map((e) => ({
      name: e.name,
      lastSeenAt: e.lastSeenAt,
    })),
  });
}
