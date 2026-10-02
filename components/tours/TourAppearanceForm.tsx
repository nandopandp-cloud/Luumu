"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Monitor, Smartphone, Tablet } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { SegmentedControl } from "@/components/ui/Tabs";
import { Mascot } from "@/components/ui/Mascot";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { Device, TourAppearance, TourSettings, TourStep, TourTheme } from "@/lib/tours/types";
import { saveTourDraftAction } from "@/app/(app)/tours/actions";
import { StepCanvas } from "./StepCanvas";

const THEMES: { value: TourTheme; label: string; swatch: React.ReactNode }[] = [
  { value: "luumu", label: "Padrão Luumu", swatch: <Mascot name="Feliz" size={44} /> },
  {
    value: "minimal",
    label: "Minimalista",
    swatch: (
      <span className="flex w-16 flex-col gap-1.5 rounded-lg border border-line bg-white p-2">
        <i className="h-1.5 w-10 rounded bg-gray-300" />
        <i className="h-3 w-full rounded bg-gray-900" />
      </span>
    ),
  },
  {
    value: "dark",
    label: "Escuro",
    swatch: (
      <span className="flex w-16 flex-col gap-1.5 rounded-lg bg-[#14162A] p-2">
        <i className="h-1.5 w-10 rounded bg-white/40" />
        <i className="h-3 w-full rounded bg-[#8B5CF6]" />
      </span>
    ),
  },
  {
    value: "custom",
    label: "Personalizado",
    swatch: (
      <span className="flex w-16 flex-col gap-1.5 rounded-lg border border-line bg-white p-2">
        <i className="h-1.5 w-10 rounded bg-gray-300" />
        <i className="h-3 w-full rounded [background:var(--grad-marca)]" />
      </span>
    ),
  },
];

export function TourAppearanceForm({ tourId, settings, steps }: { tourId: string; settings: TourSettings; steps: TourStep[] }) {
  const [ap, setAp] = useState<TourAppearance>(settings.appearance);
  const [device, setDevice] = useState<Device>("desktop");
  const visible = steps.filter((s) => s.enabled);
  // abre num passo com alvo (mostra seta e destaque), se houver
  const [index, setIndex] = useState(Math.max(0, visible.findIndex((s) => s.type !== "modal")));
  const [saving, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const set = (patch: Partial<TourAppearance>) => setAp((cur) => ({ ...cur, ...patch }));
  const total = visible.length;
  const onAction = useCallback(
    (a: "next" | "back" | "close") =>
      setIndex((i) => (a === "next" ? Math.min(total - 1, i + 1) : a === "back" ? Math.max(0, i - 1) : i)),
    [total]
  );

  function save() {
    start(async () => {
      const res = await saveTourDraftAction({ id: tourId, settings: { ...settings, appearance: ap } });
      if (!res.ok) return toast("error", res.error);
      setSaved(true);
      toast("success", "Aparência salva no rascunho.");
      setTimeout(() => setSaved(false), 1800);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardTitle>Aparência do tour</CardTitle>
        <p className="mt-1 text-sm text-fg-mut">Vale para todos os passos. O card fica isolado do CSS do seu produto.</p>

        <div className="mt-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tema">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={ap.theme === t.value}
              onClick={() => set({ theme: t.value })}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-xl border p-3 transition",
                ap.theme === t.value ? "border-accent bg-surface-brand/60" : "border-line hover:border-line-strong"
              )}
            >
              {ap.theme === t.value && (
                <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-accent text-white">
                  <Check className="size-3" />
                </span>
              )}
              <span className="grid h-12 place-items-center">{t.swatch}</span>
              <span className="text-xs font-semibold">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-4">
          {ap.theme !== "minimal" && (
            <Field label="Cor principal">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={ap.accent}
                  onChange={(e) => set({ accent: e.target.value, theme: ap.theme === "luumu" && e.target.value !== "#6B2BD9" ? "custom" : ap.theme })}
                  className="size-10 cursor-pointer rounded-lg border border-line bg-transparent"
                  aria-label="Cor principal"
                />
                <Input
                  value={ap.accent}
                  onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && set({ accent: e.target.value })}
                  className="w-28 font-mono text-sm"
                  aria-label="Cor em hexadecimal"
                />
              </div>
            </Field>
          )}
          <Field label="Progresso">
            <Select value={ap.progress} onChange={(e) => set({ progress: e.target.value as TourAppearance["progress"] })}>
              <option value="count">Contador (2 de 6)</option>
              <option value="dots">Barras (● ● ○ ○)</option>
              <option value="none">Não mostrar</option>
            </Select>
          </Field>
          <div className="flex flex-col gap-3 rounded-xl bg-bg-sunken p-3.5">
            <label className="flex items-center justify-between gap-3 text-sm font-medium text-fg-soft">
              Permitir fechar (botão × e ESC)
              <Switch checked={ap.allowDismiss} onChange={(v) => set({ allowDismiss: v })} label="Permitir fechar" />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm font-medium text-fg-soft">
              Confete ao concluir o tour
              <Switch checked={ap.confetti} onChange={(v) => set({ confetti: v })} label="Confete ao concluir" />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm font-medium text-fg-soft">
              Link “Não mostrar novamente”
              <Switch checked={ap.dontShowAgain} onChange={(v) => set({ dontShowAgain: v })} label="Não mostrar novamente" />
            </label>
          </div>
          <Field label={`Escurecimento do fundo · ${Math.round(ap.backdropOpacity * 100)}%`}>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.05}
              value={ap.backdropOpacity}
              onChange={(e) => set({ backdropOpacity: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
              aria-label="Escurecimento do fundo"
            />
          </Field>
          <Field label={`Arredondamento · ${ap.radius}px`}>
            <input
              type="range"
              min={0}
              max={28}
              step={2}
              value={ap.radius}
              onChange={(e) => set({ radius: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
              aria-label="Arredondamento"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
            {saved ? "Salvo" : "Salvar aparência"}
          </Button>
        </div>
      </Card>

      <Card className="h-fit min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Pré-visualização</CardTitle>
            <p className="text-xs text-fg-mut">Clique em Próximo/Voltar no card para passar pelos passos.</p>
          </div>
          <SegmentedControl<Device>
            size="sm"
            value={device}
            onChange={setDevice}
            options={[
              { value: "desktop", label: "Desktop", icon: <Monitor className="size-3.5" /> },
              { value: "tablet", label: "Tablet", icon: <Tablet className="size-3.5" /> },
              { value: "mobile", label: "Mobile", icon: <Smartphone className="size-3.5" /> },
            ]}
          />
        </div>
        <StepCanvas
          steps={visible}
          index={visible.length ? index : -1}
          appearance={ap}
          device={device}
          url={settings.startUrl}
          onAction={onAction}
        />
      </Card>
    </div>
  );
}
