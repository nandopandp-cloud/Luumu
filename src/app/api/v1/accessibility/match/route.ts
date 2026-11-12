import { z } from "zod";
import { findInvitee, recordInviteeEvent } from "@/lib/db/accessibility";
import { authorizeStudent, studentSchema } from "@/lib/api/accessibility";
import { jsonCors, preflight } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

const schema = studentSchema.extend({
  // desfecho do convite (o painel mostra quem viu, aceitou ou dispensou)
  event: z.enum(["shown", "accepted", "dismissed"]).nullish(),
});

/**
 * POST /api/v1/accessibility/match
 * O estudante logado está na lista de convidados? Responde só sobre o PRÓPRIO id/e-mail
 * enviado — a lista é dado sensível e nunca sai no /config. Com `event`, registra o desfecho
 * do convite para esse estudante. Com "exigir verificação" ligado, pede o user_hash.
 * Rate limit por IP + key contém varredura de identificadores. Nunca cacheada na borda.
 */
export async function POST(req: Request) {
  const a = await authorizeStudent(req, schema, 30, "a11y-match");
  if (!a.ok) return a.res;
  const invitee = await findInvitee(a.projectId, a.keys);
  if (invitee && a.data.event) await recordInviteeEvent(a.projectId, invitee.key, a.data.event);
  return jsonCors({ match: !!invitee, profile: invitee?.profile ?? null }, { origin: a.origin });
}
