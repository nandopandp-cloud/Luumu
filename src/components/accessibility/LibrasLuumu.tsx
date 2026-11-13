"use client";

import { Check, Globe, Image as ImageIcon, Info, Palette, RotateCcw, Shirt, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/Input";
import type { A11yConfig } from "@/lib/accessibility/config";
import { hostInScope } from "@/lib/accessibility/scope";
import {
  BACKGROUNDS, INTERPRETERS, LOGO_SPOT_OPTIONS, LOGO_X, LOGO_Y, SHIRT_COLORS, logoPosition, type InterpreterLook,
} from "@/lib/accessibility/libras3d/interpreters";
import { ColorField, ImageField, Pills, SectionTitle } from "./controls";

type Patch = (fn: (c: A11yConfig) => A11yConfig) => void;

function Range({ id, label, value, min, max, suffix, onChange }: { id: string; label: string; value: number; min: number; max: number; suffix: string; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-baseline justify-between text-xs font-semibold text-fg-soft">
        {label}
        <span className="font-mono text-fg">{value > 0 && suffix === " cm" && min < 0 ? "+" : ""}{value}{suffix}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
    </div>
  );
}

/**
 * Intérprete Luumu (beta): escolha do personagem, camisa (cor, logo, posição) e fundo — um visual
 * padrão e, se quiser, um visual próprio por plataforma (config.libras.lookByHost). `host` = a
 * plataforma em edição (null = padrão); a prévia ao lado mostra o visual dela, vista "Libras".
 */
export function LibrasLuumu({ config, patch, hosts, host, onHost }: { config: A11yConfig; patch: Patch; hosts: string[]; host: string | null; onHost: (h: string | null) => void }) {
  const own = host ? config.libras.lookByHost[host] : undefined;
  const editing = !host || !!own;
  const look = own ?? config.libras.look;
  const set = (p: Partial<InterpreterLook>) =>
    patch((c) =>
      host && c.libras.lookByHost[host]
        ? { ...c, libras: { ...c.libras, lookByHost: { ...c.libras.lookByHost, [host]: { ...c.libras.lookByHost[host], ...p } } } }
        : { ...c, libras: { ...c.libras, look: { ...c.libras.look, ...p } } }
    );
  const customize = (h: string) => patch((c) => ({ ...c, libras: { ...c.libras, lookByHost: { ...c.libras.lookByHost, [h]: { ...c.libras.look } } } }));
  const backToDefault = (h: string) =>
    patch((c) => {
      const next = { ...c.libras.lookByHost };
      delete next[h];
      return { ...c, libras: { ...c.libras, lookByHost: next } };
    });
  const customized = Object.keys(config.libras.lookByHost);
  const allHosts = [...new Set([...hosts, ...customized])];
  const pos = logoPosition(look) ?? { x: 0, y: 0 };
  const customBg = !(look.background in BACKGROUNDS);

  return (
    <>
      <Card>
        <SectionTitle
          icon={<Globe className="size-4.5" />}
          title="Plataforma"
          description="Cada plataforma pode ter o próprio intérprete, camisa, logo e fundo. As que não forem personalizadas usam o padrão."
          aside={customized.length ? <Badge tone="brand" dot={false}>{customized.length} {customized.length === 1 ? "personalizada" : "personalizadas"}</Badge> : undefined}
        />
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Plataforma em edição">
          {[null, ...allHosts].map((h) => {
            const on = h === host;
            const custom = !!h && !!config.libras.lookByHost[h];
            const off = !!h && !hostInScope(config.scope, h);
            return (
              <button
                key={h ?? "padrao"}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onHost(h)}
                className={cn("inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition", on ? "border-accent bg-surface-brand text-accent" : "border-line text-fg-soft hover:border-line-strong")}
              >
                {h ?? "Padrão (todas as plataformas)"}
                {custom && <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">próprio</span>}
                {off && <span className="rounded-full bg-bg-sunken px-1.5 py-0.5 text-[10px] text-fg-mut">plugin desligado</span>}
              </button>
            );
          })}
        </div>
        {!allHosts.length && <p className="mt-3 text-xs text-fg-mut">As plataformas aparecem aqui assim que o SDK do projeto rodar nelas.</p>}
        {host && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-bg-sunken px-3 py-2.5 text-xs text-fg-soft">
            {own ? (
              <>
                <span className="flex-1">
                  <strong className="text-fg">{host}</strong> tem visual próprio. As mudanças abaixo valem só para ela.
                </span>
                <button type="button" onClick={() => backToDefault(host)} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1.5 font-semibold hover:border-accent hover:text-accent">
                  <RotateCcw className="size-3.5" /> Voltar ao padrão
                </button>
              </>
            ) : (
              <>
                <span className="flex-1">
                  <strong className="text-fg">{host}</strong> usa o visual padrão (mostrado abaixo e na prévia).
                </span>
                <button type="button" onClick={() => customize(host)} className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-accent-contrast">
                  Personalizar esta plataforma
                </button>
              </>
            )}
          </div>
        )}
      </Card>

      <div className={cn("flex flex-col gap-4", !editing && "pointer-events-none select-none opacity-55")} aria-disabled={!editing}>
      <Card>
        <SectionTitle icon={<Users className="size-4.5" />} title="Intérprete" description="O personagem que faz os sinais. O movimento de cada sinal é o do VLibras." />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6" role="radiogroup" aria-label="Intérprete">
          {INTERPRETERS.map((it) => {
            const on = look.interpreter === it.id;
            return (
              <button
                key={it.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ interpreter: it.id })}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-xl border text-left transition",
                  on ? "border-accent ring-2 ring-accent/25" : "border-line hover:border-line-strong"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura estática de public/ */}
                <img src={`/a11y/libras3d/miniaturas/${it.id}.png`} alt="" className="aspect-[1/1.1] w-full bg-surface-brand object-cover object-[50%_20%]" loading="lazy" />
                {on && (
                  <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-accent text-white">
                    <Check className="size-3" />
                  </span>
                )}
                <span className="px-2 pt-1.5 text-xs font-bold">{it.name}</span>
                <span className="px-2 pb-2 text-[11px] leading-tight text-fg-mut">{it.hint}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<Shirt className="size-4.5" />} title="Camisa" description="Cor, logo e onde o logo fica. Vale para qualquer intérprete." />
        <div className="grid gap-5">
          <Field label="Cor da camisa">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => set({ shirtColor: look.shirtColor ? "" : SHIRT_COLORS[0] })}
                  aria-pressed={!look.shirtColor}
                  className={cn("rounded-full border px-3 py-1 text-xs font-semibold", !look.shirtColor ? "border-accent bg-surface-brand text-accent" : "border-line text-fg-soft hover:border-line-strong")}
                >
                  Cor original do personagem
                </button>
              </div>
              {look.shirtColor && <ColorField label="Cor da camisa" value={look.shirtColor} onChange={(shirtColor) => set({ shirtColor })} presets={SHIRT_COLORS} />}
            </div>
          </Field>

          <Field label="Logo na camisa">
            <div className="flex flex-col gap-3">
              <Pills
                label="Logo na camisa"
                value={look.logo}
                onChange={(logo) => set({ logo })}
                options={[
                  { value: "brand", label: "Logo do painel" },
                  { value: "custom", label: "Outra imagem" },
                  { value: "none", label: "Sem logo" },
                ]}
              />
              {look.logo === "brand" && !config.brand.logoUrl && <p className="text-xs text-fg-mut">Defina a logo em Aparência para usá-la aqui.</p>}
              {look.logo === "custom" && <ImageField label="URL da logo da camisa" value={look.logoUrl} onChange={(logoUrl) => set({ logoUrl })} />}
              {look.logo !== "none" && (
                <p className="flex gap-1.5 text-xs leading-relaxed text-fg-mut">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-accent" />
                  PNG com fundo transparente funciona melhor. A imagem precisa vir de um endereço que permita o uso em outros sites (CORS), como as enviadas pelo painel; senão, a camisa aparece sem logo.
                </p>
              )}
            </div>
          </Field>

          {look.logo !== "none" && (
            <>
              <Field label="Posição do logo">
                <div className="flex flex-col gap-3">
                  <Pills
                    label="Posição do logo"
                    value={look.logoSpot === "custom" ? ("" as never) : look.logoSpot}
                    onChange={(logoSpot) => set({ logoSpot })}
                    options={LOGO_SPOT_OPTIONS}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Range id="logo-x" label="Ajuste horizontal" value={pos.x} min={LOGO_X[0]} max={LOGO_X[1]} suffix=" cm" onChange={(x) => set({ logoSpot: "custom", logoX: x, logoY: pos.y })} />
                    <Range id="logo-y" label="Ajuste vertical" value={pos.y} min={LOGO_Y[0]} max={LOGO_Y[1]} suffix=" cm" onChange={(y) => set({ logoSpot: "custom", logoX: pos.x, logoY: y })} />
                  </div>
                  <p className="text-xs text-fg-mut">&quot;Peito esquerdo&quot; é o lado esquerdo do intérprete (à direita de quem olha).</p>
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Range id="logo-op" label="Opacidade do logo" value={look.logoOpacity} min={0} max={100} suffix="%" onChange={(logoOpacity) => set({ logoOpacity })} />
                <Range id="logo-size" label="Tamanho do logo" value={look.logoSize} min={7} max={20} suffix=" cm" onChange={(logoSize) => set({ logoSize })} />
              </div>
            </>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<Palette className="size-4.5" />} title="Fundo" description="Fundos lisos e com contraste deixam as mãos mais fáceis de acompanhar." />
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Fundo do intérprete">
            {Object.entries(BACKGROUNDS).map(([id, b]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={look.background === id}
                onClick={() => set({ background: id })}
                className={cn("flex items-center gap-2 rounded-xl border p-2 text-xs font-semibold", look.background === id ? "border-accent bg-surface-brand" : "border-line hover:border-line-strong")}
              >
                <span className="size-5 shrink-0 rounded-md ring-1 ring-black/10" style={{ background: b.css }} />
                {b.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => set({ background: customBg ? "lavanda" : "#E9E2FF" })}
              aria-pressed={customBg}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", customBg ? "border-accent bg-surface-brand text-accent" : "border-line text-fg-soft")}
            >
              <ImageIcon className="size-3.5" /> Outra cor
            </button>
            {customBg && <ColorField label="Cor de fundo" value={look.background} onChange={(background) => set({ background })} presets={[]} />}
          </div>
          <Field label="Imagem de fundo (opcional)" hint="Cobre a área do intérprete; a cor acima aparece enquanto ela carrega. Prefira imagens lisas ou desfocadas: fundo carregado atrapalha a leitura das mãos.">
            <ImageField label="URL da imagem de fundo" value={look.backgroundUrl} onChange={(backgroundUrl) => set({ backgroundUrl })} emptyLabel="sem imagem" placeholder="https://…/fundo.jpg" />
          </Field>
        </div>
      </Card>

      </div>

      <Card>
        <SectionTitle icon={<Sparkles className="size-4.5" />} title="Sobre o beta" aside={<Badge tone="warn">Beta</Badge>} />
        <ul className="grid gap-1.5 text-xs leading-relaxed text-fg-soft">
          <li>• A tradução e os sinais são os do VLibras (gov.br). A Luumu troca só o personagem e a janela.</li>
          <li>• Palavras sem sinal no dicionário são soletradas, como no VLibras.</li>
          <li>• Contatos de mão no rosto podem ficar alguns centímetros fora: o corpo do personagem é diferente do Ícaro. Valide com intérpretes antes de liberar para todos.</li>
          <li>• Precisa de WebGL. Sem ele, o estudante vê um aviso e o recurso volta a ficar desligado.</li>
        </ul>
      </Card>
    </>
  );
}
