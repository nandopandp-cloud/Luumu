/*
  Seletores CSS colados pelo cliente (Configurações → SDK & Eventos → Seletores CSS). PURO e
  testado; usado no card (ao colar) e no servidor (ao salvar).

  O "Copiar seletor" do navegador costuma começar por um ID gerado pelo React/Radix
  (#radix-_r_9_, #radix-\:r9\:, #_r_3_) que MUDA entre telas e a cada versão do produto — salvo
  assim, o seletor parava de funcionar. O ID do Radix é sempre o do botão que abre um menu, que o
  próprio Radix marca com aria-haspopup="menu": trocamos um pelo outro.
*/

// ID gerado: tudo depois de "#radix-" (ou "#_r…"/"#\:r…") até o próximo espaço, combinador, classe ou atributo
const RADIX_ID = /#radix-[^\s>+~.[]+/gi;
const REACT_ID = /#(?:\\:|_)r[^\s>+~.[]*/gi;

export function stabilizeSelector(raw: string): { value: string; changed: boolean } {
  const s = raw.replace(/\s+/g, " ").trim();
  const value = s.replace(RADIX_ID, '[aria-haspopup="menu"]').replace(REACT_ID, "").replace(/^\s*>\s*/, "").trim();
  return { value, changed: value !== s };
}

/**
 * Seletor aceito: curto e sem nada que pareça código ou marcação. `>` (filho), `+` e `~` são
 * combinadores CSS válidos e PRECISAM passar — só `<` indica HTML.
 */
export function isSafeSelector(s: string): boolean {
  return s.length > 0 && s.length <= 300 && !/[<{};`]|javascript:|expression\(/i.test(s);
}

export type CaptureMode = "auto" | "selectors";
export interface CaptureRule {
  /** '' = padrão para todas as plataformas do projeto */
  host: string;
  mode: CaptureMode;
  nameSelector: string;
  avatarSelector: string;
}

/**
 * Seletores que valem numa plataforma: a regra DELA, senão o padrão do projeto (host ''), senão
 * detecção automática ({ n: "", a: "" }). Cada produto tem seu HTML — Geniex ≠ Exploradores.
 */
export function resolveCaptureRule(rules: CaptureRule[], host: string): { n: string; a: string } {
  const rule = (host ? rules.find((r) => r.host === host) : undefined) ?? rules.find((r) => r.host === "");
  if (!rule || rule.mode === "auto") return { n: "", a: "" };
  return { n: rule.nameSelector, a: rule.avatarSelector };
}
