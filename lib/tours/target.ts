/*
  Identificação resiliente de elementos — parte PURA (sem DOM), testável e compartilhada.
  O lado com DOM (montar o descritor, buscar candidatos) fica em sdk/tours/resolve.ts e
  sdk/builder/discovery.ts; ambos reduzem um elemento a um `CandidateInfo` e usam as
  funções daqui. Ver docs/tours/ARQUITETURA.md §6.
*/
import type { ElementKind, ElementTarget, TargetStrategy } from "./types";

/** O que se consegue ler de um elemento, já reduzido a strings. */
export interface CandidateInfo {
  luumuId?: string;
  elementId?: string;
  testId?: string;
  ariaLabel?: string;
  role?: string;
  tag: string;
  text?: string;
  name?: string;
  href?: string;
  classes?: string[];
  path?: string;
}

/** Texto comparável: sem acento, minúsculo, espaços colapsados, números genéricos. */
export function normalizeText(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/*
  ids gerados pelo framework mudam a cada render/deploy e não podem identificar nada:
  React useId (":r1:", "«r3»"), Radix/Headless UI/MUI ("radix-:r2:", "headlessui-menu-button-3",
  "mui-12"), Ember ("ember123"), hashes e sequências numéricas longas.
*/
export function isStableId(id: string | undefined | null): boolean {
  if (!id || id.length > 80) return false;
  if (/[:«»]/.test(id)) return false;
  if (/^(radix|headlessui|mui|ember|react-select|downshift|rc-|ant-|el-id|v-)\b/i.test(id)) return false;
  if (/\d{3,}/.test(id)) return false;
  if (/[a-f0-9]{8,}/i.test(id) && /\d/.test(id)) return false;
  return /^[a-zA-Z][\w-]*$/.test(id);
}

/*
  Classes que valem como sinal: nomes escritos por gente ("sidebar-link", "btn-primary").
  Fora: CSS-in-JS e CSS Modules (hash), utilitárias de estado e de layout que mudam com a
  interação, e qualquer coisa com sequência numérica.
*/
const STATE_CLASS = /^(is-|has-|js-)|^(active|selected|open|opened|closed|hover|focus|focused|disabled|show|hidden|visible|collapsed|expanded|current)$/i;
export function isStableClass(c: string): boolean {
  if (!c || c.length < 3 || c.length > 40) return false;
  if (/^(sc-|css-|jsx-|svelte-|emotion-|tw-|ng-|_)/i.test(c)) return false;
  // CSS Modules ("Button_root__x7f2a", "card_a1b2c"): o sufixo de hash tem dígito — o BEM
  // legítimo ("nav__item") não, e continua valendo como sinal
  if (/__(?=[a-z0-9]*\d)[a-z0-9]{4,}$/i.test(c) || /_(?=[a-z0-9]*\d)[a-z0-9]{5}$/i.test(c)) return false;
  if (/[[\]:/!@]/.test(c)) return false; // tailwind arbitrário, variantes (hover:, md:), importantes
  if (/\d{2,}/.test(c)) return false;
  if (STATE_CLASS.test(c)) return false;
  // sequência aleatória sem separador e com caixa mista ("aBcDeF") = hash
  if (!/[-_]/.test(c) && /[a-z]/.test(c) && /[A-Z]/.test(c) && c.length >= 6) return false;
  return /^[a-zA-Z][\w-]*$/.test(c);
}

/** Hash curto e determinístico (djb2) para o fingerprint. */
export function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Fingerprint: o que descreve o elemento sem depender de posição ou classes. */
export function fingerprintOf(info: CandidateInfo, landmark = ""): string {
  return hash(
    [info.tag, info.role ?? "", normalizeText(info.text), normalizeText(info.ariaLabel), info.name ?? "", info.href ?? "", landmark].join("|")
  );
}

/** Melhor estratégia disponível para o descritor (ordem de prioridade do briefing). */
export function bestStrategy(info: CandidateInfo): TargetStrategy {
  if (info.luumuId) return "luumu-id";
  if (info.elementId && isStableId(info.elementId)) return "element-id";
  if (info.testId) return "test-id";
  if (info.ariaLabel) return "aria-label";
  if (info.text) return "text";
  if (info.path) return "path";
  return "fingerprint";
}

const STABILITY: Record<TargetStrategy, number> = {
  "luumu-id": 1,
  "element-id": 0.9,
  "test-id": 0.9,
  "aria-label": 0.8,
  text: 0.7,
  path: 0.55,
  fingerprint: 0.45,
  selector: 0.3,
};

/** Estabilidade estimada (0–1): base da estratégia + bônus por sinais redundantes. */
export function stabilityOf(info: CandidateInfo): number {
  const base = STABILITY[bestStrategy(info)];
  const extras = [info.ariaLabel, info.text, info.testId, info.href, info.name].filter(Boolean).length;
  return Math.min(1, Math.round((base + Math.max(0, extras - 1) * 0.03) * 100) / 100);
}

export function kindOf(tag: string, role: string | undefined, inNavigation: boolean, type?: string): ElementKind {
  const r = (role || "").toLowerCase();
  if (r === "tab") return "tab";
  if (r === "menuitem" || r === "menu") return "menu";
  if (tag === "a" || r === "link") return inNavigation ? "navigation" : "link";
  if (tag === "select" || r === "combobox" || r === "listbox") return "select";
  if (tag === "input" || tag === "textarea") return type === "submit" || type === "button" ? "button" : "input";
  if (tag === "button" || r === "button" || r === "switch" || r === "checkbox") return inNavigation ? "navigation" : "button";
  if (r === "article" || tag === "article") return "card";
  return "other";
}

/** Pontuação mínima para aceitar um candidato como o alvo. */
export const MIN_SCORE = 30;

/**
 * Quanto um candidato do DOM se parece com o alvo gravado. Soma de sinais independentes:
 * se o texto mudar, o aria-label e o href seguram; se as classes mudarem, o texto segura.
 * `data-luumu-id` decide sozinho (casar = aceito; divergir = recusado).
 */
export function scoreCandidate(target: ElementTarget, c: CandidateInfo, landmark = ""): number {
  if (target.luumuId) return c.luumuId === target.luumuId ? 1000 : c.luumuId ? -1000 : scoreSignals(target, c, landmark) - 20;
  return scoreSignals(target, c, landmark);
}

function scoreSignals(t: ElementTarget, c: CandidateInfo, landmark: string): number {
  let s = 0;
  if (t.elementId && c.elementId === t.elementId && isStableId(t.elementId)) s += 45;
  if (t.testId && c.testId === t.testId) s += 45;
  if (t.ariaLabel) {
    const a = normalizeText(t.ariaLabel);
    const b = normalizeText(c.ariaLabel);
    if (a && a === b) s += 30;
  }
  if (t.text) {
    const a = normalizeText(t.text);
    const b = normalizeText(c.text);
    if (a && a === b) s += 30;
    else if (a && b && (b.includes(a) || a.includes(b)) && Math.min(a.length, b.length) >= 4) s += 14;
  }
  if (t.name && c.name === t.name) s += 18;
  if (t.href && c.href === t.href) s += 18;
  if (t.tag === c.tag) s += 6;
  else s -= 10;
  if (t.role && c.role === t.role) s += 5;
  if (t.classes?.length && c.classes?.length) {
    const overlap = t.classes.filter((k) => c.classes!.includes(k)).length;
    s += Math.min(12, overlap * 4);
  }
  if (t.path && c.path === t.path) s += 10;
  if (t.fingerprint && fingerprintOf(c, landmark) === t.fingerprint) s += 25;
  return s;
}

/**
 * A rota atual casa com o padrão do passo? "/projects/:id" casa "/projects/42";
 * "/projects/*" casa qualquer coisa abaixo de /projects; barra final é ignorada.
 */
export function routeMatches(pattern: string | null | undefined, pathname: string): boolean {
  if (!pattern) return true;
  const clean = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  const a = clean(pattern).split("/").filter(Boolean);
  const b = clean(pathname).split("/").filter(Boolean);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "*") return true;
    if (i >= b.length) return false;
    if (a[i].startsWith(":")) continue;
    if (decodeURIComponent(a[i]).toLowerCase() !== decodeURIComponent(b[i]).toLowerCase()) return false;
  }
  return a.length === b.length;
}

/** Rótulo legível do alvo para o painel. */
export function targetLabel(t: Pick<ElementTarget, "label" | "text" | "ariaLabel" | "tag">): string {
  return t.label || t.ariaLabel || t.text || `<${t.tag}>`;
}

export const STRATEGY_LABEL: Record<TargetStrategy, string> = {
  "luumu-id": "data-luumu-id",
  "element-id": "ID do elemento",
  "test-id": "data-testid",
  "aria-label": "aria-label",
  text: "Texto do elemento",
  path: "Estrutura da página",
  fingerprint: "Impressão digital",
  selector: "Seletor CSS",
};
