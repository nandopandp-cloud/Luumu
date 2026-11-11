"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, Hand, Loader2, Lock, Power, RotateCcw, ScanFace, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { Mascot } from "@/components/ui/Mascot";
import { useToast } from "@/components/ui/Toast";
import { normalizeA11yConfig, publicA11yConfig, type A11yConfig } from "@/lib/accessibility/config";
import { parseStudentList } from "@/lib/accessibility/audience";
import { FEATURES } from "@/lib/accessibility/features";
import { saveAccessibilityAction } from "@/app/(app)/accessibility/actions";
import { AppearanceTab, FeaturesTab, LibrasTab, NudgeTab } from "./tabs";
import { LivePreview, type PreviewView } from "./LivePreview";

type Tab = "features" | "appearance" | "libras" | "nudge";

const TABS: { value: Tab; label: string }[] = [
  { value: "features", label: "Recursos" },
  { value: "appearance", label: "Aparência" },
  { value: "libras", label: "Libras" },
  { value: "nudge", label: "Convite" },
];

// a prévia acompanha a aba: em Libras abre o tradutor VLibras; no convite, o modal
const VIEW_FOR_TAB: Record<Tab, PreviewView> = { features: "panel", appearance: "launcher", libras: "libras", nudge: "nudge" };

const HIGHLIGHTS = [
  { icon: Eye, text: "16 recursos de leitura, cor e navegação" },
  { icon: Hand, text: "Libras com o tradutor oficial VLibras (gov.br)" },
  { icon: ScanFace, text: "Navegação pelo rosto, sem mouse" },
  { icon: ShieldCheck, text: "Escolhas salvas só no aparelho do estudante" },
];

export function AccessibilityAdmin({
  projectName,
  projectLogo,
  canManage,
  sdkKey,
  hosts,
  initial,
  updatedAt,
}: {
  hosts: string[];
  projectName: string;
  projectLogo: string;
  canManage: boolean;
  sdkKey: string | null;
  initial: { enabled: boolean; config: A11yConfig };
  updatedAt: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [config, setConfig] = useState<A11yConfig>(initial.config);
  const [studentsText, setStudentsTextRaw] = useState(initial.config.nudge.students.join("\n"));
  const [baseline, setBaseline] = useState(() => JSON.stringify({ enabled: initial.enabled, config: initial.config }));
  const [tab, setTab] = useState<Tab>("features");
  const [view, setView] = useState<PreviewView>("panel");
  const [saving, startSaving] = useTransition();

  const patch = (fn: (c: A11yConfig) => A11yConfig) => setConfig((c) => fn(c));
  const setStudentsText = (v: string) => {
    setStudentsTextRaw(v);
    patch((c) => ({ ...c, nudge: { ...c.nudge, students: parseStudentList(v) } }));
  };

  // a prévia recebe o que o SDK receberia: normalizado e sem a lista individual
  const previewConfig = useMemo(() => publicA11yConfig(normalizeA11yConfig(config)), [config]);
  const dirty = JSON.stringify({ enabled, config }) !== baseline;

  function changeTab(t: Tab) {
    setTab(t);
    setView(VIEW_FOR_TAB[t]);
  }

  function save(nextEnabled = enabled) {
    if (!canManage) return toast("error", "Só donos e administradores podem alterar o plugin.");
    startSaving(async () => {
      const r = await saveAccessibilityAction({ enabled: nextEnabled, config });
      if (!r.ok) return toast("error", r.error);
      setEnabled(nextEnabled);
      setConfig(r.config);
      setStudentsTextRaw(r.config.nudge.students.join("\n"));
      setBaseline(JSON.stringify({ enabled: nextEnabled, config: r.config }));
      toast("success", nextEnabled !== enabled ? (nextEnabled ? "Plugin ativado. Ele aparece no produto em até 1 minuto." : "Plugin desativado.") : "Configurações salvas.");
      router.refresh();
    });
  }

  function discard() {
    const base = JSON.parse(baseline) as { enabled: boolean; config: A11yConfig };
    setEnabled(base.enabled);
    setConfig(base.config);
    setStudentsTextRaw(base.config.nudge.students.join("\n"));
  }

  const featureCount = FEATURES.filter((f) => config.features[f.id]).length;

  return (
    <div className="flex flex-col gap-6">

      {/* cabeçalho */}
      <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-md bg-surface-brand px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Acessibilidade</span>
            <Badge tone="brand" dot={false}>Novo</Badge>
          </div>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight md:text-[34px] md:leading-tight">Plugin de acessibilidade</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-fg-mut">
            Leitura, cores, Libras e navegação sem mouse dentro do produto do cliente. Tudo é configurado aqui e chega ao produto pelo SDK que ele já instalou — sem código novo.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-center gap-2 text-sm text-fg-soft">
                <span className="grid size-7 place-items-center rounded-lg bg-surface-brand text-accent">
                  <h.icon className="size-3.5" />
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative hidden shrink-0 items-center gap-1 md:flex" aria-hidden>
          <div className="relative max-w-[240px] rounded-2xl border border-accent/15 bg-bg-elev px-4 py-3 text-sm font-medium leading-snug text-accent shadow-[0_8px_24px_rgba(75,28,171,.10)]">
            Todo estudante merece aprender do seu jeito. ✨
            <span className="absolute -right-1.5 top-1/2 size-3 -translate-y-1/2 rotate-45 border-r border-t border-accent/15 bg-bg-elev" />
          </div>
          <Mascot name="Apaixonado" size={112} float />
        </div>
      </header>

      {/* status */}
      <section className={cn("flex flex-col gap-4 rounded-2xl border p-5 md:flex-row md:items-center", enabled ? "border-sucesso/40 bg-[#F0FDF4] dark:bg-sucesso/10" : "border-line bg-bg-elev")}>
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", enabled ? "bg-sucesso text-white" : "bg-bg-sunken text-fg-mut")}>
          <Power className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{enabled ? `Ativo em ${projectName}` : `Desligado em ${projectName}`}</p>
          <p className="text-sm text-fg-mut">
            {enabled
              ? `O botão de acessibilidade aparece para todos os estudantes, com ${featureCount} recursos${config.nudge.enabled ? " e o convite ligado" : ""}.`
              : "Ninguém vê o botão no produto. Configure abaixo, confira na prévia e ative quando estiver pronto."}
            {!sdkKey && " Este projeto ainda não tem o SDK instalado."}
          </p>
          {updatedAt && <p className="mt-1 text-xs text-fg-mut">Última alteração em {new Date(updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>}
        </div>
        <div className="flex items-center gap-3">
          {!canManage && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-fg-mut">
              <Lock className="size-3.5" /> Só leitura
            </span>
          )}
          <label className="flex items-center gap-2 text-sm font-semibold">
            {saving ? <Loader2 className="size-4 animate-spin text-fg-mut" /> : null}
            {enabled ? "Ativo" : "Ativar"}
            <span className={cn(!canManage && "pointer-events-none opacity-50")}>
              <Switch checked={enabled} onChange={(v) => save(v)} label="Plugin de acessibilidade ativo no produto" />
            </span>
          </label>
        </div>
      </section>

      {/* editor + prévia */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="min-w-0">
          <div className="mb-4">
            <Tabs tabs={TABS} value={tab} onChange={(v) => changeTab(v as Tab)} />
          </div>
          {tab === "features" && <FeaturesTab config={config} patch={patch} />}
          {tab === "appearance" && <AppearanceTab config={config} patch={patch} projectLogo={projectLogo} />}
          {tab === "libras" && <LibrasTab config={config} patch={patch} projectName={projectName} hosts={hosts} />}
          {tab === "nudge" && (
            <NudgeTab config={config} patch={patch} studentsText={studentsText} setStudentsText={setStudentsText} studentCount={config.nudge.students.length} />
          )}
        </div>

        <aside className="min-w-0">
          <div className="sticky top-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-accent" /> Prévia no produto do cliente
              </p>
              <span className="text-xs text-fg-mut">ao vivo · não salva nada</span>
            </div>
            <LivePreview config={previewConfig} view={view} onView={setView} />
            <p className="text-xs leading-relaxed text-fg-mut">
              A prévia roda o mesmo código que vai para o produto. Clique nos botões dela à vontade: as escolhas ficam só nesta tela.
              {view === "face" && " A navegação por rosto pede a câmera do seu computador."}
            </p>
          </div>
        </aside>
      </div>

      {/* barra de salvar: presa ao pé da área de conteúdo enquanto houver alteração */}
      {dirty && (
        <div className="sticky bottom-4 z-30 mx-auto w-full max-w-3xl animate-[luumuFade_.2s_ease-out]">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg-elev/95 px-4 py-3 shadow-[var(--shadow-lg)] backdrop-blur">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className="size-2 rounded-full bg-aviso" /> Alterações não salvas
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={discard} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-fg-mut hover:text-fg">
                <RotateCcw className="size-4" /> Descartar
              </button>
              <button
                type="button"
                onClick={() => save()}
                disabled={saving || !canManage}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 disabled:opacity-50 [background:var(--grad-roxo)]"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {enabled ? "Salvar e publicar" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

