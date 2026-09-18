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
  return NextResponse.json(
    {
      connected: events.length > 0,
      total: events.length, // eventos distintos detectados
      events: events.map((e) => ({
        name: e.name,
        lastSeenAt: e.lastSeenAt,
      })),
    },
    {
      /*
        `private` porque a resposta é do projeto ativo DAQUELE usuário: só o navegador dele
        pode guardar, nunca a CDN compartilhada.

        Os 10s existem para o caso que o polling sozinho não cobre: a mesma aba voltando ao
        foco (`visibilitychange` dispara um tick imediato), duas telas do painel montadas
        juntas, ou uma navegação que remonta o componente. Sem isso, cada um desses vira uma
        invocação completa — sessão + escopo + projeto + SELECT de eventos — para devolver um
        catálogo que muda quando alguém instala o SDK, não a cada segundo.

        A janela é curta de propósito: o valor da tela é perceber o primeiro evento chegando,
        e 10s de atraso máximo não muda a sensação de "detectou na hora".
      */
      headers: { "Cache-Control": "private, max-age=10" },
    }
  );
}
