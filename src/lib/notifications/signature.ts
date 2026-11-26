import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/*
  Assinatura do webhook de atividades (cliente → Luumu). O mesmo formato que a Luumu já usa nos
  webhooks que ENVIA (lib/accessibility/webhook.ts), para o cliente reaproveitar o código:

    X-Luumu-Timestamp: segundos desde 1970 (UTC)
    X-Luumu-Signature: sha256=<hex de HMAC-SHA256(segredo, "<timestamp>.<corpo exato>")>

  O timestamp entra na conta e só vale por 5 minutos: uma requisição capturada não pode ser
  reenviada depois. Na troca do segredo, o anterior segue aceito por 24h.
*/

export const SIGNATURE_TOLERANCE_S = 300;

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export function signWebhookBody(secret: string, timestamp: number | string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export type SignatureCheck = "ok" | "missing" | "expired" | "invalid";

export const SIGNATURE_ERROR: Record<Exclude<SignatureCheck, "ok">, string> = {
  missing: "Faltam os cabeçalhos X-Luumu-Timestamp e X-Luumu-Signature.",
  expired: "X-Luumu-Timestamp fora da janela de 5 minutos: confira o relógio do servidor (e não reenvie a mesma assinatura numa nova tentativa).",
  invalid: "Assinatura não confere: confira o segredo e se a conta usa o corpo exato enviado.",
};

export function verifyWebhookSignature(
  secrets: string[],
  timestamp: string | null,
  signature: string | null,
  body: string,
  nowS = Math.floor(Date.now() / 1000)
): SignatureCheck {
  if (!timestamp || !signature) return "missing";
  if (!/^\d{9,11}$/.test(timestamp) || Math.abs(nowS - Number(timestamp)) > SIGNATURE_TOLERANCE_S) return "expired";
  const m = /^sha256=([a-f0-9]{64})$/i.exec(signature.trim());
  if (!m) return "invalid";
  const got = Buffer.from(m[1].toLowerCase(), "hex");
  for (const s of secrets) {
    const want = Buffer.from(signWebhookBody(s, timestamp, body).slice(7), "hex");
    if (want.length === got.length && timingSafeEqual(want, got)) return "ok";
  }
  return "invalid";
}
