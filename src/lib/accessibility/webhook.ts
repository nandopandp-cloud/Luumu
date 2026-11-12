import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import type { A11yEvent } from "./integration";

/*
  Webhook do plugin de acessibilidade: a Luumu repassa cada evento do plugin para a URL da
  plataforma externa (painel → Ativação → Integração). Nada é guardado na Luumu.

  Assinatura (para a plataforma externa conferir que veio da Luumu e não foi alterado):
    X-Luumu-Timestamp: segundos desde 1970
    X-Luumu-Signature: sha256=<hex de HMAC-SHA256(segredo do projeto, "<timestamp>.<corpo>")>
  O segredo é o mesmo da verificação de identidade (painel → Ativação). Recusar timestamps com
  mais de 5 minutos evita reenvio de eventos antigos.

  Entrega: até 3 tentativas (na hora, +1 s, +4 s), 5 s de espera cada; 2xx = entregue.
*/

export function signWebhook(secret: string, timestamp: number, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export interface DeliveryResult {
  ok: boolean;
  status: number | null;
  attempts: number;
  error?: string;
}

export async function deliverWebhook(url: string, secret: string, event: A11yEvent, maxAttempts = 3): Promise<DeliveryResult> {
  const body = JSON.stringify(event);
  const waits = [0, 1000, 4000];
  let last: DeliveryResult = { ok: false, status: null, attempts: 0 };
  for (let i = 0; i < maxAttempts; i++) {
    if (waits[i]) await new Promise((r) => setTimeout(r, waits[i]));
    const ts = Math.floor(Date.now() / 1000);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Luumu-Webhooks/1.0",
          "X-Luumu-Event": event.event,
          "X-Luumu-Delivery": event.id || randomUUID(),
          "X-Luumu-Timestamp": String(ts),
          "X-Luumu-Signature": signWebhook(secret, ts, body),
        },
        body,
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
      last = { ok: r.ok, status: r.status, attempts: i + 1 };
      // 4xx (exceto 408/429) é recusa da plataforma: tentar de novo não muda nada
      if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429)) return last;
    } catch (e) {
      last = { ok: false, status: null, attempts: i + 1, error: e instanceof Error ? e.name : "erro" };
    }
  }
  return last;
}
