/**
 * Falha de infraestrutura do banco (indisponível), não erro de credencial. Puro.
 * Cobre a quota do Neon (HTTP 402 / 429), indisponibilidade do serviço (5xx) e falha de
 * rede do driver neon-http (`fetch failed`). Percorre a cadeia de `cause` porque o Drizzle
 * embrulha o NeonDbError original dentro do seu próprio erro de query.
 */
export function isDbUnavailable(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/HTTP status (402|429|5\d\d)|exceeded the data transfer quota|fetch failed|Failed query/i.test(msg)) {
      return true;
    }
    e = e instanceof Error ? (e as { cause?: unknown }).cause : undefined;
  }
  return false;
}
