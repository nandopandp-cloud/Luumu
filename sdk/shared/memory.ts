/*
  Memória local dos tours no navegador do usuário final. Compartilhada pelo core (decidir se
  vale baixar o runtime) e pelo runtime (frequência, retomada). Todo acesso a storage é
  defensivo: modo privado/storage bloqueado = comportamento de "nunca visto".
*/
import type { TourMemory } from "../../lib/tours/frequency";

const get = (s: Storage | undefined, k: string): string | null => {
  try {
    return s ? s.getItem(k) : null;
  } catch {
    return null;
  }
};
const set = (s: Storage | undefined, k: string, v: string) => {
  try {
    s?.setItem(k, v);
  } catch {}
};
const del = (s: Storage | undefined, k: string) => {
  try {
    s?.removeItem(k);
  } catch {}
};
const ls = () => (typeof localStorage !== "undefined" ? localStorage : undefined);
const ss = () => (typeof sessionStorage !== "undefined" ? sessionStorage : undefined);

const rand = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Memória é por usuário identificado (ou anônimo neste navegador). */
const memKey = (tourId: string, userId?: string) => `luumu_tour_${tourId}_${userId || "anon"}`;

export function readMemory(tourId: string, userId?: string): TourMemory {
  try {
    return JSON.parse(get(ls(), memKey(tourId, userId)) || "{}") || {};
  } catch {
    return {};
  }
}

export function writeMemory(tourId: string, userId: string | undefined, patch: TourMemory) {
  set(ls(), memKey(tourId, userId), JSON.stringify({ ...readMemory(tourId, userId), ...patch }));
}

export const shownThisSession = (tourId: string) => get(ss(), `luumu_tour_s_${tourId}`) === "1";
export const markShownThisSession = (tourId: string) => set(ss(), `luumu_tour_s_${tourId}`, "1");

const NEW_USER_DAYS = 7;

/**
 * Primeiro acesso: o core marca a primeira vez que o SDK roda neste navegador. A sessão em
 * que isso acontece é a "primeira sessão" (gatilho first_access); "novo usuário" (público)
 * vale por alguns dias depois disso.
 */
export function touchFirstVisit(): void {
  if (!get(ls(), "luumu_first_seen")) {
    set(ls(), "luumu_first_seen", String(Date.now()));
    set(ss(), "luumu_first_session", "1");
  }
}
export const isFirstSession = () => get(ss(), "luumu_first_session") === "1";
export function isNewUser(): boolean {
  const t = Number(get(ls(), "luumu_first_seen"));
  return !t || Date.now() - t < NEW_USER_DAYS * 86_400_000;
}

export function anonymousId(): string {
  let id = get(ls(), "luumu_anon");
  if (!id) {
    id = rand();
    set(ls(), "luumu_anon", id);
  }
  return id;
}

export const newRunId = rand;

/* tour em andamento: sobrevive a navegação com reload (app multipágina) */
export interface ActiveTourState {
  id: string;
  v: number;
  index: number;
  run: string;
  preview?: boolean;
  startedAt: number;
}
const ACTIVE = "luumu_tour_active";
export function readActive(): ActiveTourState | null {
  try {
    const s = JSON.parse(get(ss(), ACTIVE) || "null") as ActiveTourState | null;
    // estado velho (aba esquecida no meio de um tour) não retoma
    return s && Date.now() - s.startedAt < 2 * 3600_000 ? s : null;
  } catch {
    return null;
  }
}
export const writeActive = (s: ActiveTourState) => set(ss(), ACTIVE, JSON.stringify(s));
export const clearActive = () => del(ss(), ACTIVE);

/* tokens de builder/preview vindos do painel (?luumu_builder= / ?luumu_preview=) */
export const readSession = (k: string) => get(ss(), k);
export const writeSession = (k: string, v: string) => set(ss(), k, v);
export const clearSession = (k: string) => del(ss(), k);
