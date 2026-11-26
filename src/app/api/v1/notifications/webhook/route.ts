import { NextResponse } from "next/server";
import { resolveKey } from "@/lib/api/keys";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { applyActivityEvent, logRejectedDelivery, webhookSecrets } from "@/lib/db/notification-activities";
import { SIGNATURE_ERROR, verifyWebhookSignature } from "@/lib/notifications/signature";
import { eventsOf, MAX_BODY_BYTES, MAX_EVENTS_PER_REQUEST, parseEvent, type EventOutcome } from "@/lib/notifications/webhook";

export const dynamic = "force-dynamic";

/*
  POST /api/v1/notifications/webhook?key=pk_...

  Chamado pelo BACK-END do cliente (servidor para servidor; sem CORS) quando uma atividade é
  liberada, alterada ou cancelada. Contrato: docs/notifications/INTEGRACAO.md.

  - `key`: a chave pública do SDK do projeto (diz de qual projeto é o envio).
  - Assinatura: X-Luumu-Timestamp + X-Luumu-Signature (lib/notifications/signature.ts), com o
    segredo de Notificações → Avisos automáticos. Sem assinatura válida, nada é gravado.
  - Corpo: um evento, ou { "events": [...] } com até 100.

  Respostas:
    200 todos os eventos aceitos (aplicados, ignorados por serem mais antigos, ou repetidos)
    422 algum evento recusado: `results` diz qual e por quê (os outros do lote FORAM aplicados)
    400 JSON inválido · 401 chave ou assinatura · 413 corpo grande demais · 429 limite
    503 indisponível do lado da Luumu: tente de novo
  Só 5xx, 429 e falhas de rede pedem nova tentativa; 4xx é erro de integração.
*/

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || req.headers.get("x-luumu-key");
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return json({ ok: false, error: `Corpo maior que ${MAX_BODY_BYTES / 1024} KB: divida em lotes de até ${MAX_EVENTS_PER_REQUEST} eventos.` }, 413);

  const resolved = await resolveKey(key);
  if (!resolved) return json({ ok: false, error: "Chave do projeto inválida: use a chave pública do SDK (pk_...) no parâmetro ?key=." }, 401);
  // por projeto, não por IP: o back-end do cliente sai por poucos IPs. Folgado para a carga inicial.
  if (!(await checkRateLimit(`ntfwh:${resolved.projectId}`, 600, 60))) return json({ ok: false, error: "Muitas requisições: no máximo 600 por minuto. Tente de novo em instantes." }, 429);

  const body = await req.text();
  if (body.length > MAX_BODY_BYTES) return json({ ok: false, error: `Corpo maior que ${MAX_BODY_BYTES / 1024} KB: divida em lotes de até ${MAX_EVENTS_PER_REQUEST} eventos.` }, 413);

  let secrets: string[];
  try {
    secrets = await webhookSecrets(resolved.projectId);
  } catch {
    return json({ ok: false, error: "Avisos automáticos indisponíveis no momento. Tente de novo." }, 503);
  }
  if (!secrets.length) return json({ ok: false, error: "Este projeto ainda não tem segredo do webhook: gere em Notificações → Avisos automáticos, no painel da Luumu." }, 401);

  const check = verifyWebhookSignature(secrets, req.headers.get("x-luumu-timestamp"), req.headers.get("x-luumu-signature"), body);
  if (check !== "ok") {
    await logRejectedDelivery(resolved.projectId, { status: "unauthorized", error: SIGNATURE_ERROR[check] }).catch(() => {});
    return json({ ok: false, error: SIGNATURE_ERROR[check] }, 401);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return json({ ok: false, error: "JSON inválido." }, 400);
  }
  const raw = eventsOf(parsed);
  if (!raw) return json({ ok: false, error: `Formato não reconhecido: mande um evento, ou { "events": [...] } com 1 a ${MAX_EVENTS_PER_REQUEST} eventos.` }, 422);

  const results: { id: string | null; status: EventOutcome; error?: string }[] = [];
  try {
    // em ordem: dois eventos da mesma atividade no lote se aplicam na sequência em que vieram
    for (const item of raw) {
      const ev = parseEvent(item);
      if (!ev.ok) {
        await logRejectedDelivery(resolved.projectId, { status: "invalid", event: ev.event, eventId: ev.id, activityId: ev.activityId, error: ev.error }).catch(() => {});
        results.push({ id: ev.id, status: "invalid", error: ev.error });
        continue;
      }
      results.push({ id: ev.id, status: await applyActivityEvent(resolved.workspaceId, resolved.projectId, ev) });
    }
  } catch {
    // banco fora do ar no meio do lote: o reenvio é seguro (eventos já aplicados voltam como "duplicate")
    return json({ ok: false, error: "Falha ao gravar. Tente de novo: eventos já aplicados não são duplicados." }, 503);
  }
  const ok = results.every((r) => r.status !== "invalid");
  return json({ ok, results }, ok ? 200 : 422);
}
