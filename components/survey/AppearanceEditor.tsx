"use client";

import { useState, useTransition } from "react";
import {
  PanelBottomOpen, SquareStack, Rows3, GalleryVerticalEnd,
  Check, Loader2, Monitor, Smartphone, Sun, Moon, Contrast,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  positionsByFormat, type Appearance, type BuilderQuestion,
  type WidgetFormat, type WidgetPosition, type WidgetTheme,
} from "@/lib/builder";
import { SurveyWidget, WidgetStage } from "./SurveyWidget";
import { saveAppearanceAction } from "@/app/(app)/surveys/actions";

const formats: { value: WidgetFormat; label: string; icon: React.ElementType; hint: string }[] = [
  { value: "popup", label: "Popup", icon: SquareStack, hint: "Cartão no canto" },
  { value: "slider", label: "Slider", icon: PanelBottomOpen, hint: "Desliza da borda" },
  { value: "modal", label: "Modal", icon: GalleryVerticalEnd, hint: "Centralizado" },
  { value: "bar", label: "Barra", icon: Rows3, hint: "Faixa fina" },
];

const positionLabels: Record<WidgetPosition, string> = {
  "bottom-right": "Inferior direito",
  "bottom-left": "Inferior esquerdo",
  top: "Topo",
  bottom: "Rodapé",
  center: "Centro",
};

const themes: { value: WidgetTheme; label: string; icon: React.ElementType }[] = [
  { value: "auto", label: "Auto", icon: Contrast },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
];

const accentSwatches = ["#6B2BD9", "#7ED957", "#4AA8FF", "#FF8A3D", "#FF4D7D", "#0D0F1A"];

export function AppearanceEditor({
  id,
  surveyName,
  questions,
  initial,
}: {
  id: string;
  surveyName: string;
  questions: BuilderQuestion[];
  initial: Appearance;
}) {
  const [a, setA] = useState<Appearance>(initial);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const toast = useToast();

  function update(patch: Partial<Appearance>) {
    setA((prev) => {
      const nextFormat = patch.format ?? prev.format;
      // corrige posição quando muda de formato
      const allowed = positionsByFormat[nextFormat];
      const position = patch.position ?? (allowed.includes(prev.position) ? prev.position : allowed[0]);
      return { ...prev, ...patch, position };
    });
    setPreviewKey((k) => k + 1);
  }

  function save() {
    startSaving(async () => {
      await saveAppearanceAction(id, a);
      setSaved(true);
      toast("success", "Aparência salva.");
      setTimeout(() => setSaved(false), 1800);
    });
  }

  // preview força o tema escolhido (auto = herda o app)
  const previewTheme = a.theme === "auto" ? undefined : a.theme;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
      {/* Controles */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle>Formato</CardTitle>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {formats.map((f) => {
              const Icon = f.icon;
              const on = a.format === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => update({ format: f.value })}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
                    on ? "border-accent bg-surface-brand" : "border-line hover:border-line-strong"
                  )}
                >
                  <Icon className={cn("size-5", on ? "text-accent" : "text-fg-mut")} />
                  <span className="text-sm font-semibold">{f.label}</span>
                  <span className="text-[11px] text-fg-mut">{f.hint}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardTitle>Posição & tema</CardTitle>
          <div className="mt-3 flex flex-col gap-4">
            <Field label="Posição">
              <div className="flex flex-wrap gap-2">
                {positionsByFormat[a.format].map((pos) => (
                  <button
                    key={pos}
                    onClick={() => update({ position: pos })}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                      a.position === pos ? "border-accent bg-surface-brand text-accent" : "border-line-strong text-fg-soft hover:border-accent"
                    )}
                  >
                    {positionLabels[pos]}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Tema">
              <div className="flex gap-2">
                {themes.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      onClick={() => update({ theme: t.value })}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                        a.theme === t.value ? "border-accent bg-surface-brand text-accent" : "border-line-strong text-fg-soft hover:border-accent"
                      )}
                    >
                      <Icon className="size-3.5" /> {t.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Cor de destaque">
              <div className="flex items-center gap-2">
                {accentSwatches.map((c) => (
                  <button
                    key={c}
                    onClick={() => update({ accent: c })}
                    className={cn("size-7 rounded-full ring-2 ring-offset-2 ring-offset-bg-elev transition", a.accent === c ? "ring-accent" : "ring-transparent")}
                    style={{ background: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
                <Input
                  value={a.accent}
                  onChange={(e) => update({ accent: e.target.value })}
                  className="ml-1 w-28 py-1.5 font-mono text-xs"
                />
              </div>
            </Field>

            <Field label="Atraso para aparecer (segundos)">
              <Input
                type="number"
                min={0}
                value={a.triggerDelay}
                onChange={(e) => update({ triggerDelay: Number(e.target.value) })}
                className="w-24 py-2"
              />
            </Field>
          </div>
        </Card>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
          {saved ? "Salvo" : "Salvar aparência"}
        </Button>
      </div>

      {/* Preview */}
      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-fg-mut">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-erro/60" />
              <span className="size-2.5 rounded-full bg-aviso/60" />
              <span className="size-2.5 rounded-full bg-sucesso/60" />
            </div>
            <span className="ml-2 font-mono">app.seucliente.com</span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-line bg-bg-sunken p-1">
            <button onClick={() => setDevice("desktop")} className={cn("rounded-full p-1.5", device === "desktop" ? "bg-bg-elev text-accent shadow-sm" : "text-fg-mut")} aria-label="Desktop">
              <Monitor className="size-4" />
            </button>
            <button onClick={() => setDevice("mobile")} className={cn("rounded-full p-1.5", device === "mobile" ? "bg-bg-elev text-accent shadow-sm" : "text-fg-mut")} aria-label="Mobile">
              <Smartphone className="size-4" />
            </button>
          </div>
        </div>

        {/* Palco (produto do cliente) */}
        <div
          className={cn(
            "relative mx-auto bg-bg-sunken transition-all",
            device === "mobile" ? "max-w-[380px]" : "w-full"
          )}
          data-theme={previewTheme}
        >
          {/* wireframe leve do produto do cliente */}
          <div className="min-h-[520px] space-y-4 p-8 opacity-60">
            <div className="h-7 w-40 rounded-lg bg-border" />
            <div className="h-32 rounded-2xl bg-border" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-20 rounded-xl bg-border" />
              <div className="h-20 rounded-xl bg-border" />
              <div className="h-20 rounded-xl bg-border" />
            </div>
            <div className="h-24 rounded-2xl bg-border" />
          </div>

          {/* widget real posicionado */}
          <WidgetStage key={previewKey} appearance={a}>
            <SurveyWidget name={surveyName} questions={questions} appearance={a} onClose={() => {}} />
          </WidgetStage>
        </div>
      </Card>
    </div>
  );
}
