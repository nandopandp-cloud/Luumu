/*
  Product Discovery Engine — roda SÓ em modo builder (aba do administrador).
  Encontra os elementos relevantes para interação da tela atual e os descreve de forma
  resiliente. Não percorre o DOM inteiro: parte de um seletor de candidatos interativos.
  Ver docs/tours/ARQUITETURA.md §5.
*/
import type { ElementTarget } from "../../lib/tours/types";
import { describeElement, INTERACTIVE_SELECTOR, isLuumuNode, isVisible } from "../shared/dom";

const MAX_PER_ROUTE = 300;
const MAX_SCAN = 2500;

export interface DiscoveryResult {
  route: string;
  title: string;
  elements: ElementTarget[];
}

export function discover(): DiscoveryResult {
  const nodes = document.querySelectorAll(INTERACTIVE_SELECTOR);
  const chosen: Element[] = [];
  for (let i = 0; i < nodes.length && i < MAX_SCAN && chosen.length < MAX_PER_ROUTE; i++) {
    const el = nodes[i];
    if (isLuumuNode(el) || !isVisible(el)) continue;
    // o ícone dentro do botão não é um elemento à parte: fica o candidato mais externo
    const parent = el.parentElement?.closest(INTERACTIVE_SELECTOR);
    if (parent && !isLuumuNode(parent) && isVisible(parent) && !el.hasAttribute("data-luumu-id")) continue;
    chosen.push(el);
  }
  const seen = new Set<string>();
  const elements: ElementTarget[] = [];
  for (const el of chosen) {
    try {
      const t = describeElement(el);
      if (seen.has(t.fingerprint)) continue;
      seen.add(t.fingerprint);
      elements.push(t);
    } catch {}
  }
  return { route: location.pathname, title: document.title.slice(0, 160), elements };
}
