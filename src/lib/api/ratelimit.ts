import "server-only";

/**
 * Rate limit por janela fixa, contado em memória (por instância).
 *
 * Antes cada chamada era um UPSERT + RETURNING no Postgres — ou seja, uma escrita no banco
 * por requisição do SDK, justamente o tráfego mais volumoso da plataforma. E como a tabela
 * `rate_limits` nunca era limpa em produção, cada minuto deixava linhas novas para sempre.
 *
 * A troca é deliberada: um limite em memória vale por instância, então com N lambdas ativas
 * o teto efetivo é N× o configurado. Para o que este limite existe — conter abuso e loop de
 * SDK, não cobrar por uso — isso é suficiente, e custa zero de banco. Se algum dia for
 * preciso um limite global exato, o lugar certo é um store dedicado (Redis/Upstash), não o
 * Postgres transacional.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** Remove janelas expiradas para o Map não crescer indefinidamente. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

/**
 * Retorna true se DENTRO do limite, false se excedeu.
 * Mantém a assinatura anterior — os chamadores não mudam.
 */
export async function checkRateLimit(key: string, limit = 60, windowSec = 60): Promise<boolean> {
  const now = Date.now();
  sweep(now);

  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}
