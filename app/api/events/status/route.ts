import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCurrentProject } from "@/lib/auth/current";
import { listEvents } from "@/lib/db/events";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/status
 * Rota INTERNA do painel (autenticada por sessão, não por SDK key).
 * Retorna os eventos já recebidos do projeto ativo, usada no onboarding para
 * detectar ao vivo quando a instalação do SDK começa a enviar eventos.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const project = await getCurrentProject();
  if (!project) return NextResponse.json({ connected: false, total: 0, events: [] });
  const events = await listEvents(project.id);
  return NextResponse.json({
    connected: events.length > 0,
    total: events.reduce((s, e) => s + e.count, 0),
    events: events.map((e) => ({
      name: e.name,
      count: e.count,
      lastSeenAt: e.lastSeenAt,
    })),
  });
}
