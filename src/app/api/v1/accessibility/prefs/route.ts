import { z } from "zod";
import { getUserPrefs, saveUserPrefs } from "@/lib/db/accessibility";
import { authorizeStudent, studentSchema } from "@/lib/api/accessibility";
import { jsonCors, preflight } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

const schema = studentSchema.extend({
  op: z.enum(["get", "set"]),
  prefs: z.record(z.string(), z.unknown()).nullish(),
  t: z.number().int().nonnegative().nullish(),
});

/**
 * POST /api/v1/accessibility/prefs
 * Preferências de acessibilidade do estudante logado, para valerem em qualquer aparelho.
 *  - op "get": { prefs, t } ou { prefs: null } se ele ainda não escolheu nada;
 *  - op "set": grava (a mais recente vence; ver saveUserPrefs).
 * POST também na leitura: o ID do estudante não vai para a URL (logs, cache de borda).
 * Com "exigir verificação" ligado, só o próprio estudante (user_hash válido) lê e grava.
 */
export async function POST(req: Request) {
  const a = await authorizeStudent(req, schema, 60, "a11y-prefs");
  if (!a.ok) return a.res;
  if (a.data.op === "get") {
    const saved = await getUserPrefs(a.projectId, a.userKey);
    return jsonCors(saved ?? { prefs: null }, { origin: a.origin });
  }
  if (!a.data.prefs) return jsonCors({ error: "Sem preferências." }, { status: 422, origin: a.origin });
  const t = await saveUserPrefs(a.projectId, a.userKey, a.data.prefs, a.data.t ?? Date.now());
  return jsonCors({ ok: true, t }, { origin: a.origin });
}
