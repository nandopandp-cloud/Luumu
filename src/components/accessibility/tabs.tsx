"use client";

import {
  Accessibility, Bolt, Building2, CaseSensitive, Contrast, Droplet, Eye, Hand, Heading, Keyboard, Link2, Lock, Megaphone,
  Moon, MousePointer2, Palette, Pause, Rows3, ScanFace, ScanLine, SlidersHorizontal, Sparkles, Sun, SunMoon,
  Type, Users, Volume2, ZoomIn, EyeOff, EarOff, Brain, Target, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { FEATURE_GROUPS, FEATURES, PROFILES, profileAvailable, type FeatureId, type ProfileId } from "@/lib/accessibility/features";
import {
  ACCENT_PRESETS, LAUNCHER_POSITIONS, NUDGE_FREQUENCIES,
  type A11yConfig, type LauncherPosition,
} from "@/lib/accessibility/config";
import { ColorField, ImageField, Pills, SectionTitle, ToggleRow } from "./controls";
import { GroupsEditor, IdentifyHint } from "./GroupsEditor";
import { InviteesManager } from "./InviteesManager";
import { LibrasTab } from "./LibrasTab";
import { LauncherStyleEditor } from "./LauncherStyleEditor";

type Patch = (fn: (c: A11yConfig) => A11yConfig) => void;

export const FEATURE_ICON: Record<string, React.ElementType> = {
  type: Type, mask: Rows3, guide: ScanLine, speaker: Volume2, font: CaseSensitive, spacing: SlidersHorizontal, contrast: Contrast, drop: Droplet,
  eye: Eye, link: Link2, heading: Heading, cursor: MousePointer2, pause: Pause, keyboard: Keyboard, face: ScanFace, hands: Hand,
  bolt: Bolt, sliders: SlidersHorizontal, zoom: ZoomIn, palette: Palette, moon: Moon,
  eyeOff: EyeOff, earOff: EarOff, brain: Brain, target: Target, book: BookOpen,
};

/* ================================================================ Recursos */

export function FeaturesTab({ config, patch }: { config: A11yConfig; patch: Patch }) {
  const setFeature = (id: FeatureId, on: boolean) => patch((c) => ({ ...c, features: { ...c.features, [id]: on } }));
  const toggleProfile = (id: ProfileId, on: boolean) =>
    patch((c) => {
      const set = new Set(c.profiles);
      if (on) set.add(id);
      else set.delete(id);
      // ordem fixa do catálogo: o painel do estudante fica previsível
      return { ...c, profiles: PROFILES.map((p) => p.id).filter((p) => set.has(p)) };
    });
  const enabledCount = FEATURES.filter((f) => config.features[f.id]).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionTitle
          icon={<Sparkles className="size-4.5" />}
          title="Perfis de acessibilidade"
          description="Atalhos que ligam vários recursos de uma vez. No painel do estudante aparecem com o nome da necessidade (Baixa visão, TDAH...); nos cartões do convite, com um nome que fala do benefício (Mais foco, Mais conforto na leitura...)."
        />
        <div className="grid gap-2 sm:grid-cols-2">
          {PROFILES.map((p) => {
            const Icon = FEATURE_ICON[p.icon] ?? Sparkles;
            const available = profileAvailable(p.id, config.features);
            const on = config.profiles.includes(p.id) && available;
            return (
              <button
                key={p.id}
                type="button"
                disabled={!available}
                aria-pressed={on}
                onClick={() => toggleProfile(p.id, !config.profiles.includes(p.id))}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45",
                  on ? "border-accent bg-surface-brand" : "border-line hover:border-line-strong"
                )}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", on ? "bg-accent text-white" : "bg-bg-sunken text-fg-mut")}>
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{p.label}</span>
                  <span className="block text-xs text-fg-mut">{p.description}</span>
                  <span className="mt-1 block text-[11px] text-fg-mut">No convite: “{p.nudgeLabel}”</span>
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-bg-sunken px-1.5 py-0.5 text-[10.5px] font-semibold text-fg-mut" title="Só a equipe vê esta indicação">
                    <Lock className="size-2.5" /> Ajuda em: {p.audienceHint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle
          icon={<Accessibility className="size-4.5" />}
          title="Recursos disponíveis"
          description="Escolha o que aparece no painel do estudante. Desligar um recurso também o tira dos perfis."
          aside={<Badge tone="brand" dot={false}>{enabledCount} de {FEATURES.length}</Badge>}
        />
        <div className="flex flex-col gap-5">
          {FEATURE_GROUPS.map((g) => (
            <div key={g.id}>
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-fg-mut">{g.label}</p>
              <div className="grid gap-2">
                {FEATURES.filter((f) => f.group === g.id).map((f) => {
                  const Icon = FEATURE_ICON[f.icon] ?? Accessibility;
                  return (
                    <ToggleRow
                      key={f.id}
                      icon={<Icon className="size-4.5" />}
                      title={f.label}
                      description={f.description}
                      checked={config.features[f.id]}
                      onChange={(v) => setFeature(f.id, v)}
                      aside={f.id === "faceNav" ? <Badge tone="info" dot={false}>usa a câmera</Badge> : undefined}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ================================================================ Aparência */

const POS_DOT: Record<LauncherPosition, string> = {
  "bottom-right": "bottom-2 right-2",
  "middle-right": "top-1/2 right-2 -translate-y-1/2",
  "bottom-left": "bottom-2 left-2",
  "middle-left": "top-1/2 left-2 -translate-y-1/2",
};

export function AppearanceTab({ config, patch, projectLogo }: { config: A11yConfig; patch: Patch; projectLogo: string }) {
  const brand = (p: Partial<A11yConfig["brand"]>) => patch((c) => ({ ...c, brand: { ...c.brand, ...p } }));
  const launcher = (p: Partial<A11yConfig["launcher"]>) => patch((c) => ({ ...c, launcher: { ...c.launcher, ...p } }));
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionTitle icon={<Palette className="size-4.5" />} title="Marca do painel" description="O painel abre com a cara do produto do cliente." />
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título">
              <Input value={config.brand.title} maxLength={40} onChange={(e) => brand({ title: e.target.value })} />
            </Field>
            <Field label="Tema">
              <Pills
                label="Tema"
                value={config.brand.theme}
                onChange={(theme) => brand({ theme })}
                options={[
                  { value: "light", label: "Claro", icon: <Sun className="size-3.5" /> },
                  { value: "dark", label: "Escuro", icon: <Moon className="size-3.5" /> },
                  { value: "auto", label: "Do aparelho", icon: <SunMoon className="size-3.5" /> },
                ]}
              />
            </Field>
          </div>
          <Field label="Subtítulo" hint="Aparece abaixo do título. Pode ficar vazio.">
            <Textarea rows={2} maxLength={160} value={config.brand.subtitle} onChange={(e) => brand({ subtitle: e.target.value })} />
          </Field>
          <Field label="Cor de destaque" hint="Botões, chaves ligadas e destaques. O texto sobre ela é escolhido para ter contraste.">
            <ColorField label="Cor de destaque" value={config.brand.accent} onChange={(accent) => brand({ accent })} presets={ACCENT_PRESETS} />
          </Field>
          <Field label="Logo" hint="PNG, SVG ou WEBP com fundo transparente. Aparece no cabeçalho do painel e no convite.">
            <ImageField label="URL da logo" value={config.brand.logoUrl} onChange={(logoUrl) => brand({ logoUrl })} fallbackUrl={projectLogo || undefined} fallbackLabel="Usar logo do projeto" />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<MousePointer2 className="size-4.5" />} title="Botão flutuante" description="Estilo, cores e posição da cápsula de atalhos na tela do estudante." />
        <div className="grid gap-4">
          <LauncherStyleEditor config={config} patch={patch} />
          <Field label="Posição inicial" hint={config.launcher.draggable ? "Onde o botão aparece até o estudante arrastá-lo." : undefined}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Posição do botão">
              {LAUNCHER_POSITIONS.map((p) => {
                const on = config.launcher.position === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => launcher({ position: p.value })}
                    className={cn("rounded-xl border p-2 text-left transition", on ? "border-accent bg-surface-brand" : "border-line hover:border-line-strong")}
                  >
                    <span className="relative block h-14 rounded-lg border border-line bg-bg-sunken">
                      <span className={cn("absolute size-3.5 rounded-full", POS_DOT[p.value], on ? "bg-accent" : "bg-fg-mut/50")} />
                    </span>
                    <span className="mt-1.5 block text-xs font-semibold">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rótulo do botão principal">
              <Input value={config.launcher.label} maxLength={30} onChange={(e) => launcher({ label: e.target.value })} />
            </Field>
            <Field label="Distância da borda inferior (px)" hint="Aumente se o botão cobrir o chat do produto.">
              <Input type="number" min={8} max={200} value={config.launcher.offset} onChange={(e) => launcher({ offset: Number(e.target.value) || 8 })} disabled={config.launcher.position.startsWith("middle")} />
            </Field>
          </div>
          <div className="grid gap-2">
            <ToggleRow
              icon={<MousePointer2 className="size-4.5" />}
              title="Estudante pode arrastar o botão"
              description="Ele leva o botão para qualquer canto da tela (ou move com Shift + setas). A posição fica salva com as escolhas dele, em qualquer aparelho; “Restaurar padrão” volta para a posição definida aqui."
              checked={config.launcher.draggable}
              onChange={(draggable) => launcher({ draggable })}
            />
            <ToggleRow title="Rótulo sempre visível" description="Mostra o nome ao lado do botão principal o tempo todo. Desligado, os nomes aparecem ao passar o mouse ou focar pelo teclado." checked={config.launcher.showLabels} onChange={(showLabels) => launcher({ showLabels })} />
            <ToggleRow
              icon={<Hand className="size-4.5" />}
              title="Atalho de Libras"
              description="Um botão próprio para abrir o tradutor VLibras sem passar pelo painel."
              checked={config.launcher.librasShortcut}
              onChange={(librasShortcut) => launcher({ librasShortcut })}
              disabled={!config.features.libras}
            />
            <ToggleRow
              icon={<ScanFace className="size-4.5" />}
              title="Atalho de navegação por rosto"
              description="Um botão próprio para começar a navegação pela câmera."
              checked={config.launcher.faceShortcut}
              onChange={(faceShortcut) => launcher({ faceShortcut })}
              disabled={!config.features.faceNav}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

export { LibrasTab };

/* ================================================================ Convite */

export function NudgeTab({ config, patch, canManage, inviteeCount }: { config: A11yConfig; patch: Patch; canManage: boolean; inviteeCount: number }) {
  const n = config.nudge;
  const nudge = (p: Partial<A11yConfig["nudge"]>) => patch((c) => ({ ...c, nudge: { ...c.nudge, ...p } }));
  const targeted = n.audience === "targeted";
  const reach = targeted
    ? `${n.groups.length} ${n.groups.length === 1 ? "grupo" : "grupos"} e ${inviteeCount.toLocaleString("pt-BR")} ${inviteeCount === 1 ? "convidado" : "convidados"} da lista`
    : "todos os estudantes com o plugin";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionTitle
          icon={<Megaphone className="size-4.5" />}
          title="Convite de acessibilidade"
          description="Um aviso no acesso à plataforma dizendo que a experiência pode ficar melhor com os recursos. Quem já usa algum recurso não é convidado."
        />
        <ToggleRow title="Mostrar o convite" description={n.enabled ? `Ativo para ${reach}.` : "Desligado: ninguém vê o convite."} checked={n.enabled} onChange={(enabled) => nudge({ enabled })} />
      </Card>

      <Card>
        <SectionTitle icon={<Users className="size-4.5" />} title="Convidados" description="Estudantes que recebem o convite, um a um ou em lote. Cada um pode ter o próprio perfil sugerido." />
        <InviteesManager canManage={canManage} />
      </Card>

      <Card className={cn(!n.enabled && "opacity-60")}>
        <SectionTitle icon={<Building2 className="size-4.5" />} title="Quem mais recebe" description="Além dos convidados da lista, o convite pode ir para grupos inteiros ou para todos." />
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Público do convite">
          {[
            { v: "targeted" as const, t: "Convidados e grupos", d: "Os convidados da lista e quem estiver nos grupos abaixo." },
            { v: "all" as const, t: "Todos os estudantes", d: "Qualquer estudante que tenha o plugin." },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={n.audience === o.v}
              onClick={() => nudge({ audience: o.v })}
              className={cn("rounded-xl border p-3.5 text-left transition", n.audience === o.v ? "border-accent bg-surface-brand" : "border-line hover:border-line-strong")}
            >
              <span className="block text-sm font-semibold">{o.t}</span>
              <span className="mt-0.5 block text-xs text-fg-mut">{o.d}</span>
            </button>
          ))}
        </div>
        {targeted && (
          <div className="mt-5 flex flex-col gap-5">
            <GroupsEditor groups={n.groups} onChange={(groups) => nudge({ groups })} emptyHint="Sem grupos: só os convidados da lista recebem o convite." />
            <IdentifyHint />
          </div>
        )}
      </Card>

      <Card className={cn(!n.enabled && "opacity-60")}>
        <SectionTitle icon={<Sparkles className="size-4.5" />} title="Mensagem" description="Tom acolhedor: o convite nunca diz por que o estudante foi sinalizado." />
        <div className="grid gap-4">
          <Field label="Título">
            <Input value={n.title} maxLength={80} onChange={(e) => nudge({ title: e.target.value })} />
          </Field>
          <Field label="Texto" hint="Use **dois asteriscos** em volta de um trecho para deixá-lo em negrito.">
            <Textarea rows={3} maxLength={320} value={n.message} onChange={(e) => nudge({ message: e.target.value })} />
          </Field>
          <Field label="Ilustração" hint="Aparece à esquerda do texto. PNG com fundo transparente, na vertical (cerca de 335×446 px ou o dobro).">
            <div className="flex flex-col gap-3">
              <Pills
                label="Ilustração do convite"
                value={n.image}
                onChange={(image) => nudge({ image })}
                options={[
                  { value: "default", label: "Padrão" },
                  { value: "custom", label: "Enviar outra" },
                  { value: "none", label: "Sem ilustração" },
                ]}
              />
              {n.image === "custom" && <ImageField label="URL da ilustração" value={n.imageUrl} onChange={(imageUrl) => nudge({ imageUrl })} />}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Botão principal">
              <Input value={n.cta} maxLength={30} onChange={(e) => nudge({ cta: e.target.value })} />
            </Field>
            <Field label="Botão secundário">
              <Input value={n.dismiss} maxLength={30} onChange={(e) => nudge({ dismiss: e.target.value })} />
            </Field>
          </div>
          <Field label="Perfil sugerido" hint="O convite mostra até três perfis, todos já marcados; o estudante só aceita (liga todos) ou dispensa. O sugerido aparece primeiro.">
            <Select value={n.profile ?? ""} onChange={(e) => nudge({ profile: (e.target.value || null) as ProfileId | null })}>
              <option value="">Sem sugestão</option>
              {PROFILES.filter((p) => profileAvailable(p.id, config.features)).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Frequência">
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Frequência do convite">
              {NUDGE_FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={n.frequency === f.value}
                  onClick={() => nudge({ frequency: f.value })}
                  className={cn("rounded-xl border p-3 text-left transition", n.frequency === f.value ? "border-accent bg-surface-brand" : "border-line hover:border-line-strong")}
                >
                  <span className="block text-sm font-semibold">{f.label}</span>
                  <span className="mt-0.5 block text-xs text-fg-mut">{f.hint}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Atraso para aparecer (segundos)">
            <Input type="number" min={0} max={30} value={n.delay} onChange={(e) => nudge({ delay: Number(e.target.value) || 0 })} className="w-28" />
          </Field>
        </div>
      </Card>
    </div>
  );
}

