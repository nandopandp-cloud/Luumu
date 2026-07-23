import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listEvents } from "@/lib/db/events";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/status
 * Rota INTERNA do painel (autenticada por sessão, não por SDK key).
 * Retorna os eventos já recebidos do workspace — usada no onboarding para
 * detectar ao vivo quando a instalação do SDK começa a enviar eventos.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const events = await listEvents(session.workspaceId);
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
