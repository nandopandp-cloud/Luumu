import { resolveKey } from "@/lib/api/keys";
import { allowedOrigin, jsonCors, preflight } from "@/lib/api/cors";
import { getBellSettings } from "@/lib/db/notifications";
import { feedForClass } from "@/lib/db/notification-activities";
import { classKey } from "@/lib/notifications/activities";

/*
  Sem `force-dynamic` de propósito (mesmo motivo do /config): ele anularia o Cache-Control.

  GET /api/v1/notifications/feed?key=pk_...&c=<turma>
  Atividades em aberto de UMA turma, para o sino dos estudantes dela. A resposta é a mesma para a
  turma toda e não tem dado de estudante (título, matéria, link, datas), então fica na CDN: a sala
  inteira lê uma cópia, e a função acorda no máximo uma vez a cada 2 minutos por turma.
  Desligado no painel (sino ou avisos automáticos) = lista vazia.
*/
const FEED_CACHE = "public, s-maxage=120, stale-while-revalidate=600";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  const { searchParams } = new URL(req.url);
  const resolved = await resolveKey(searchParams.get("key"));
  if (!resolved) return jsonCors({ error: "SDK key inválida." }, { status: 401, origin });
  const allowOrigin = allowedOrigin(origin, resolved.domains);
  if (origin && allowOrigin === null) return jsonCors({ error: "Origem não autorizada." }, { status: 403, origin });

  const classId = classKey(searchParams.get("c"));
  if (!classId) return jsonCors({ error: "Turma inválida." }, { status: 422, origin: allowOrigin });

  const settings = await getBellSettings(resolved.projectId);
  const on = !!settings?.enabled && settings.auto.enabled;
  const items = on ? await feedForClass(resolved.projectId, classId).catch(() => null) : [];
  // falha do banco: sem cache, para a turma não ficar 2 minutos com a lista vazia
  if (items === null) return jsonCors({ error: "Indisponível." }, { status: 503, origin: allowOrigin });
  return jsonCors({ items }, { origin: allowOrigin, cache: FEED_CACHE });
}
