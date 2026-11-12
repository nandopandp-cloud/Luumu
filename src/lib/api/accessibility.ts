import "server-only";
import { z } from "zod";
import { resolveKey } from "@/lib/api/keys";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { allowedOrigin, jsonCors } from "@/lib/api/cors";
import { getAccessibilityAuth } from "@/lib/db/accessibility";
import { inviteeKey, userKeyFrom } from "@/lib/accessibility/invitees";
import { verifyUserHash } from "@/lib/accessibility/verify";

/*
  Validação comum das rotas do plugin de acessibilidade chamadas pelo SDK com dados de UM
  estudante (/match, /prefs): key → projeto, CORS por origem, rate limit por IP + key, plugin
  ligado e, se o projeto exigir, a assinatura do ID (lib/accessibility/verify.ts).
*/

export const studentSchema = z.object({
  key: z.string().max(100),
  id: z.union([z.string().max(200), z.number()]).nullish(),
  email: z.string().max(200).nullish(),
  h: z.string().max(128).nullish(),
});

/** `verified`: o projeto exige verificação e a assinatura do `userKey` conferiu (só ele é confiável). */
type Ok<T> = { ok: true; data: T; projectId: string; userKey: string; keys: string[]; verified: boolean; origin: string | null; config: Awaited<ReturnType<typeof getAccessibilityAuth>>["config"] };
type Fail = { ok: false; res: Response };

export async function authorizeStudent<S extends typeof studentSchema>(req: Request, schema: S, limit: number, bucket: string): Promise<Ok<z.infer<S>> | Fail> {
  const origin = req.headers.get("origin");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, res: jsonCors({ error: "JSON inválido." }, { status: 400, origin }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, res: jsonCors({ error: "Payload inválido." }, { status: 422, origin }) };
  const data = parsed.data;

  const resolved = await resolveKey(data.key);
  if (!resolved) return { ok: false, res: jsonCors({ error: "SDK key inválida." }, { status: 401, origin }) };
  const allowOrigin = allowedOrigin(origin, resolved.domains);
  if (origin && allowOrigin === null) return { ok: false, res: jsonCors({ error: "Origem não autorizada." }, { status: 403, origin: null }) };

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  if (!(await checkRateLimit(`${bucket}:${ip}:${data.key}`, limit, 60))) {
    return { ok: false, res: jsonCors({ error: "Muitas requisições." }, { status: 429, origin: allowOrigin }) };
  }

  const auth = await getAccessibilityAuth(resolved.projectId).catch(() => null);
  // 503 em falha do banco: o SDK trata 404 como "desligado" e tiraria o plugin da página
  if (!auth) return { ok: false, res: jsonCors({ error: "Indisponível." }, { status: 503, origin: allowOrigin }) };
  if (!auth.enabled) return { ok: false, res: jsonCors({ error: "Plugin desligado." }, { status: 404, origin: allowOrigin }) };

  const userKey = userKeyFrom(data);
  if (!userKey) return { ok: false, res: jsonCors({ error: "Estudante não identificado." }, { status: 422, origin: allowOrigin }) };
  if (auth.requireVerified && !verifyUserHash(auth.secret, userKey, data.h)) {
    return { ok: false, res: jsonCors({ error: "Identidade não verificada." }, { status: 403, origin: allowOrigin }) };
  }
  const keys = [...new Set([inviteeKey(data.id), inviteeKey(data.email)].filter(Boolean))];
  return { ok: true, data, projectId: resolved.projectId, userKey, keys, verified: auth.requireVerified, origin: allowOrigin, config: auth.config };
}
