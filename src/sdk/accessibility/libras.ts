/*
  Libras no produto do cliente pelo VLibras Widget (gov.br), versão 7.

  Integração conforme https://www.vlibras.gov.br/doc/widget/installation/webpageintegration.html
  e o próprio loader (vlibras-plugin.js):
   - a configuração vai em `window.VLibrasWidget` ANTES do script carregar (o loader faz
     Object.assign com o que já existir): avatar, posição (L/R) e, se o cliente for parceiro
     aprovado, o endereço de personalização;
   - `window.VLibrasWidget.open()` abre o tradutor; `#vlibras-app-root[data-active]` diz se
     ele está aberto (o próprio app observa esse atributo, então fechar é voltá-lo para false);
   - com o tradutor aberto, o estudante clica num texto e o VLibras traduz (seleção e foco
     também funcionam). Não há API pública para mandar um texto, nem precisamos.

  O botão flutuante do VLibras é escondido quando FOMOS nós que o carregamos: o estudante já
  tem o botão "Libras" da Luumu. Se o site do cliente já tinha o VLibras instalado, o botão
  dele fica onde está e só reaproveitamos o tradutor.

  Sem o VLibras disponível (rede, CSP do site sem vlibras.gov.br no frame-src), o estudante
  recebe um aviso e o recurso volta a ficar desligado.
*/
import { VLIBRAS_SCRIPT } from "../../lib/accessibility/vlibras";
import type { PublicA11yConfig } from "../../lib/accessibility/config";

type VWidget = {
  path?: string;
  avatar?: string;
  position?: string;
  personalization?: string;
  open?: () => void;
  access?: HTMLElement;
  initBtn?: HTMLElement;
};
const W = () => window as unknown as { VLibrasWidget?: VWidget; VLibras?: { Widget?: unknown } };

const APP_ROOT = "vlibras-app-root";
const LOAD_TIMEOUT_MS = 8000;

export interface Libras {
  show(): void;
  hide(): void;
  update(cfg: PublicA11yConfig, side: "left" | "right"): void;
  readonly visible: boolean;
  destroy(): void;
}

export function createLibras(
  cfg0: PublicA11yConfig,
  side0: "left" | "right",
  opts: { onClosed: () => void; onUnavailable: () => void }
): Libras {
  let cfg = cfg0;
  let side = side0;
  let ownScript = false;
  let loading: Promise<boolean> | null = null;
  let observer: MutationObserver | null = null;
  let wantOpen = false;

  const preinstalled = () => !!document.getElementById("vlibras-access-wrapper") || !!W().VLibras?.Widget;
  const root = () => document.getElementById(APP_ROOT);
  const isOpen = () => root()?.getAttribute("data-active") === "true";

  function configure() {
    const w = W();
    w.VLibrasWidget = Object.assign(w.VLibrasWidget || {}, {
      avatar: cfg.libras.avatar,
      // o tradutor abre do lado oposto ao dos botões da Luumu, para não cobri-los
      position: side === "right" ? "L" : "R",
      personalization: cfg.libras.personalizationUrl || undefined,
    });
  }

  function waitFor<T>(get: () => T | null | undefined, ms: number): Promise<T | null> {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const v = get();
        if (v) return resolve(v);
        if (Date.now() - start > ms) return resolve(null);
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  function load(): Promise<boolean> {
    if (loading) return loading;
    if (preinstalled() && W().VLibrasWidget?.open) return (loading = Promise.resolve(true));
    configure();
    ownScript = !preinstalled();
    loading = new Promise<boolean>((resolve) => {
      if (!ownScript) return resolve(true);
      const s = document.createElement("script");
      s.src = VLIBRAS_SCRIPT;
      s.async = true;
      s.setAttribute("data-luumu-ui", "a11y-vlibras");
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      (document.head || document.documentElement).appendChild(s);
    }).then(async (ok) => {
      if (!ok) return false;
      // o loader monta o botão ~50ms depois e só então expõe open()
      const w = await waitFor(() => (W().VLibrasWidget?.open ? W().VLibrasWidget : null), LOAD_TIMEOUT_MS);
      if (!w) return false;
      if (ownScript && w.access) w.access.style.display = "none";
      return true;
    });
    loading.then((ok) => {
      if (!ok) loading = null; // tenta de novo na próxima vez
    });
    return loading;
  }

  /** O estudante fechou pelo próprio VLibras: avisa o widget para desligar o recurso. */
  async function watch() {
    if (observer) return;
    const el = await waitFor(root, LOAD_TIMEOUT_MS * 2);
    if (!el || observer) return;
    observer = new MutationObserver(() => {
      if (wantOpen && !isOpen()) {
        wantOpen = false;
        opts.onClosed();
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-active"] });
  }

  return {
    get visible() {
      return wantOpen;
    },
    show() {
      if (wantOpen) return;
      wantOpen = true;
      void load().then((ok) => {
        if (!ok) {
          wantOpen = false;
          opts.onUnavailable();
          return;
        }
        if (!wantOpen) return;
        W().VLibrasWidget?.open?.();
        void watch();
      });
    },
    hide() {
      wantOpen = false;
      const el = root();
      if (el && el.getAttribute("data-active") === "true") el.setAttribute("data-active", "false");
    },
    update(next, nextSide) {
      cfg = next;
      side = nextSide;
      // avatar e personalização são lidos pelo VLibras ao abrir: valem a partir do próximo carregamento
      if (!loading) configure();
    },
    destroy() {
      this.hide();
      observer?.disconnect();
      observer = null;
      const w = W().VLibrasWidget;
      if (ownScript && w?.access) w.access.style.display = "";
    },
  };
}
