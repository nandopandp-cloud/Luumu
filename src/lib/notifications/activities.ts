/**
 * Avisos automáticos de atividades (nova Tarefa, nova Prova Genial, prazo chegando), parte PURA:
 * usada pelo sino (src/sdk/notifications/bell.ts), pela API e pelo painel — por isso sem
 * `server-only`, `next/*` nem banco. Contrato com o cliente: docs/notifications/INTEGRACAO.md.
 *
 * Como funciona: o back-end do cliente avisa por webhook quando libera, altera ou cancela uma
 * atividade, com as TURMAS que a recebem. O sino de cada estudante lê a lista da turma dele
 * (informada no identify como `class_ids`) e decide, no navegador, o que mostrar:
 *
 *   - "Nova tarefa" / "Nova Prova Genial": atividade liberada nos últimos 7 dias;
 *   - "Falta 1 dia" (ou 12h, 2 dias): da antecedência configurada até o prazo;
 *   - nada, depois que o estudante conclui (chega à tela de resultado da atividade, ou o produto
 *     chama Luumu.notifications.complete(id)).
 */
import { ACTIVITIES as JOURNEY } from "../analytics/journey";

export const ACTIVITY_TYPES = ["tarefa", "prova_genial"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const isActivityType = (v: unknown): v is ActivityType => ACTIVITY_TYPES.includes(v as ActivityType);
export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = { tarefa: "Tarefa", prova_genial: "Prova Genial" };

/** Limites do que o webhook aceita (o resto é recusado com o motivo). */
export const ACTIVITY_LIMITS = { id: 100, title: 120, subject: 60, url: 500, classId: 100, classes: 500 } as const;

/* ---------- configuração (painel → Notificações → Avisos automáticos) ---------- */

export interface AutoSettings {
  /** avisos automáticos ligados no projeto (o sino também precisa estar ligado) */
  enabled: boolean;
  /** avisar atividade nova */
  novas: boolean;
  /** horas antes do prazo para o aviso de prazo; 0 = não avisa */
  dueHours: number;
}

export const DUE_HOURS_OPTIONS = [0, 12, 24, 48] as const;
export const DEFAULT_AUTO: AutoSettings = { enabled: false, novas: true, dueHours: 24 };

export function normalizeAuto(v: unknown): AutoSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const h = Number(o.dueHours);
  return {
    enabled: o.enabled === true,
    novas: o.novas !== false,
    dueHours: (DUE_HOURS_OPTIONS as readonly number[]).includes(h) ? h : DEFAULT_AUTO.dueHours,
  };
}

/** O que vai no /config para o sino: n = avisa novas, d = horas antes do prazo (0 = não avisa). */
export interface PublicAuto {
  n: 0 | 1;
  d: number;
}

export const publicAuto = (a: AutoSettings): PublicAuto | undefined => (a.enabled && (a.novas || a.dueHours > 0) ? { n: a.novas ? 1 : 0, d: a.dueHours } : undefined);

/* ---------- turmas do estudante (identify) ---------- */

/** Uma turma: texto sem espaços nas pontas, até 100 caracteres, sem quebras. "" = inválida. */
export function classKey(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  const v = String(raw).trim();
  return v && v.length <= ACTIVITY_LIMITS.classId && !/[\u0000-\u001f]/.test(v) ? v : "";
}

export const MAX_STUDENT_CLASSES = 10;

/** As turmas que o produto mandou no identify (`class_ids`, ou `classIds`), sem repetidas. */
export function classIdsOf(traits: Record<string, unknown>): string[] {
  const raw = traits.class_ids ?? traits.classIds;
  const list = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  return [...new Set(list.map(classKey).filter(Boolean))].slice(0, MAX_STUDENT_CLASSES);
}

/* ---------- feed da turma (GET /api/v1/notifications/feed) ---------- */

/** Uma atividade como o feed da turma entrega ao sino. Chaves curtas: é lido por toda a turma. */
export interface FeedActivity {
  id: string;
  /** tipo */
  k: ActivityType;
  /** título */
  t: string;
  /** matéria */
  s?: string;
  /** link da atividade no produto */
  u: string;
  /** liberada em (epoch ms) */
  a: number;
  /** prazo (epoch ms) */
  d?: number;
}

export interface ActivityForFeed {
  externalId: string;
  type: string;
  title: string;
  subject: string | null;
  url: string;
  assignedAt: Date;
  dueAt: Date | null;
}

export const MAX_FEED_ITEMS = 100;

export function toFeed(rows: ActivityForFeed[]): FeedActivity[] {
  return rows.filter((r) => isActivityType(r.type)).slice(0, MAX_FEED_ITEMS).map((r) => {
    const f: FeedActivity = { id: r.externalId, k: r.type as ActivityType, t: r.title, u: r.url, a: r.assignedAt.getTime() };
    if (r.subject) f.s = r.subject;
    if (r.dueAt) f.d = r.dueAt.getTime();
    return f;
  });
}

/* ---------- avisos calculados no navegador ---------- */

/** "Nova" vale por 7 dias depois da liberação. */
export const NEW_WINDOW_MS = 7 * 86_400_000;
/**
 * Primeira vez que o sino vê as atividades deste estudante neste navegador: o que foi liberado há
 * mais de 48h entra como já lido. Sem isso, um computador novo acenderia o sino com a semana toda.
 */
export const FIRST_SYNC_FRESH_MS = 48 * 3600_000;

export type ActivityItemKind = "nova" | "prazo";

export interface ActivityItem {
  /** "n:<id>" (nova) ou "d:<id>:<prazo>" (prazo; prazo novo = aviso novo) */
  id: string;
  kind: ActivityItemKind;
  activity: FeedActivity;
  /** quando o aviso passou a valer (epoch ms): ordena a lista e vira o "Hoje às…" */
  at: number;
}

export const itemIdOf = (kind: ActivityItemKind, a: FeedActivity) => (kind === "nova" ? `n:${a.id}` : `d:${a.id}:${a.d}`);

/** id de aviso → atividade e tipo de aviso (null = é um recado, não um aviso automático). */
export function parseItemId(id: string): { activityId: string; item: ActivityItemKind } | null {
  if (id.startsWith("n:") && id.length > 2) return { activityId: id.slice(2), item: "nova" };
  const m = /^d:(.+):\d+$/.exec(id);
  return m ? { activityId: m[1], item: "prazo" } : null;
}

/** Os avisos que valem agora, para as atividades das turmas do estudante. */
export function activityItems(acts: FeedActivity[], auto: PublicAuto, done: ReadonlySet<string>, now = Date.now()): ActivityItem[] {
  const out: ActivityItem[] = [];
  const seen = new Set<string>();
  for (const a of acts) {
    // a mesma atividade pode vir em duas turmas do estudante
    if (seen.has(a.id) || done.has(a.id)) continue;
    seen.add(a.id);
    if (a.a > now) continue; // liberação agendada: ainda não
    if (a.d !== undefined && a.d <= now) continue; // prazo passou
    if (auto.n && now - a.a <= NEW_WINDOW_MS) out.push({ id: itemIdOf("nova", a), kind: "nova", activity: a, at: a.a });
    if (auto.d > 0 && a.d !== undefined) {
      const from = a.d - auto.d * 3600_000;
      if (now >= from) out.push({ id: itemIdOf("prazo", a), kind: "prazo", activity: a, at: Math.max(from, a.a) });
    }
  }
  // mais recente primeiro; no empate, o prazo (mais urgente) antes da novidade
  return out.sort((x, y) => y.at - x.at || (x.kind === "prazo" ? -1 : 0) - (y.kind === "prazo" ? -1 : 0));
}

/** Avisos que entram como lidos na primeira sincronização deste estudante neste navegador. */
export const staleOnFirstSync = (items: ActivityItem[], now = Date.now()) =>
  items.filter((i) => i.kind === "nova" && now - i.at > FIRST_SYNC_FRESH_MS).map((i) => i.id);

/* ---------- textos ---------- */

const pad = (n: number) => String(n).padStart(2, "0");

/** "hoje às 23:59", "amanhã às 18:00", "28/11 às 18:00" (fuso do navegador). */
export function dueLabel(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(new Date(now))) / 86_400_000);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (diff === 0) return `hoje às ${hm}`;
  if (diff === 1) return `amanhã às ${hm}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${hm}`;
}

/** "Falta 1 dia", "Faltam 12 horas", "Faltam 2 dias" (pela antecedência configurada). */
export function dueTitle(hours: number): string {
  if (hours % 24 === 0) return hours === 24 ? "Falta 1 dia" : `Faltam ${hours / 24} dias`;
  return hours === 1 ? "Falta 1 hora" : `Faltam ${hours} horas`;
}

export function itemText(i: ActivityItem, auto: PublicAuto, now = Date.now()): { title: string; body: string } {
  const a = i.activity;
  const what = a.s ? `${a.s} · ${a.t}` : a.t;
  if (i.kind === "nova") {
    return {
      title: a.k === "prova_genial" ? "Nova Prova Genial" : "Nova tarefa",
      body: a.d !== undefined ? `${what}. Entrega até ${dueLabel(a.d, now)}.` : what,
    };
  }
  return { title: dueTitle(auto.d), body: `${ACTIVITY_TYPE_LABEL[a.k]}: ${what}. Entrega até ${dueLabel(a.d!, now)}.` };
}

/* ---------- conclusão ---------- */

const pathOnly = (u: string) => {
  let p = u;
  if (/^https:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname;
    } catch {
      return "";
    }
  }
  return p.replace(/[?#].*$/, "").replace(/\/+$/, "");
};

// telas de resultado de cada tipo: as mesmas que a jornada do Analytics reconhece como "concluiu"
const DONE_ROUTES: Record<ActivityType, RegExp[]> = {
  tarefa: [],
  prova_genial: [],
};
for (const t of ACTIVITY_TYPES) {
  const j = JOURNEY.find((x) => x.id === t);
  DONE_ROUTES[t] = (j?.stages.concluiu ?? []).map((r) => new RegExp(`^/${r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:id/g, "[^/]+")}$`));
}

/**
 * O estudante está na tela de resultado DESTA atividade? Precisa estar dentro do link da
 * atividade (ex.: /instituicao/assignments/t123/complete para o link /instituicao/assignments/t123)
 * e numa tela de resultado do tipo dela.
 */
export function isCompletionPath(pathname: string, a: Pick<FeedActivity, "k" | "u">): boolean {
  const base = pathOnly(a.u);
  const p = pathOnly(pathname);
  if (!base || !p.startsWith(`${base}/`)) return false;
  return (DONE_ROUTES[a.k] ?? []).some((re) => re.test(p));
}
