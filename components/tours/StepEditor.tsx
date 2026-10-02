"use client";

import { useState } from "react";
import { Trash2, Crosshair, MousePointerClick, AlertTriangle, Monitor, Tablet, Smartphone, Sparkles } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { SegmentedControl } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";
import { STEP_TYPE_HINT, STEP_TYPE_LABEL } from "@/lib/tours/defaults";
import { deviceConfig } from "@/lib/tours/normalize";
import { STRATEGY_LABEL } from "@/lib/tours/target";
import { STEP_TYPES, type Device, type Placement, type StepType, type TourStep } from "@/lib/tours/types";
import { RulesEditor } from "./RulesEditor";
import { KIND_LABEL, StabilityMeter } from "./target-ui";

type Tab = "content" | "position" | "advanced";

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn("font-mono text-[11px]", value.length > max * 0.9 ? "text-aviso" : "text-fg-mut")}>
      {value.length}/{max}
    </span>
  );
}

/** Grade visual de posições ao redor do elemento (13 posições + automático). */
function PlacementPicker({ value, onChange, disabled }: { value: Placement; onChange: (p: Placement) => void; disabled?: boolean }) {
  const cells: { p: Placement; area: string; label: string }[] = [
    { p: "top-start", area: "1 / 2", label: "Acima, início" },
    { p: "top", area: "1 / 3", label: "Acima" },
    { p: "top-end", area: "1 / 4", label: "Acima, fim" },
    { p: "left-start", area: "2 / 1", label: "À esquerda, início" },
    { p: "left", area: "3 / 1", label: "À esquerda" },
    { p: "left-end", area: "4 / 1", label: "À esquerda, fim" },
    { p: "right-start", area: "2 / 5", label: "À direita, início" },
    { p: "right", area: "3 / 5", label: "À direita" },
    { p: "right-end", area: "4 / 5", label: "À direita, fim" },
    { p: "bottom-start", area: "5 / 2", label: "Abaixo, início" },
    { p: "bottom", area: "5 / 3", label: "Abaixo" },
    { p: "bottom-end", area: "5 / 4", label: "Abaixo, fim" },
  ];
  return (
    <div className={cn("flex items-center gap-4", disabled && "pointer-events-none opacity-50")}>
      <div className="grid shrink-0 grid-cols-5 grid-rows-5 gap-1" style={{ width: 132, height: 132 }}>
        <div
          className="grid place-items-center rounded-lg border-2 border-dashed border-line-strong text-[10px] font-semibold text-fg-mut"
          style={{ gridArea: "2 / 2 / 5 / 5" }}
        >
          elemento
        </div>
        {cells.map((c) => (
          <button
            key={c.p}
            type="button"
            title={c.label}
            aria-label={c.label}
            aria-pressed={value === c.p}
            onClick={() => onChange(c.p)}
            style={{ gridArea: c.area }}
            className={cn(
              "rounded-md border transition",
              value === c.p ? "border-accent bg-accent" : "border-line-strong bg-bg-elev hover:border-accent hover:bg-surface-brand"
            )}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onChange("auto")}
          aria-pressed={value === "auto"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold",
            value === "auto" ? "border-accent bg-surface-brand text-accent" : "border-line-strong text-fg-soft hover:border-accent"
          )}
        >
          <Sparkles className="size-3.5" /> Automático
        </button>
        <button
          type="button"
          onClick={() => onChange("center")}
          aria-pressed={value === "center"}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-semibold",
            value === "center" ? "border-accent bg-surface-brand text-accent" : "border-line-strong text-fg-soft hover:border-accent"
          )}
        >
          Centro da tela
        </button>
        <p className="max-w-[140px] text-[11px] leading-snug text-fg-mut">
          Se não couber, o lado é invertido sozinho. O card nunca sai da tela.
        </p>
      </div>
    </div>
  );
}

export function StepEditor({
  step,
  device,
  onDevice,
  onChange,
  onDelete,
  onPickTarget,
  onSelectInProduct,
}: {
  step: TourStep;
  device: Device;
  onDevice: (d: Device) => void;
  onChange: (patch: Partial<TourStep>) => void;
  onDelete: () => void;
  onPickTarget: () => void;
  onSelectInProduct: () => void;
}) {
  const [tab, setTab] = useState<Tab>("content");
  const cfg = deviceConfig(step, device);
  const needsTarget = step.type !== "modal";

  const setDevice = (patch: { placement?: Placement; width?: number | null }) =>
    onChange({ responsive: { ...step.responsive, [device]: { ...cfg, ...step.responsive[device], ...patch } } });

  const changeType = (type: StepType) =>
    onChange({
      type,
      placement: type === "modal" ? "center" : step.placement === "center" ? "auto" : step.placement,
      highlight: type === "spotlight" ? "spotlight" : type === "modal" ? "none" : step.highlight === "none" ? "ring" : step.highlight,
      advance: type === "modal" ? "button" : step.advance,
    });

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">Configuração do passo</h2>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Excluir passo"
          className="rounded-lg p-2 text-erro hover:bg-erro/10"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-3" role="tablist">
        <SegmentedControl<Tab>
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "content", label: "Conteúdo" },
            { value: "position", label: "Posição" },
            { value: "advanced", label: "Avançado" },
          ]}
        />
      </div>

      {tab === "content" && (
        <div className="mt-4 flex flex-col gap-4">
          <Field label="Tipo do passo" hint={STEP_TYPE_HINT[step.type]}>
            <Select value={step.type} onChange={(e) => changeType(e.target.value as StepType)}>
              {STEP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {STEP_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Título" action={<Counter value={step.title} max={120} />}>
            <Input value={step.title} maxLength={120} onChange={(e) => onChange({ title: e.target.value })} />
          </Field>
          <Field label="Descrição" action={<Counter value={step.body} max={600} />}>
            <textarea
              value={step.body}
              maxLength={600}
              rows={4}
              onChange={(e) => onChange({ body: e.target.value })}
              className="w-full resize-y rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm text-fg outline-none transition focus:border-accent"
            />
          </Field>
          <Field label="Imagem ou GIF (opcional)" hint="Endereço https de uma imagem. Aparece no topo do card.">
            <Input
              value={step.imageUrl ?? ""}
              onChange={(e) => onChange({ imageUrl: e.target.value || undefined })}
              placeholder="https://…/onboarding.gif"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Botão principal">
              <Input
                value={step.buttons.next}
                maxLength={30}
                onChange={(e) => onChange({ buttons: { ...step.buttons, next: e.target.value } })}
              />
            </Field>
            <Field label="Botão secundário">
              <Input
                value={step.buttons.back}
                maxLength={30}
                onChange={(e) => onChange({ buttons: { ...step.buttons, back: e.target.value } })}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-3 rounded-xl bg-bg-sunken p-3.5">
            <label className="flex items-center justify-between gap-3 text-sm font-medium text-fg-soft">
              Mostrar botão secundário
              <Switch
                checked={step.buttons.showBack}
                onChange={(v) => onChange({ buttons: { ...step.buttons, showBack: v } })}
                label="Mostrar botão secundário"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm font-medium text-fg-soft">
              Permitir pular o tour neste passo
              <Switch
                checked={step.buttons.showSkip}
                onChange={(v) => onChange({ buttons: { ...step.buttons, showSkip: v } })}
                label="Permitir pular o tour"
              />
            </label>
            {step.buttons.showSkip && (
              <Input
                value={step.buttons.skip}
                maxLength={30}
                onChange={(e) => onChange({ buttons: { ...step.buttons, skip: e.target.value } })}
                aria-label="Texto do link para pular"
              />
            )}
          </div>
        </div>
      )}

      {tab === "position" && (
        <div className="mt-4 flex flex-col gap-5">
          {needsTarget ? (
            <Field label="Elemento alvo">
              {step.target ? (
                <div className="rounded-xl border border-line p-3">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-brand text-accent">
                      <Crosshair className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{step.target.label}</div>
                      <div className="text-xs text-fg-mut">
                        {KIND_LABEL[step.target.kind]} · {STRATEGY_LABEL[step.target.strategy]}
                      </div>
                    </div>
                    <button type="button" onClick={onPickTarget} className="rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-surface-brand">
                      Alterar
                    </button>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
                    <span className="text-xs text-fg-mut">Estabilidade da identificação</span>
                    <StabilityMeter value={step.target.stability} />
                  </div>
                  {step.target.stability < 0.5 && (
                    <p className="mt-2 rounded-lg bg-aviso/10 px-2.5 py-2 text-[11.5px] leading-relaxed text-fg-soft">
                      Se a tela mudar, este elemento pode não ser reencontrado. Peça ao time técnico para adicionar{" "}
                      <code className="font-mono text-[11px]">data-luumu-id</code> nele.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-aviso/60 bg-aviso/5 p-3.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-fg-soft">
                    <AlertTriangle className="size-4 text-aviso" /> Nenhum elemento escolhido
                  </div>
                  <p className="mt-1 text-xs text-fg-mut">Sem alvo este passo não pode ser publicado (ou vire um modal).</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onSelectInProduct}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <MousePointerClick className="size-3.5" /> Selecionar no produto
                    </button>
                    <button
                      type="button"
                      onClick={onPickTarget}
                      className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-fg-soft hover:border-accent"
                    >
                      Escolher entre descobertos
                    </button>
                  </div>
                </div>
              )}
            </Field>
          ) : null}

          <Field
            label="Página do passo"
            hint="Se o usuário estiver em outra página, o tour leva ele até aqui. Aceita :id para partes variáveis (ex.: /projetos/:id)."
          >
            <Input
              value={step.route ?? ""}
              onChange={(e) => onChange({ route: e.target.value.trim() || null })}
              placeholder="Qualquer página"
              className="font-mono text-sm"
            />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-fg-soft">Posição em</span>
              <SegmentedControl<Device>
                size="sm"
                value={device}
                onChange={onDevice}
                options={[
                  { value: "desktop", label: "Desktop", icon: <Monitor className="size-3.5" /> },
                  { value: "tablet", label: "Tablet", icon: <Tablet className="size-3.5" /> },
                  { value: "mobile", label: "Mobile", icon: <Smartphone className="size-3.5" /> },
                ]}
              />
            </div>
            <PlacementPicker value={cfg.placement} onChange={(placement) => setDevice({ placement })} disabled={!needsTarget} />
            {!needsTarget && <p className="mt-2 text-xs text-fg-mut">Modais aparecem sempre no centro da tela.</p>}
          </div>

          <Field label={`Largura do card no ${device === "desktop" ? "desktop" : device === "tablet" ? "tablet" : "mobile"}`}>
            <div className="flex items-center gap-3">
              <Select
                value={cfg.width == null ? "auto" : "custom"}
                onChange={(e) => setDevice({ width: e.target.value === "auto" ? null : step.type === "modal" ? 440 : 340 })}
                className="w-auto"
              >
                <option value="auto">{device === "mobile" ? "Largura da tela" : "Automática"}</option>
                <option value="custom">Personalizada</option>
              </Select>
              {cfg.width != null && (
                <>
                  <input
                    type="range"
                    min={220}
                    max={640}
                    step={10}
                    value={cfg.width}
                    onChange={(e) => setDevice({ width: Number(e.target.value) })}
                    className="flex-1 accent-[var(--accent)]"
                    aria-label="Largura em pixels"
                  />
                  <span className="w-14 text-right font-mono text-xs text-fg-mut">{cfg.width}px</span>
                </>
              )}
            </div>
          </Field>

          {needsTarget && (
            <Field label="Destaque do elemento">
              <SegmentedControl<TourStep["highlight"]>
                size="sm"
                value={step.type === "spotlight" ? "spotlight" : step.highlight}
                onChange={(highlight) => onChange({ highlight, type: highlight === "spotlight" ? "spotlight" : step.type === "spotlight" ? "tooltip" : step.type })}
                options={[
                  { value: "none", label: "Nenhum" },
                  { value: "ring", label: "Contorno" },
                  { value: "spotlight", label: "Spotlight" },
                ]}
              />
            </Field>
          )}
        </div>
      )}

      {tab === "advanced" && (
        <div className="mt-4 flex flex-col gap-4">
          {needsTarget && (
            <Field label="Como o usuário avança">
              <Select value={step.advance} onChange={(e) => onChange({ advance: e.target.value as TourStep["advance"] })}>
                <option value="button">Clicando no botão principal</option>
                <option value="click_target">Clicando no próprio elemento</option>
              </Select>
            </Field>
          )}
          {needsTarget && (
            <div className="flex flex-col gap-3 rounded-xl bg-bg-sunken p-3.5">
              <label className="flex items-center justify-between gap-3 text-sm font-medium text-fg-soft">
                Rolar até o elemento
                <Switch checked={step.scroll.enabled} onChange={(v) => onChange({ scroll: { ...step.scroll, enabled: v } })} label="Rolar até o elemento" />
              </label>
              {step.scroll.enabled && (
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={step.scroll.behavior}
                    onChange={(e) => onChange({ scroll: { ...step.scroll, behavior: e.target.value as "smooth" | "instant" } })}
                    aria-label="Rolagem"
                  >
                    <option value="smooth">Suave</option>
                    <option value="instant">Instantânea</option>
                  </Select>
                  <Select
                    value={step.scroll.block}
                    onChange={(e) => onChange({ scroll: { ...step.scroll, block: e.target.value as TourStep["scroll"]["block"] } })}
                    aria-label="Alinhamento"
                  >
                    <option value="center">Centralizar</option>
                    <option value="start">No topo</option>
                    <option value="end">Embaixo</option>
                    <option value="nearest">O mínimo</option>
                  </Select>
                </div>
              )}
            </div>
          )}
          {needsTarget && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Se o elemento não aparecer">
                <Select value={step.onMissing} onChange={(e) => onChange({ onMissing: e.target.value as "skip" | "end" })}>
                  <option value="skip">Pular o passo</option>
                  <option value="end">Encerrar o tour</option>
                </Select>
              </Field>
              <Field label="Esperar até">
                <Select value={String(step.waitTimeoutMs)} onChange={(e) => onChange({ waitTimeoutMs: Number(e.target.value) })}>
                  {[2000, 4000, 6000, 10000, 15000, 30000].map((ms) => (
                    <option key={ms} value={ms}>
                      {ms / 1000}s
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <Field label="Ao avançar deste passo" hint="Ações seguras e pré-definidas. Nenhum código é executado.">
            <div className="flex flex-col gap-2">
              <Select
                value={step.action.type}
                onChange={(e) => onChange({ action: { type: e.target.value as TourStep["action"]["type"], value: "" } })}
              >
                <option value="none">Nada além de ir ao próximo passo</option>
                <option value="navigate">Navegar para uma página</option>
                <option value="open_url">Abrir um link</option>
                <option value="track">Disparar um evento</option>
              </Select>
              {step.action.type !== "none" && (
                <Input
                  value={step.action.value ?? ""}
                  onChange={(e) => onChange({ action: { ...step.action, value: e.target.value } })}
                  placeholder={step.action.type === "navigate" ? "/projetos" : step.action.type === "open_url" ? "https://…" : "tour_criar_projeto"}
                  className="font-mono text-sm"
                />
              )}
            </div>
          </Field>
          <Field label="Mostrar este passo apenas se">
            <RulesEditor
              rules={step.conditions}
              onChange={(conditions) => onChange({ conditions })}
              emptyLabel="Sem condições: o passo aparece para todos que estão no tour."
            />
          </Field>
        </div>
      )}
    </div>
  );
}
