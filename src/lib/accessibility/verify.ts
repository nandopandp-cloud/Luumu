import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/*
  Verificação de identidade do plugin de acessibilidade.

  O SDK roda no navegador: qualquer pessoa pode chamar Luumu.identify({ id: "123" }) com o ID
  de outro estudante. Para que só o próprio estudante leia as preferências dele (e saiba se
  está na lista de convidados), o backend do cliente assina o ID com o segredo do projeto e
  manda a assinatura no identify:

    user_hash = HMAC-SHA256(segredo, id)   (hex)
    Luumu.identify({ id: "123", user_hash: "…" })

  Com "exigir verificação" ligado no painel, chamadas sem assinatura válida são recusadas.
  É o mesmo desenho do "identity verification" de ferramentas como Intercom.
*/

export function newIdentitySecret(): string {
  return `a11y_${randomBytes(24).toString("base64url")}`;
}

export function userHashFor(secret: string, userKey: string): string {
  return createHmac("sha256", secret).update(userKey).digest("hex");
}

export function verifyUserHash(secret: string | null, userKey: string, hash: unknown): boolean {
  if (!secret || !userKey || typeof hash !== "string" || !/^[a-f0-9]{64}$/i.test(hash)) return false;
  const want = Buffer.from(userHashFor(secret, userKey), "hex");
  const got = Buffer.from(hash.toLowerCase(), "hex");
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Chave das preferências no banco: o ID não fica em claro (pseudonimização). */
export function prefsKey(projectId: string, userKey: string): string {
  return createHash("sha256").update(`${projectId}:${userKey}`).digest("hex");
}
