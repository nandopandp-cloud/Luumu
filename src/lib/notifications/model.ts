/**
 * Notificações no produto do cliente (sino no header + painel), parte pura: tipos, validação,
 * status, público e o recorte público que vai no /config. Usado pelo painel, pela API e pelo SDK
 * (src/sdk/notifications/bell.ts) — por isso sem `server-only`, `next/*` nem banco.
 *
 * Fase 1: recados escritos no painel da Luumu. As notificações automáticas (nova tarefa, nova
 * Prova Genial, prazo) entram depois, alimentadas pelas atividades que o cliente enviar.
 */
import { matchesSchoolYears, normalizeSchoolYears } from "../surveys/school-years";

/* ---------- categorias (ícone e cor no painel do estudante) ---------- */

export const NOTIFICATION_CATEGORIES = [
  { id: "aviso", label: "Aviso", color: "#5B50E6", bg: "#E3E1FB" },
  { id: "novidade", label: "Novidade", color: "#7C3AED", bg: "#EDE4FD" },
  { id: "evento", label: "Evento", color: "#2563EB", bg: "#DCE8FD" },
  { id: "lembrete", label: "Lembrete", color: "#D93A3A", bg: "#FBE1E1" },
  { id: "conquista", label: "Conquista", color: "#B7791F", bg: "#FCEFD2" },
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["id"];
export const isCategory = (v: unknown): v is NotificationCategory => NOTIFICATION_CATEGORIES.some((c) => c.id === v);
export const categoryOf = (id: string) => NOTIFICATION_CATEGORIES.find((c) => c.id === id) ?? NOTIFICATION_CATEGORIES[0];

/* ---------- status ---------- */

/** Guardado no banco. "teste" = no ar só para os usuários de teste do projeto. */
export type NotificationStatus = "rascunho" | "teste" | "publicada" | "arquivada";
/** Mostrado no painel: "publicada" vira agendada / no ar / expirada conforme as datas. */
export type NotificationDisplayStatus = "rascunho" | "teste" | "agendada" | "no_ar" | "expirada" | "arquivada";

export const DISPLAY_STATUS_LABEL: Record<NotificationDisplayStatus, string> = {
  rascunho: "Rascunho",
  teste: "Em teste",
  agendada: "Agendada",
  no_ar: "No ar",
  expirada: "Expirada",
  arquivada: "Arquivada",
};

export function displayStatus(n: { status: string; publishAt: Date | null; expiresAt: Date | null }, now = Date.now()): NotificationDisplayStatus {
  if (n.status === "rascunho" || n.status === "arquivada" || n.status === "teste") return n.status;
  if (n.publishAt && n.publishAt.getTime() > now) return "agendada";
  if (n.expiresAt && n.expiresAt.getTime() <= now) return "expirada";
  return "no_ar";
}

/* ---------- público ---------- */

export interface NotificationAudience {
  /** anos escolares ("EF6", "EM1"…); [] = todos */
  schoolYears: string[];
  /** ids ou e-mails (o que o identify envia); [] = todos */
  list: string[];
}

/** Chave de comparação de um id ou e-mail: sem espaços nas pontas e em minúsculas. */
export function audienceKey(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  const v = String(raw).trim().toLowerCase();
  return v && v.length <= 200 && !/[\s,;]/.test(v) ? v : "";
}

export const MAX_AUDIENCE_LIST = 5000;

/** Lista colada no painel (uma por linha, ou separada por vírgula/ponto e vírgula) → chaves únicas. */
export function parseAudienceList(text: string): string[] {
  const out = new Set<string>();
  for (const part of text.split(/[\n,;\t]+/)) {
    const k = audienceKey(part);
    if (k) out.add(k);
    if (out.size >= MAX_AUDIENCE_LIST) break;
  }
  return [...out];
}

export function normalizeAudience(v: unknown): NotificationAudience {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const list = Array.isArray(o.list) ? o.list.map(audienceKey).filter(Boolean).slice(0, MAX_AUDIENCE_LIST) : [];
  return { schoolYears: normalizeSchoolYears(o.schoolYears), list: [...new Set(list)] };
}

/**
 * Hash curto (cyrb53) de uma chave de público. A lista de ids/e-mails não vai em texto puro no
 * /config (que é público): vai o hash com o sal do projeto, e o SDK compara com o hash do usuário
 * identificado. Não é criptografia — ids numéricos são adivinháveis —, só evita expor e-mails.
 */
export function audienceHash(salt: string, key: string): string {
  const str = `${salt}:${key}`;
  let h1 = 0xdeadbeef ^ 0x9e3779b9;
  let h2 = 0x41c6ce57 ^ 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Chave do usuário identificado (id, ou e-mail na falta dele) — a mesma das métricas. */
export function userKeyOf(identity: { id?: unknown; email?: unknown }): string {
  return audienceKey(identity.id) || audienceKey(identity.email);
}

/* ---------- configuração do sino (por projeto) ---------- */

export type BellPlacement = "slot" | "selector" | "floating";
export type BellCorner = "top-right" | "bottom-right" | "bottom-left";
export const BELL_SLOT_ID = "luumu-bell";

export interface BellSettings {
  enabled: boolean;
  /** plataformas (hostnames) onde o sino aparece; [] = todas */
  hosts: string[];
  placement: BellPlacement;
  /** seletor CSS do elemento onde o sino entra (placement "selector") */
  selector: string;
  /** canto da tela (placement "floating") */
  corner: BellCorner;
  /** cor de destaque (botões, aba ativa, não lidas) */
  accent: string;
  /** texto do painel vazio */
  emptyText: string;
  /** ids/e-mails que recebem os recados "em teste" */
  testers: string[];
}

export const DEFAULT_ACCENT = "#5B50E6";
export const DEFAULT_EMPTY_TEXT = "Quando chegar algo novo, você verá por aqui.";

export const DEFAULT_BELL_SETTINGS: BellSettings = {
  enabled: false,
  hosts: [],
  placement: "slot",
  selector: "",
  corner: "bottom-right",
  accent: DEFAULT_ACCENT,
  emptyText: DEFAULT_EMPTY_TEXT,
  testers: [],
};

const HEX = /^#[0-9a-f]{6}$/i;

export function normalizeBellSettings(v: unknown): BellSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const str = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");
  return {
    enabled: o.enabled === true,
    hosts: Array.isArray(o.hosts) ? [...new Set(o.hosts.filter((h): h is string => typeof h === "string" && !!h.trim()).map((h) => h.trim().toLowerCase()))].slice(0, 50) : [],
    placement: o.placement === "selector" || o.placement === "floating" ? o.placement : "slot",
    selector: str(o.selector, 200),
    corner: o.corner === "top-right" || o.corner === "bottom-left" ? o.corner : "bottom-right",
    accent: typeof o.accent === "string" && HEX.test(o.accent) ? o.accent.toUpperCase() : DEFAULT_ACCENT,
    emptyText: str(o.emptyText, 140) || DEFAULT_EMPTY_TEXT,
    testers: Array.isArray(o.testers) ? [...new Set(o.testers.map(audienceKey).filter(Boolean))].slice(0, 50) : [],
  };
}

/** O sino vale para esta plataforma? */
export const bellForHost = (s: Pick<BellSettings, "hosts">, host: string | null) => s.hosts.length === 0 || (!!host && s.hosts.includes(host));

/* ---------- validação do recado (editor do painel) ---------- */

export const LIMITS = { title: 80, body: 280, ctaLabel: 24, url: 500 } as const;

export interface NotificationDraft {
  title: string;
  body: string;
  category: NotificationCategory;
  ctaLabel: string;
  ctaUrl: string;
  audience: NotificationAudience;
  hosts: string[];
  pinned: boolean;
  /** null = assim que publicar */
  publishAt: Date | null;
  /** null = não expira */
  expiresAt: Date | null;
}

/** Link do botão: caminho do próprio produto ("/tarefas") ou endereço https. */
export function validUrl(u: string): boolean {
  if (!u) return true;
  if (u.length > LIMITS.url) return false;
  if (u.startsWith("/") && !u.startsWith("//")) return !/\s/.test(u);
  return /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(u);
}

/** Primeiro problema do rascunho para publicar (null = ok). Rascunho salvo só exige título. */
export function draftProblem(d: NotificationDraft, publishing: boolean, now = Date.now()): string | null {
  if (!d.title.trim()) return "Escreva um título.";
  if (d.title.length > LIMITS.title) return `O título passa de ${LIMITS.title} caracteres.`;
  if (d.body.length > LIMITS.body) return `A mensagem passa de ${LIMITS.body} caracteres.`;
  if (d.ctaLabel.length > LIMITS.ctaLabel) return `O texto do botão passa de ${LIMITS.ctaLabel} caracteres.`;
  if (!validUrl(d.ctaUrl)) return 'O link do botão precisa começar com "/" (página do produto) ou "https://".';
  if (d.ctaLabel.trim() && !d.ctaUrl.trim()) return "Informe o link do botão.";
  if (d.publishAt && d.expiresAt && d.expiresAt.getTime() <= d.publishAt.getTime()) return "O fim precisa ser depois do início.";
  if (!publishing) return null;
  if (!d.body.trim()) return "Escreva a mensagem.";
  if (d.expiresAt && d.expiresAt.getTime() <= now) return "A data de fim já passou.";
  return null;
}

/* ---------- recorte público (/config → SDK) ---------- */

/** Um recado como o SDK recebe. Chaves curtas: vai em todo /config dos projetos com o sino. */
export interface PublicNotification {
  id: string;
  /** título */
  t: string;
  /** mensagem */
  b: string;
  /** categoria */
  c: NotificationCategory;
  /** botão: texto e link */
  l?: string;
  u?: string;
  /** fixada no topo */
  p?: 1;
  /** início e fim (epoch ms) */
  s: number;
  e?: number;
  /** anos escolares */
  y?: string[];
  /** hashes das chaves do público (ids/e-mails); ausente = todos */
  a?: string[];
}

export interface PublicBellConfig {
  /** placement, seletor, canto */
  m: BellPlacement;
  sel: string;
  cor: BellCorner;
  /** cor de destaque e texto do painel vazio */
  ac: string;
  em: string;
}

export interface PublicNotifications {
  salt: string;
  cfg: PublicBellConfig;
  items: PublicNotification[];
}

export const MAX_PUBLIC_ITEMS = 30;

export interface NotificationForSdk {
  id: string;
  title: string;
  body: string;
  category: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  audience: unknown;
  hosts: unknown;
  pinned: boolean;
  status: string;
  publishAt: Date | null;
  publishedAt: Date | null;
  expiresAt: Date | null;
}

/**
 * O que vai no /config: recados no ar (ou agendados para as próximas 24h, que o SDK mostra na
 * hora certa sem esperar o catálogo vencer) para esta plataforma, mais os "em teste" só para os
 * usuários de teste. Fixados primeiro, depois os mais novos.
 */
export function publicNotifications(
  settings: BellSettings,
  rows: NotificationForSdk[],
  salt: string,
  host: string | null,
  now = Date.now()
): PublicNotifications | null {
  if (!settings.enabled || !bellForHost(settings, host)) return null;
  const testers = settings.testers.map((k) => audienceHash(salt, k));
  const items: PublicNotification[] = [];
  for (const r of rows) {
    if (r.status !== "publicada" && r.status !== "teste") continue;
    if (r.status === "teste" && !testers.length) continue;
    const start = (r.publishAt ?? r.publishedAt)?.getTime() ?? now;
    const end = r.expiresAt?.getTime();
    if (end !== undefined && end <= now) continue;
    if (start > now + 24 * 3600_000) continue;
    const hosts = Array.isArray(r.hosts) ? (r.hosts as string[]) : [];
    if (hosts.length && (!host || !hosts.includes(host))) continue;
    const aud = normalizeAudience(r.audience);
    const item: PublicNotification = { id: r.id, t: r.title, b: r.body, c: isCategory(r.category) ? r.category : "aviso", s: start };
    if (r.ctaLabel && r.ctaUrl) {
      item.l = r.ctaLabel;
      item.u = r.ctaUrl;
    }
    if (r.pinned) item.p = 1;
    if (end !== undefined) item.e = end;
    if (r.status === "teste") item.a = testers;
    else {
      if (aud.schoolYears.length) item.y = aud.schoolYears;
      if (aud.list.length) item.a = aud.list.map((k) => audienceHash(salt, k));
    }
    items.push(item);
  }
  items.sort((a, b) => (b.p ?? 0) - (a.p ?? 0) || b.s - a.s);
  return {
    salt,
    cfg: { m: settings.placement, sel: settings.selector, cor: settings.corner, ac: settings.accent, em: settings.emptyText },
    items: items.slice(0, MAX_PUBLIC_ITEMS),
  };
}

/* ---------- regras do lado do SDK ---------- */

/** O recado vale para este usuário agora? (data, ano escolar e lista) */
export function visibleTo(n: PublicNotification, traits: Record<string, unknown>, salt: string, now = Date.now()): boolean {
  if (n.s > now || (n.e !== undefined && n.e <= now)) return false;
  if (n.y && n.y.length && !matchesSchoolYears(n.y, traits)) return false;
  if (n.a) {
    const keys = [audienceKey(traits.id), audienceKey(traits.email)].filter(Boolean).map((k) => audienceHash(salt, k));
    if (!keys.some((k) => n.a!.includes(k))) return false;
  }
  return true;
}

export type NotificationEventKind = "delivered" | "seen" | "click";
export const EVENT_KINDS: NotificationEventKind[] = ["delivered", "seen", "click"];

/** "Hoje às 13:56", "Ontem às 09:42", "12/11 às 18:00" (fuso do navegador). */
export function whenLabel(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date(now)) - day(d)) / 86_400_000);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (diff === 0) return `Hoje às ${hm}`;
  if (diff === 1) return `Ontem às ${hm}`;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} às ${hm}`;
}

/* ---------- datas do editor (<input type="datetime-local">, no fuso do workspace) ---------- */

function tzOffsetMs(d: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  );
  const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return local - Math.floor(d.getTime() / 1000) * 1000;
}

/** "2026-11-20T08:00" no fuso informado → instante. Vazio ou inválido = null. */
export function fromLocalInput(v: string | null | undefined, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v ?? "");
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // duas passadas: acerta a hora certa mesmo perto de uma troca de horário de verão
  let t = asUtc - tzOffsetMs(new Date(asUtc), timeZone);
  t = asUtc - tzOffsetMs(new Date(t), timeZone);
  return new Date(t);
}

/** Instante → "2026-11-20T08:00" no fuso informado ("" para null). */
export function toLocalInput(d: Date | null | undefined, timeZone: string): string {
  if (!d) return "";
  const local = new Date(d.getTime() + tzOffsetMs(d, timeZone));
  return local.toISOString().slice(0, 16);
}
