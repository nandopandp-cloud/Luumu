import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getWorkspaceUsageCached } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";

/**
 * GET /api/usage — uso do plano da WORKSPACE da sessão (todos os projetos): respostas no mês
 * e pesquisas ativas vs. limites. Alimenta os medidores do header e o card da sidebar, que
 * recarregam ao navegar e ao voltar para a aba.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  // memória por instância compartilhada com o layout: várias abas/pessoas da workspace não refazem as contagens
  const usage = await getWorkspaceUsageCached(session.workspaceId);
  // Infinity não existe em JSON: limite ilimitado vira null
  const lim = (n: number) => (n === Infinity ? null : n);
  return NextResponse.json(
    {
      ...usage,
      limits: {
        responses: lim(usage.limits.responses),
        activeSurveys: lim(usage.limits.activeSurveys),
        members: lim(usage.limits.members),
        events: lim(usage.limits.events),
      },
    },
    { headers: { "Cache-Control": "private, max-age=60" } }
  );
}
