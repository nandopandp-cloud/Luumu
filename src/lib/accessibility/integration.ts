/**
 * Plugin de Acessibilidade — integração com uma plataforma externa.
 *
 * Módulo PURO (SDK, servidor e a documentação para a plataforma externa usam o mesmo contrato).
 *
 * No modo "external" (painel → Ativação → Integração), quem decide quem recebe o convite e onde
 * ficam as escolhas de cada estudante é a outra plataforma:
 *
 *  ENTRADA — a página do produto informa o estado do estudante logado:
 *      Luumu.accessibility.setUser({ invite: true, profiles: ["leitura"], status: "pending",
 *                                    prefs: { ... última configuração salva ... } })
 *
 *  SAÍDA — toda mudança no plugin sai na hora:
 *      - evento no navegador: window "luumu:accessibility" (e Luumu.accessibility.onChange);
 *      - webhook (opcional): a Luumu repassa o mesmo evento, assinado, para a URL configurada.
 *
 * A Luumu não guarda lista de convidados nem preferências nesse modo.
 */
import { DEFAULT_PREFS, FEATURES, isProfileId, normalizePrefs, PROFILES, type A11yPrefs, type ProfileId } from "./features";

export type IntegrationMode = "luumu" | "external";
export type InviteStatus = "pending" | "shown" | "accepted" | "dismissed";
const INVITE_STATUS: InviteStatus[] = ["pending", "shown", "accepted", "dismissed"];

/** O que a plataforma externa informa sobre o estudante logado. */
export interface ExternalUserState {
  /** mostrar o convite para este estudante */
  invite: boolean;
  /** perfis sugeridos no convite (até 3 aparecem); vazio = os configurados no painel */
  profiles: ProfileId[];
  /** desfecho já registrado na plataforma externa ("accepted"/"dismissed" = não mostra de novo) */
  status: InviteStatus;
  /** última configuração salva na plataforma externa (null = nenhuma ainda) */
  prefs: A11yPrefs | null;
}

/** Aceita o que vier da página e devolve só valores conhecidos (o resto cai no padrão). */
export function normalizeExternalState(input: unknown): ExternalUserState {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const profiles = Array.isArray(o.profiles) ? [...new Set(o.profiles.filter(isProfileId))].slice(0, 8) : [];
  const status = INVITE_STATUS.includes(o.status as InviteStatus) ? (o.status as InviteStatus) : "pending";
  const prefs = o.prefs && typeof o.prefs === "object" ? normalizePrefs({ ...DEFAULT_PREFS, ...(o.prefs as object) }) : null;
  return { invite: o.invite === true, profiles, status, prefs };
}

/* ---------------------------------------------------------------- eventos (saída) */

export const EVENT_TYPES = ["prefs.updated", "invite.shown", "invite.accepted", "invite.dismissed"] as const;
export type A11yEventType = (typeof EVENT_TYPES)[number] | "test";

export interface A11yEvent {
  /** tipo do evento */
  event: A11yEventType;
  /** id único da entrega (para descartar repetidos) */
  id: string;
  /** quando aconteceu no aparelho do estudante (ISO 8601) */
  occurredAt: string;
  /** estudante (como veio no Luumu.identify) */
  user: { id: string | null; email: string | null };
  /** plataforma (hostname) onde aconteceu */
  host: string;
  /** configuração completa do plugin para o estudante, já com a mudança */
  prefs: A11yPrefs;
  /** perfis ligados no momento */
  activeProfiles: ProfileId[];
  /** o que mudou neste evento (prefs.updated); vazio nos eventos de convite */
  changes: { field: string; from: unknown; to: unknown }[];
  /** convite (eventos invite.*): perfis mostrados e o desfecho */
  invite: { status: InviteStatus; profiles: ProfileId[] } | null;
}

/** Campos de `prefs` que mudaram entre dois estados (para `changes`). */
export function prefsDiff(before: A11yPrefs, after: A11yPrefs): { field: string; from: unknown; to: unknown }[] {
  const out: { field: string; from: unknown; to: unknown }[] = [];
  for (const k of Object.keys(DEFAULT_PREFS) as (keyof A11yPrefs)[]) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) out.push({ field: k, from: before[k], to: after[k] });
  }
  return out;
}

/* ---------------------------------------------------------------- referência (documentação) */

/** Campos de `prefs`: o mesmo formato na entrada (setUser) e na saída (eventos). */
export const PREF_FIELDS: { field: keyof A11yPrefs; type: string; values: string; meaning: string }[] = [
  ...FEATURES.filter((f) => f.id !== "faceNav").map((f) => {
    const id = f.id as keyof A11yPrefs;
    if (id === "textSize") return { field: id, type: "número", values: "0 a 4 (100%, 115%, 130%, 150%, 175%)", meaning: f.label };
    if (id === "contrast") return { field: id, type: "texto", values: '"off" | "high" | "dark"', meaning: f.label };
    if (id === "saturation") return { field: id, type: "texto", values: '"off" | "low" | "high" | "mono"', meaning: f.label };
    if (id === "colorBlind") return { field: id, type: "texto", values: '"off" | "protan" | "deutan" | "tritan"', meaning: f.label };
    return { field: id, type: "booleano", values: "true | false", meaning: f.label };
  }),
  { field: "profiles", type: "lista", values: "ids de perfil (ver tabela de perfis)", meaning: "Perfis ligados" },
  { field: "launcherPos", type: "objeto | null", values: "{ x: 0–1, y: 0–1 }", meaning: "Onde o estudante deixou o botão (fração da tela)" },
];

export const PROFILE_REFERENCE = PROFILES.map((p) => ({ id: p.id, label: p.label, nudgeLabel: p.nudgeLabel, description: p.description }));

/** Endereços que não são da internet pública (rede interna, a própria máquina). */
function privateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h.includes(":")) return true; // IPv6 literal: só nomes de domínio ou IPv4 público
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** URL do webhook: só https, domínio público, sem credenciais embutidas. "" = desligado. */
export function safeWebhookUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password && s.length <= 500 && !privateHost(u.hostname) ? u.toString() : "";
  } catch {
    return "";
  }
}

/** Evento de teste (botão "Testar webhook" no painel). */
export function testEvent(id: string): A11yEvent {
  return {
    event: "test",
    id,
    occurredAt: new Date().toISOString(),
    user: { id: "teste-luumu", email: null },
    host: "teste.luumu.com.br",
    prefs: { ...DEFAULT_PREFS, textSize: 2, readingGuide: true, profiles: ["leitura"] } as A11yPrefs,
    activeProfiles: ["leitura"],
    changes: [{ field: "textSize", from: 0, to: 2 }],
    invite: null,
  };
}
