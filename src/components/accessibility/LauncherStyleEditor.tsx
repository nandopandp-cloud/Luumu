"use client";

import { Accessibility, Check, Hand, ScanFace } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field } from "@/components/ui/Input";
import { LAUNCHER_PRESETS, readableOn, shade, type A11yConfig, type LauncherColors } from "@/lib/accessibility/config";
import { ColorField, ToggleRow } from "./controls";

type Patch = (fn: (c: A11yConfig) => A11yConfig) => void;

const MAIN_PRESETS = ["#5B3DF5", "#4F46E5", "#6B2BD9", "#0E7490", "#0F766E", "#15803D", "#E11D48", "#F59E0B"];
const BUTTON_PRESETS = ["#2B2E3B", "#374151", "#1E293B", "#F1F2F8", "#E4DEFF", "#E2E8F0"];
const ICON_PRESETS = ["#FFFFFF", "#F9FAFB", "#1F2340", "#3B2A8C", "#0F172A"];

/**
 * Miniatura da cápsula com as cores escolhidas (mesmas contas do SDK em
 * sdk/accessibility/widget.ts → launcherVars). A prévia ao lado mostra a real.
 */
export function LauncherMini({ colors, accent, size = 1, expanded = true }: { colors: LauncherColors; accent: string; size?: number; expanded?: boolean }) {
  const main = colors.main || accent;
  // mesmas contas do SDK: o contorno sutil dos atalhos segue o fundo das dicas (estilo pronto)
  const dark = readableOn(colors.surface) === "#FFFFFF";
  const btn = (n: number) => n * size;
  const circle = (bg: string, fg: string, Icon: React.ElementType, isMain = false) => (
    <span
      className="grid place-items-center rounded-full"
      style={{
        width: btn(isMain ? 40 : 36),
        height: btn(isMain ? 40 : 36),
        color: fg,
        background: bg,
        boxShadow: isMain
          ? `inset 0 0 0 2px ${shade(main, 0.42)}, 0 0 14px ${main}8C, 0 6px 14px rgba(15,17,40,.25)`
          : `inset 0 0 0 1px ${dark ? "rgba(255,255,255,.09)" : "rgba(15,23,42,.09)"}, 0 6px 14px rgba(15,17,40,.25)`,
      }}
    >
      <Icon style={{ width: btn(isMain ? 20 : 17), height: btn(isMain ? 20 : 17) }} strokeWidth={2.3} />
    </span>
  );
  return (
    <span className="relative inline-flex flex-col items-center" style={{ gap: btn(9) }}>
      {circle(`linear-gradient(180deg, ${shade(main, 0.22)}, ${main} 48%, ${shade(main, -0.22)})`, readableOn(main), Accessibility, true)}
      {expanded && circle(`linear-gradient(180deg, ${shade(colors.button, dark ? 0.1 : 0.4)}, ${shade(colors.button, dark ? -0.18 : -0.05)})`, colors.icon, Hand)}
      {expanded && circle(`linear-gradient(180deg, ${shade(colors.button, dark ? 0.1 : 0.4)}, ${shade(colors.button, dark ? -0.18 : -0.05)})`, colors.icon, ScanFace)}
    </span>
  );
}

/** Estilo da cápsula de atalhos: estilos prontos + cada cor ajustável. */
export function LauncherStyleEditor({ config, patch }: { config: A11yConfig; patch: Patch }) {
  const c = config.launcher.colors;
  const set = (p: Partial<LauncherColors>) => patch((cfg) => ({ ...cfg, launcher: { ...cfg.launcher, colors: { ...cfg.launcher.colors, ...p } } }));
  const presetOn = (p: (typeof LAUNCHER_PRESETS)[number]) =>
    p.colors.surface.toUpperCase() === c.surface.toUpperCase() && p.colors.button.toUpperCase() === c.button.toUpperCase() && p.colors.icon.toUpperCase() === c.icon.toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      <Field label="Estilo dos atalhos" hint="Só o botão de acessibilidade fica à vista; ao passar o mouse aparecem Libras e Navegação por rosto.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Estilo pronto dos atalhos">
          {LAUNCHER_PRESETS.map((p) => {
            const on = presetOn(p);
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set(p.colors)}
                className={cn("relative flex flex-col items-center gap-2 rounded-xl border p-3 transition", on ? "border-accent bg-surface-brand" : "border-line hover:border-line-strong")}
              >
                {on && (
                  <span className="absolute right-2 top-2 grid size-4 place-items-center rounded-full bg-accent text-white">
                    <Check className="size-3" />
                  </span>
                )}
                <span className="grid h-[150px] w-full place-items-center rounded-lg bg-[repeating-linear-gradient(45deg,var(--bg-sunken)_0_8px,transparent_8px_16px)]">
                  <LauncherMini colors={{ ...p.colors, main: c.main }} accent={config.brand.accent} size={0.8} />
                </span>
                <span className="text-xs font-semibold">{p.label}</span>
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid gap-4 rounded-2xl border border-line p-4">
        <div className="flex flex-col gap-2">
          <ToggleRow
            title="Botão principal na cor de destaque"
            description="Acompanha a cor de destaque da marca (Marca do painel). Desligue para escolher outra."
            checked={!c.main}
            onChange={(on) => set({ main: on ? "" : config.brand.accent })}
          />
          {c.main && <ColorField label="Botão principal" value={c.main} onChange={(main) => set({ main })} presets={MAIN_PRESETS} />}
        </div>
        <Field label="Botões de atalho">
          <ColorField label="Botões de atalho" value={c.button} onChange={(button) => set({ button })} presets={BUTTON_PRESETS} />
        </Field>
        <Field label="Ícones dos atalhos" hint={iconContrastHint(c)}>
          <ColorField label="Ícones dos atalhos" value={c.icon} onChange={(icon) => set({ icon })} presets={ICON_PRESETS} />
        </Field>
      </div>
    </div>
  );
}

/** Aviso de contraste baixo entre ícone e botão (WCAG pede 3:1 para ícones). */
function iconContrastHint(c: LauncherColors): string | undefined {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  };
  const [a, b] = [lum(c.icon), lum(c.button)].sort((x, y) => y - x);
  const ratio = (a + 0.05) / (b + 0.05);
  return ratio < 3 ? `Contraste baixo entre ícone e botão (${ratio.toFixed(1)}:1). Para quem tem baixa visão, use pelo menos 3:1.` : undefined;
}
