"use client";

import {
  Accessibility, Bolt, Building2, CaseSensitive, Contrast, Droplet, Eye, GraduationCap, Hand, Heading, Info, Keyboard, Link2, Lock, Megaphone,
  Moon, MousePointer2, Palette, Pause, Plus, Rows3, ScanFace, ScanLine, School, SlidersHorizontal, Sparkles, Sun, SunMoon,
  Trash2, Type, Users, Volume2, ZoomIn, Hash, UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { SchoolYearPicker } from "@/components/surveys/SchoolYearPicker";
import { FEATURE_GROUPS, FEATURES, PROFILES, profileAvailable, type FeatureId, type ProfileId } from "@/lib/accessibility/features";
import {
  ACCENT_PRESETS, LAUNCHER_POSITIONS, NUDGE_FREQUENCIES,
  type A11yConfig, type LauncherPosition,
} from "@/lib/accessibility/config";
import { MAX_STUDENTS, type AudienceGroup } from "@/lib/accessibility/audience";
import { ChipInput, ColorField, ImageField, Pills, SectionTitle, ToggleRow } from "./controls";
import { LibrasTab } from "./LibrasTab";

type Patch = (fn: (c: A11yConfig) => A11yConfig) => void;

export const FEATURE_ICON: Record<string, React.ElementType> = {
  type: Type, mask: Rows3, guide: ScanLine, speaker: Volume2, font: CaseSensitive, spacing: SlidersHorizontal, contrast: Contrast, drop: Droplet,
  eye: Eye, link: Link2, heading: Heading, cursor: MousePointer2, pause: Pause, keyboard: Keyboard, face: ScanFace, hands: Hand,
  bolt: Bolt, sliders: SlidersHorizontal, zoom: ZoomIn, palette: Palette, moon: Moon,
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
          title="Perfis rápidos"
          description="Atalhos que ligam vários recursos de uma vez. Os nomes falam do benefício, nunca de diagnóstico: o estudante não precisa se rotular para usar."
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
        <SectionTitle icon={<MousePointer2 className="size-4.5" />} title="Botão flutuante" description="Onde os botões ficam na tela do estudante." />
        <div className="grid gap-4">
          <Field label="Posição">
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
            <ToggleRow title="Rótulos sempre visíveis" description="Desligado, o rótulo aparece ao passar o mouse ou focar pelo teclado." checked={config.launcher.showLabels} onChange={(showLabels) => launcher({ showLabels })} />
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

const IDENTIFY_SNIPPET = `// no produto, depois do login do estudante
Luumu.identify({
  id: "123456",               // ou e-mail: confere com a lista individual
  email: "ana@escola.sp.gov.br",
  rede: "Rede Estadual SP",   // também aceita: network
  escola: "EE Prof. Ana Rosa", // também aceita: school
  turma: "7º A",              // também aceita: class, classroom
  school_year: "7º ano",
});`;

let groupSeq = 0;
const newGroup = (): AudienceGroup => ({ id: `g${Date.now().toString(36)}${groupSeq++}`, networks: [], schools: [], classes: [], schoolYears: [] });

export function NudgeTab({
  config,
  patch,
  studentsText,
  setStudentsText,
  studentCount,
}: {
  config: A11yConfig;
  patch: Patch;
  studentsText: string;
  setStudentsText: (v: string) => void;
  studentCount: number;
}) {
  const n = config.nudge;
  const nudge = (p: Partial<A11yConfig["nudge"]>) => patch((c) => ({ ...c, nudge: { ...c.nudge, ...p } }));
  const setGroup = (id: string, p: Partial<AudienceGroup>) => nudge({ groups: n.groups.map((g) => (g.id === id ? { ...g, ...p } : g)) });
  const targeted = n.audience === "targeted";
  const reach = targeted ? `${n.groups.length} ${n.groups.length === 1 ? "grupo" : "grupos"} e ${studentCount} ${studentCount === 1 ? "estudante" : "estudantes"} na lista` : "todos os estudantes";

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

      <Card className={cn(!n.enabled && "opacity-60")}>
        <SectionTitle icon={<Users className="size-4.5" />} title="Quem recebe" description="Sinalize estudantes por rede, escola, turma e ano — ou por uma lista individual." />
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Público do convite">
          {[
            { v: "targeted" as const, t: "Estudantes sinalizados", d: "Só quem estiver nos grupos ou na lista abaixo." },
            { v: "all" as const, t: "Todos os estudantes", d: "Qualquer estudante que acessar o produto." },
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
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-fg-soft">Grupos</p>
                <span className="text-xs text-fg-mut">Dentro do grupo, todos os campos preenchidos precisam bater. Entre grupos, basta um.</span>
              </div>
              <div className="flex flex-col gap-3">
                {n.groups.map((g, i) => (
                  <div key={g.id} className="rounded-2xl border border-line bg-bg-sunken/50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-fg-mut">Grupo {i + 1}</span>
                      <button type="button" onClick={() => nudge({ groups: n.groups.filter((x) => x.id !== g.id) })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-fg-mut hover:text-erro" aria-label={`Remover grupo ${i + 1}`}>
                        <Trash2 className="size-3.5" /> Remover
                      </button>
                    </div>
                    <div className="grid gap-3">
                      <Field label="Redes" hint="Ex.: Rede Estadual SP. Vazio = qualquer rede.">
                        <ChipInput label="Redes" values={g.networks} onChange={(networks) => setGroup(g.id, { networks })} placeholder="Digite e tecle Enter" />
                      </Field>
                      <Field label="Escolas">
                        <ChipInput label="Escolas" values={g.schools} onChange={(schools) => setGroup(g.id, { schools })} placeholder="Ex.: EE Prof. Ana Rosa" />
                      </Field>
                      <Field label="Turmas">
                        <ChipInput label="Turmas" values={g.classes} onChange={(classes) => setGroup(g.id, { classes })} placeholder="Ex.: 7º A, 8º B" />
                      </Field>
                      <Field label="Anos escolares">
                        <SchoolYearPicker selected={g.schoolYears} onChange={(schoolYears) => setGroup(g.id, { schoolYears })} />
                      </Field>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => nudge({ groups: [...n.groups, newGroup()] })}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong py-3 text-sm font-semibold text-fg-soft transition hover:border-accent hover:text-accent"
                >
                  <Plus className="size-4" /> Adicionar grupo
                </button>
                {n.groups.some((g) => !g.networks.length && !g.schools.length && !g.classes.length && !g.schoolYears.length) && (
                  <p className="text-xs text-fg-mut">Grupos sem nenhum critério são ignorados ao salvar (eles alcançariam todo mundo).</p>
                )}
              </div>
            </div>

            <Field
              label="Lista individual"
              hint={`IDs ou e-mails, um por linha (ou separados por vírgula). ${studentCount} ${studentCount === 1 ? "estudante" : "estudantes"} · máx. ${MAX_STUDENTS.toLocaleString("pt-BR")}.`}
              action={<Badge tone="success" dot={false}><Lock className="mr-0.5 size-3" /> Nunca vai para o navegador</Badge>}
            >
              <Textarea rows={5} value={studentsText} onChange={(e) => setStudentsText(e.target.value)} placeholder={"123456\nana@escola.sp.gov.br\n…"} className="font-mono text-xs" spellCheck={false} />
            </Field>
            <p className="-mt-2 flex gap-2 text-xs leading-relaxed text-fg-mut">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Indicar que um estudante precisa de acessibilidade é dado sensível (LGPD). A lista fica só no servidor: o produto pergunta
              “este estudante está na lista?” apenas para quem está logado, e nada sobre a lista aparece no código da página.
            </p>

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg-soft">
                <School className="size-4" /> Como o produto informa rede, escola e turma
              </p>
              <CodeBlock code={IDENTIFY_SNIPPET} lang="js" />
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-fg-mut">
                <span className="inline-flex items-center gap-1"><Building2 className="size-3" /> rede/network</span>·
                <span className="inline-flex items-center gap-1"><School className="size-3" /> escola/school</span>·
                <span className="inline-flex items-center gap-1"><Users className="size-3" /> turma/class</span>·
                <span className="inline-flex items-center gap-1"><GraduationCap className="size-3" /> school_year</span>·
                <span className="inline-flex items-center gap-1"><Hash className="size-3" /> id</span>·
                <span className="inline-flex items-center gap-1"><UserRound className="size-3" /> email</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className={cn(!n.enabled && "opacity-60")}>
        <SectionTitle icon={<Sparkles className="size-4.5" />} title="Mensagem" description="Tom acolhedor: o convite nunca diz por que o estudante foi sinalizado." />
        <div className="grid gap-4">
          <Field label="Título">
            <Input value={n.title} maxLength={80} onChange={(e) => nudge({ title: e.target.value })} />
          </Field>
          <Field label="Texto">
            <Textarea rows={3} maxLength={280} value={n.message} onChange={(e) => nudge({ message: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Botão principal">
              <Input value={n.cta} maxLength={30} onChange={(e) => nudge({ cta: e.target.value })} />
            </Field>
            <Field label="Botão secundário">
              <Input value={n.dismiss} maxLength={30} onChange={(e) => nudge({ dismiss: e.target.value })} />
            </Field>
          </div>
          <Field label="Perfil sugerido" hint="Ao aceitar, o perfil já vem ligado e o painel abre. Sem sugestão, só o painel abre.">
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

