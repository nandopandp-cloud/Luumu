import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { authorizeStudent, studentSchema } from "@/lib/api/accessibility";
import { getAccessibilityAuth } from "@/lib/db/accessibility";
import { jsonCors, preflight } from "@/lib/api/cors";
import { deliverWebhook } from "@/lib/accessibility/webhook";
import { EVENT_TYPES, type A11yEvent } from "@/lib/accessibility/integration";
import { isProfileId, normalizePrefs } from "@/lib/accessibility/features";

export const dynamic = "force-dynamic";
// as tentativas do webhook (até ~25 s) rodam depois da resposta, com after()
export const maxDuration = 30;

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

const schema = studentSchema.extend({
  event: z.enum(EVENT_TYPES),
  eventId: z.string().max(64).nullish(),
  occurredAt: z.string().max(40).nullish(),
  host: z.string().max(253).nullish(),
  prefs: z.record(z.string(), z.unknown()),
  changes: z.array(z.object({ field: z.string().max(40), from: z.unknown(), to: z.unknown() })).max(40).nullish(),
  invite: z.object({ status: z.enum(["pending", "shown", "accepted", "dismissed"]), profiles: z.array(z.string()).max(8) }).nullish(),
});

/**
 * POST /api/v1/accessibility/events
 * Repasse, em tempo real, de um evento do plugin (mudança de configuração ou desfecho do
 * convite) para o webhook da plataforma externa. Nada é guardado na Luumu: a resposta sai na
 * hora (202) e a entrega — assinada, com novas tentativas — roda depois (after()).
 * Mesmas regras das outras rotas do plugin: key, CORS, limite por IP + key e, se exigida, a
 * verificação de identidade.
 */
export async function POST(req: Request) {
  const a = await authorizeStudent(req, schema, 120, "a11y-events");
  if (!a.ok) return a.res;
  const auth = await getAccessibilityAuth(a.projectId);
  const url = auth.config.integration.webhookUrl;
  if (!url || !auth.secret) return jsonCors({ ok: true, delivered: false }, { status: 202, origin: a.origin });

  const d = a.data;
  const prefs = normalizePrefs(d.prefs);
  const event: A11yEvent = {
    event: d.event,
    id: d.eventId && /^[\w-]{8,64}$/.test(d.eventId) ? d.eventId : randomUUID(),
    occurredAt: d.occurredAt && !Number.isNaN(Date.parse(d.occurredAt)) ? new Date(d.occurredAt).toISOString() : new Date().toISOString(),
    user: { id: d.id == null ? null : String(d.id), email: d.email ?? null },
    host: d.host ?? "",
    prefs,
    activeProfiles: prefs.profiles,
    changes: d.changes ?? [],
    invite: d.invite ? { status: d.invite.status, profiles: d.invite.profiles.filter(isProfileId) } : null,
  };
  const secret = auth.secret;
  after(() => deliverWebhook(url, secret, event).then(() => undefined));
  return jsonCors({ ok: true, delivered: "queued", id: event.id }, { status: 202, origin: a.origin });
}
