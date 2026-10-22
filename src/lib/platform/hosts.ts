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

/**
 * Rótulo curto de uma plataforma para badges: o primeiro nível do hostname
 * ("matematicaem.jovensgenios.com" → "matematicaem"). Volta ao hostname inteiro quando o
 * rótulo curto não identifica sozinho — "www", ou duas plataformas com o mesmo primeiro nível
 * em domínios diferentes (passadas em `all`).
 */
export function hostLabel(host: string, all: string[] = []): string {
  const first = host.split(".")[0];
  if (!first || first === "www" || first === host) return host;
  const clash = all.some((h) => h !== host && h.split(".")[0] === first);
  return clash ? host : first;
}

/*
  Seleção de VÁRIAS plataformas: na URL (?host=a,b), no cookie do header e nos escopos de
  consulta ela viaja como texto separado por vírgula. "" = todas.
*/
export function normalizeHosts(raw: string | null | undefined): string {
  return hostList(raw).join(",");
}

/** "a.com,b.com" → ["a.com", "b.com"] (normalizados, sem repetição, até 50). */
export function hostList(raw: string | null | undefined): string[] {
  return [...new Set((raw ?? "").split(",").map(normalizeHost).filter(Boolean))].slice(0, 50);
}
