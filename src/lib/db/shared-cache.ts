import "server-only";
import { unstable_cache } from "next/cache";

/**
 * Cache de dados do Next (`unstable_cache`) para agregados caros do banco.
 *
 * Diferente dos `Map` por instância usados no resto de lib/db, este cache é COMPARTILHADO entre
 * todas as instâncias da função e sobrevive a deploys na Vercel: cada instância nova (cold
 * start, escala, deploy) não refaz a consulta. A chave é `key` + os argumentos — passe datas
 * como string ISO para a chave ficar estável.
 *
 * Fora de uma requisição do Next (scripts, testes) o cache não existe e a chamada falha: aí a
 * função roda direto, sem cache.
 */
export function sharedCache<A extends (string | undefined)[], R>(fn: (...args: A) => Promise<R>, key: string, revalidateSeconds: number) {
  const cached = unstable_cache(fn, [key], { revalidate: revalidateSeconds });
  return async (...args: A): Promise<R> => {
    try {
      return await cached(...args);
    } catch {
      return fn(...args);
    }
  };
}
