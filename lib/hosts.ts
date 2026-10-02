/*
  Regras de plataforma (hostname) compartilhadas entre servidor e painel. Sem "server-only":
  o formulário de configurações da pesquisa normaliza o que o usuário digita com a mesma regra.
*/

/**
 * Normaliza um hostname para comparação: minúsculo, sem protocolo, sem porta, sem path e sem
 * ponto final. Aceita tanto um hostname puro ("matematicaem.jovensgenios.com") quanto uma
 * URL/origem colada pelo usuário ("https://matematicaem.jovensgenios.com/").
 * Devolve "" quando não há nada aproveitável.
 *
 * DEVE casar com o `HOST` do SDK (sdk/luumu.ts), que usa `location.hostname` em minúsculas.
 */
export function normalizeHost(raw: string | null | undefined): string {
  if (!raw) return "";
  const value = raw.trim().toLowerCase();
  if (!value) return "";
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(value) ? value : `http://${value}`);
    return url.hostname.replace(/\.$/, "").slice(0, 253);
  } catch {
    return "";
  }
}
