/**
 * Plugin de Acessibilidade — onde o plugin fica ativo (escopo de ativação).
 *
 * Módulo PURO. Duas escolhas independentes, como no painel:
 *  - PLATAFORMAS (`hosts`): vazio = todas as plataformas do projeto (o mesmo padrão do
 *    público das pesquisas). Decidido no SERVIDOR, no /config: fora delas o SDK nem recebe o
 *    plugin (o host já faz parte da chave de cache do /config, então não custa nada a mais).
 *  - ESTUDANTES (`audience`): "all" = todos; "targeted" = só quem casar com um grupo de
 *    rede/escola/turma/ano (decidido no NAVEGADOR, com os traits do identify) ou estiver na
 *    lista de convidados (decidido no SERVIDOR, por estudante, em /api/v1/accessibility/match,
 *    porque a lista é dado sensível). "targeted" sem grupos e sem convidados = ninguém (o
 *    painel avisa antes de publicar).
 */
import { matchesAnyGroup, normalizeGroups, type AudienceGroup } from "./audience";

export interface ActivationScope {
  /** plataformas onde o plugin aparece; vazio = todas */
  hosts: string[];
  audience: "all" | "targeted";
  groups: AudienceGroup[];
  /** convidados da lista recebem o plugin */
  includeInvitees: boolean;
}

export const DEFAULT_SCOPE: ActivationScope = { hosts: [], audience: "all", groups: [], includeInvitees: true };

const HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

/** Mesmo resultado de lib/platform/hosts → normalizeHost: minúsculas, sem esquema, porta ou caminho. */
export function cleanHost(raw: unknown): string {
  let s = String(raw ?? "").trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  return HOST.test(s) ? s.slice(0, 253) : "";
}

export function normalizeScope(input: unknown): ActivationScope {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  // `mode` era o nome antigo de `audience` (primeira versão do escopo)
  const audience = o.audience ?? o.mode;
  return {
    hosts: Array.isArray(o.hosts) ? [...new Set(o.hosts.map(cleanHost).filter(Boolean))].slice(0, 200) : [],
    audience: audience === "targeted" ? "targeted" : "all",
    groups: normalizeGroups(o.groups),
    includeInvitees: typeof o.includeInvitees === "boolean" ? o.includeInvitees : DEFAULT_SCOPE.includeInvitees,
  };
}

/** Servidor (/config): o plugin vale para esta plataforma? */
export function hostInScope(scope: Pick<ActivationScope, "hosts">, host: string | null): boolean {
  if (scope.hosts.length === 0) return true;
  return !!host && scope.hosts.includes(host);
}

/**
 * Navegador: este estudante está no escopo?
 *  "yes" = sim; "no" = não; "ask" = só a lista de convidados pode dizer (consultar o servidor).
 */
export function scopeDecision(
  scope: Pick<ActivationScope, "audience" | "groups" | "includeInvitees">,
  traits: Record<string, unknown>,
  hasInvitees: boolean
): "yes" | "no" | "ask" {
  if (scope.audience === "all") return "yes";
  if (scope.groups.length && matchesAnyGroup(scope.groups, traits)) return "yes";
  if (scope.includeInvitees && hasInvitees && (traits.id || traits.email)) return "ask";
  return "no";
}

/** "targeted" sem nenhum critério não alcança ninguém: o painel avisa antes de publicar. */
export function scopeReachesNobody(scope: ActivationScope, invitees: number): boolean {
  return scope.audience === "targeted" && scope.groups.length === 0 && !(scope.includeInvitees && invitees > 0);
}

/** Resumo para o painel: onde e para quem o plugin aparece. */
export function scopeSummary(scope: ActivationScope, opts: { invitees: number; projectHosts: number }): { where: string; who: string } {
  const where =
    scope.hosts.length === 0
      ? `Todas as plataformas do projeto${opts.projectHosts ? ` (${opts.projectHosts})` : ""}`
      : scope.hosts.length === 1
        ? scope.hosts[0]
        : `${scope.hosts.length} plataformas`;
  if (scope.audience === "all") return { where, who: "Todos os estudantes" };
  const parts: string[] = [];
  if (scope.groups.length) parts.push(`${scope.groups.length} ${scope.groups.length === 1 ? "grupo" : "grupos"} de rede/escola/turma`);
  if (scope.includeInvitees && opts.invitees) parts.push(`${opts.invitees.toLocaleString("pt-BR")} ${opts.invitees === 1 ? "convidado" : "convidados"}`);
  return { where, who: parts.length ? parts.join(" e ") : "Ninguém (escolha grupos ou convidados)" };
}
