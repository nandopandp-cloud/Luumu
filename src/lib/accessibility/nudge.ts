/**
 * Plugin de Acessibilidade — quando o convite pode aparecer de novo para o mesmo estudante.
 *
 * Módulo PURO (o SDK guarda a memória no localStorage e pergunta aqui). Regra geral: quem já
 * usa algum recurso não precisa ser convidado; quem aceitou nunca mais vê o convite.
 */
import type { NudgeFrequency } from "./config";

export interface NudgeMemo {
  /** último desfecho: exibido (sem resposta), aceito ou dispensado */
  s: "shown" | "accepted" | "dismissed";
  at: number;
}

export const NUDGE_RETRY_MS = 7 * 24 * 60 * 60 * 1000;

export function nudgeDue(
  frequency: NudgeFrequency,
  memo: NudgeMemo | null,
  ctx: { now: number; shownThisSession: boolean; activeAdjustments: number }
): boolean {
  if (ctx.activeAdjustments > 0) return false;
  if (memo?.s === "accepted") return false;
  if (frequency === "once") return !memo;
  if (frequency === "every_session") return !ctx.shownThisSession;
  // until_accepted: volta depois de uma semana, nunca duas vezes na mesma sessão
  if (ctx.shownThisSession) return false;
  return !memo || ctx.now - memo.at >= NUDGE_RETRY_MS;
}

export function parseNudgeMemo(raw: unknown): NudgeMemo | null {
  const o = raw as NudgeMemo | null;
  if (!o || typeof o !== "object" || typeof o.at !== "number") return null;
  return o.s === "shown" || o.s === "accepted" || o.s === "dismissed" ? { s: o.s, at: o.at } : null;
}
