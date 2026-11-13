/*
  Lado do widget (sdk-a11y.js) do intérprete Luumu (beta): baixa public/sdk-libras3d.js — Three.js
  e os personagens — só quando o estudante abre Libras, e cria a janela do intérprete
  (libras3d/player.ts). Mesmo contrato de libras.ts (VLibras): show/hide/update/destroy.
*/
import type { PublicA11yConfig } from "../../lib/accessibility/config";
import type { Libras } from "./libras";
import type { Libras3dOptions, Libras3dPlayer } from "./libras3d/player";

declare const __LIBRAS3D_VERSION__: string | undefined;
const VERSION = typeof __LIBRAS3D_VERSION__ === "string" ? __LIBRAS3D_VERSION__ : "dev";
type Factory = { create(o: Libras3dOptions): Libras3dPlayer };
const W = () => window as unknown as { __luumuLibras3d?: Factory };

export function interpreterLogoUrl(cfg: PublicA11yConfig): string {
  const look = cfg.libras.look;
  if (look.logo === "brand") return cfg.brand.logoUrl;
  if (look.logo === "custom") return look.logoUrl;
  return "";
}

export function createLuumuLibras(
  cfg0: PublicA11yConfig,
  launcherSide: "left" | "right",
  opts: { onClosed: () => void; onUnavailable: () => void },
  ctx: { api: string; preview: boolean }
): Libras {
  let cfg = cfg0;
  let side: "left" | "right" = launcherSide === "right" ? "left" : "right"; // longe dos botões da Luumu
  let wantOpen = false;
  let player: Libras3dPlayer | null = null;
  let loading: Promise<Factory | null> | null = null;
  const origin = ctx.api.replace(/\/api\/v1\/?$/, "");

  function load(): Promise<Factory | null> {
    if (W().__luumuLibras3d) return Promise.resolve(W().__luumuLibras3d!);
    if (loading) return loading;
    loading = new Promise<Factory | null>((resolve) => {
      const s = document.createElement("script");
      s.src = `${origin}/sdk-libras3d.js?v=${encodeURIComponent(VERSION)}`;
      s.async = true;
      s.setAttribute("data-luumu-ui", "a11y-libras3d-script");
      s.onload = () => resolve(W().__luumuLibras3d || null);
      s.onerror = () => resolve(null);
      (document.head || document.documentElement).appendChild(s);
    });
    loading.then((f) => {
      if (!f) loading = null;
    });
    return loading;
  }

  function close() {
    wantOpen = false;
    player?.destroy();
    player = null;
  }

  return {
    get visible() {
      return wantOpen;
    },
    show() {
      if (wantOpen) return;
      wantOpen = true;
      void load().then((f) => {
        if (!wantOpen || player) return;
        if (!f) {
          wantOpen = false;
          return opts.onUnavailable();
        }
        try {
          player = f.create({
            origin,
            api: ctx.api,
            look: cfg.libras.look,
            logoUrl: interpreterLogoUrl(cfg),
            side,
            preview: ctx.preview,
            onClose: () => {
              close();
              opts.onClosed();
            },
            onError: () => {
              close();
              opts.onUnavailable();
            },
          });
        } catch {
          // sem WebGL (navegador antigo ou aceleração desligada)
          close();
          opts.onUnavailable();
        }
      });
    },
    hide() {
      close();
    },
    update(next, nextSide) {
      cfg = next;
      side = nextSide === "right" ? "left" : "right";
      player?.update(cfg.libras.look, interpreterLogoUrl(cfg), side);
    },
    destroy() {
      close();
    },
  };
}
