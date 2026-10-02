/*
  Decisão de exibição por frequência. PURO: o runtime lê a memória do navegador
  (localStorage/sessionStorage) e pergunta aqui se o tour pode aparecer.
*/
import type { Frequency } from "./types";

/** O que o navegador lembra de um tour (por usuário identificado ou anônimo). */
export interface TourMemory {
  started?: number;
  completed?: number;
  dismissed?: number;
  /** "Não mostrar novamente": vale para qualquer frequência */
  never?: number;
}

export function canShow(freq: Frequency, mem: TourMemory, shownThisSession: boolean): boolean {
  if (mem.never) return false;
  switch (freq) {
    case "always":
      return true;
    case "once_per_session":
      return !shownThisSession;
    case "once":
      return !mem.started;
    case "until_completed":
      return !mem.completed;
    case "until_dismissed":
      return !mem.completed && !mem.dismissed;
    default:
      return false;
  }
}

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  once: "Uma vez (ao iniciar, não aparece de novo)",
  once_per_session: "Uma vez por sessão",
  until_completed: "Até completar",
  until_dismissed: "Até completar ou dispensar",
  always: "Sempre que o gatilho ocorrer",
};
