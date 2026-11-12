/**
 * Plugin de Acessibilidade — onde o plugin fica ativo (escopo de ativação).
 *
 * Módulo PURO. Três camadas, avaliadas em lugares diferentes:
 *  - domínios (plataformas): no SERVIDOR, no /config — fora deles o SDK nem recebe o plugin
 *    (o host já faz parte da chave de cache do /config, então não custa nada a mais);
 *  - grupos (rede/escola/turma/ano): no NAVEGADOR, com os traits do identify;
 *  - convidados da lista: no SERVIDOR, por estudante (POST /api/v1/accessibility/match),
 *    porque a lista é dado sensível e não pode ir para o navegador.
 *
 * "all" = todo o projeto. "targeted" = só os domínios escolhidos (vazio = todos os domínios do
 * projeto) e, dentro deles, só quem casar com um grupo ou estiver na lista de convidados
 * (sem grupos e sem convidados = todos nos domínios escolhidos).
 */
import { matchesAnyGroup, normalizeGroups, type AudienceGroup } from "./audience";

export interface ActivationScope {
  mode: "all" | "targeted";
  hosts: string[];
  groups: AudienceGroup[];
  /** convidados da lista também recebem o plugin */
  includeInvitees: boolean;
}

export const DEFAULT_SCOPE: ActivationScope = { mode: "all", hosts: [], groups: [], includeInvitees: true };

const HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*(:\d+)?$/;

/** Mesmo formato de lib/db/hosts → normalizeHost: minúsculas, sem esquema, porta ou barra. */
export function cleanHost(raw: unknown): string {
  let s = String(raw ?? "").trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "").replace(/:\d+$/, "");
  return HOST.test(s) ? s.slice(0, 253) : "";
}

export function normalizeScope(input: unknown): ActivationScope {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const hosts = Array.isArray(o.hosts) ? [...new Set(o.hosts.map(cleanHost).filter(Boolean))].slice(0, 100) : [];
  return {
    mode: o.mode === "targeted" ? "targeted" : "all",
    hosts,
    groups: normalizeGroups(o.groups),
    includeInvitees: typeof o.includeInvitees === "boolean" ? o.includeInvitees : DEFAULT_SCOPE.includeInvitees,
  };
}

/** Servidor (/config): o plugin vale para esta plataforma? Sem host conhecido, só no modo "all". */
export function hostInScope(scope: ActivationScope, host: string | null): boolean {
  if (scope.mode === "all" || scope.hosts.length === 0) return true;
  return !!host && scope.hosts.includes(host);
}

/**
 * Navegador: este estudante está no escopo?
 *  "yes" = sim; "no" = não; "ask" = só a lista de convidados pode dizer (consultar o servidor).
 */
export function scopeDecision(
  scope: Pick<ActivationScope, "mode" | "groups" | "includeInvitees">,
  traits: Record<string, unknown>,
  hasInvitees: boolean
): "yes" | "no" | "ask" {
  if (scope.mode === "all") return "yes";
  const useList = scope.includeInvitees && hasInvitees;
  if (!scope.groups.length && !useList) return "yes"; // só domínios: todos dentro deles
  if (scope.groups.length && matchesAnyGroup(scope.groups, traits)) return "yes";
  if (useList && (traits.id || traits.email)) return "ask";
  return "no";
}
