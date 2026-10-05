"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronRight, Globe, Layers, Loader2, ScanFace, ShieldCheck, SlidersHorizontal, Terminal } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { saveCaptureRuleAction, setIdentityCaptureAction } from "@/app/(app)/settings/actions";
import { isSafeSelector, stabilizeSelector } from "@/lib/analytics/selectors";

/*
  Nome e foto dos usuários sem mexer no Luumu.identify do produto: o SDK lê o que a tela já
  mostra. LIGAR é da workspace; ONDE PROCURAR é de cada projeto e plataforma, porque cada produto
  tem seu HTML (Geniex ≠ Exploradores ≠ Educadores).
*/

type Mode = "auto" | "selectors";
export interface Rule {
  host: string;
  mode: Mode;
  nameSelector: string;
  avatarSelector: string;
}
export interface Coverage {
  host: string;
  identified: number;
  withName: number;
  withAvatar: number;
}
export interface CaptureStatusProps {
  hosts: Coverage[];
  withoutAnalytics: string[];
  analyticsOn: boolean;
}

const short = (h: string) => h.replace(/^www\./, "").split(".")[0];

/** Regra efetiva de uma plataforma e de onde ela vem. */
function effective(rules: Rule[], host: string): { rule: Rule | null; from: "platform" | "project" | "auto" } {
  const own = host ? rules.find((r) => r.host === host) : undefined;
  if (own) return { rule: own, from: "platform" };
  const def = rules.find((r) => r.host === "");
  if (def) return { rule: def, from: host ? "project" : "platform" };
  return { rule: null, from: "auto" };
}
const modeLabel = (rules: Rule[], host: string) => {
  const e = effective(rules, host);
  const m = e.rule?.mode === "selectors" ? "Seletores" : "Automático";
  return e.from === "project" ? `${m} (padrão)` : m;
};

export function IdentityCaptureCard({
  enabled,
  canManage,
  projectName,
  hosts,
  rules,
  status,
  unavailable = false,
}: {
  enabled: boolean;
  canManage: boolean;
  projectName: string;
  /** plataformas do projeto (onde o SDK já rodou) */
  hosts: string[];
  rules: Rule[] | null;
  status: CaptureStatusProps | null;
  /** migrações 0023/0025 ainda não aplicadas */
  unavailable?: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  if (unavailable || !rules) {
    return (
      <Card>
        <div className="flex items-center gap-2">
          <ScanFace className="size-4 text-accent" />
          <CardTitle>Nome e foto dos usuários</CardTitle>
        </div>
        <p className="mt-2 text-xs text-fg-mut">Falta aplicar as migrações do banco (db/migrations/0023_identity_capture.sql e 0025_identity_capture_rules.sql).</p>
      </Card>
    );
  }

  const coverage = new Map((status?.hosts ?? []).map((h) => [h.host, h]));
  // plataformas: as que têm uso nas últimas 24 h primeiro, depois as demais do projeto
  const platforms = [...new Set([...(status?.hosts ?? []).map((h) => h.host), ...hosts])];

  function toggle(next: boolean) {
    if (!canManage) return;
    setOn(next);
    start(async () => {
      const r = await setIdentityCaptureAction(next);
      if (!r.ok) {
        setOn(!next);
        return toast("error", r.error ?? "Não foi possível salvar.");
      }
      toast("success", next ? "Captura ativada! Os navegadores recebem a configuração em até 30 min." : "Captura desligada.");
      router.refresh();
    });
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScanFace className="size-4 text-accent" />
          <CardTitle>Nome e foto dos usuários</CardTitle>
        </div>
        <Switch checked={on} label="Capturar nome e foto" onChange={toggle} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-fg-mut">
        Sem mudar nada no seu produto: o SDK lê o nome e a foto que a tela já mostra para o usuário logado e exibe em{" "}
        <strong>Analytics → Usuários</strong>. Ligar vale para a workspace inteira; <strong>onde procurar</strong> é configurado por projeto e
        plataforma.
      </p>

      {on && (
        <div className="mt-3 rounded-xl border border-line">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-mut">Projeto {projectName}</span>
            <span className="shrink-0 text-[10px] text-fg-mut">últimas 24 h</span>
          </div>
          {status && !status.analyticsOn ? (
            <p className="flex items-start gap-2 p-3 text-[11px] leading-relaxed text-fg-soft">
              <AlertTriangle className="mt-px size-3.5 shrink-0 text-aviso" />
              O Analytics está desligado neste projeto: a captura só roda onde ele está ativo.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              <li className="flex items-center gap-2 px-3 py-2 text-xs">
                <Layers className="size-3.5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate font-semibold">Todas as plataformas</span>
                <span className="shrink-0 text-fg-mut">{modeLabel(rules, "")}</span>
              </li>
              {platforms.slice(0, 6).map((h) => {
                const c = coverage.get(h);
                const pct = c && c.identified ? Math.round((c.withName / c.identified) * 100) : null;
                return (
                  <li key={h} className="flex items-center gap-2 px-3 py-2 text-xs" title={`${h} · ${modeLabel(rules, h)}`}>
                    <span className={cn("size-2 shrink-0 rounded-full", pct === null ? "bg-line-strong" : pct >= 50 ? "bg-sucesso" : pct > 0 ? "bg-aviso" : "bg-erro")} />
                    <span className="min-w-0 flex-1 truncate">{short(h)}</span>
                    <span className="shrink-0 tabular-nums text-fg-mut">{c ? `${c.withName}/${c.identified} c/ nome` : "sem uso"}</span>
                  </li>
                );
              })}
              {platforms.length > 6 && <li className="px-3 py-1.5 text-[11px] text-fg-mut">+{platforms.length - 6} plataformas</li>}
            </ul>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex w-full items-center justify-between gap-2 border-t border-line px-3 py-2.5 text-sm font-semibold text-accent transition hover:bg-surface-brand/40"
            >
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal className="size-4" /> Configurar plataformas
              </span>
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      )}

      {on && status && status.withoutAnalytics.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-aviso/10 p-2 text-[11px] leading-relaxed text-fg-soft">
          <AlertTriangle className="mt-px size-3.5 shrink-0 text-aviso" />
          <span>
            Sem Analytics ativo (a captura não roda): <strong>{status.withoutAnalytics.join(", ")}</strong>.
          </span>
        </div>
      )}

      {on && (
        <div className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-fg-mut">
          <Terminal className="mt-px size-3.5 shrink-0 text-accent" />
          <span>
            Para testar: abra a plataforma logado e rode{" "}
            <code className="rounded bg-bg-sunken px-1 py-px font-mono text-[11px] text-fg-soft">Luumu.debugIdentity()</code> no console.
          </span>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-bg-sunken p-2.5 text-[11px] leading-relaxed text-fg-mut">
        <ShieldCheck className="mt-px size-3.5 shrink-0 text-sucesso" />
        Só de usuários identificados (logados), só o que está visível na tela: nunca campos de formulário, cookies ou senhas. Ative com o aval de quem é
        responsável pelos dados dos usuários (LGPD).
      </div>
      {!canManage && <p className="mt-2 text-[11px] text-fg-mut">Só donos e administradores podem alterar.</p>}

      {open && <PlatformsDialog projectName={projectName} platforms={platforms} rules={rules} coverage={coverage} onClose={() => setOpen(false)} />}
    </Card>
  );
}

/* ---------- editor por plataforma ---------- */

function PlatformsDialog({
  projectName,
  platforms,
  rules,
  coverage,
  onClose,
}: {
  projectName: string;
  platforms: string[];
  rules: Rule[];
  coverage: Map<string, Coverage>;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<string>("");
  return (
    <Dialog
      title={`Onde estão nome e foto — ${projectName}`}
      description="Cada produto tem seu próprio HTML. Defina um padrão para todas as plataformas deste projeto e ajuste só as que forem diferentes."
      size="xl"
      onClose={onClose}
    >
      <div className="grid min-h-[380px] gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Plataformas" className="flex flex-col gap-1 md:border-r md:border-line md:pr-3">
          <TargetButton active={target === ""} onClick={() => setTarget("")} icon={<Layers className="size-4" />} label="Todas as plataformas" hint={modeLabel(rules, "")} />
          <div className="px-2 pb-1 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-mut">Plataformas</div>
          <div className="flex max-h-[340px] flex-col gap-1 overflow-y-auto">
            {platforms.length === 0 && <p className="px-2 text-xs text-fg-mut">Nenhuma plataforma detectada ainda.</p>}
            {platforms.map((h) => {
              const c = coverage.get(h);
              return (
                <TargetButton
                  key={h}
                  active={target === h}
                  onClick={() => setTarget(h)}
                  icon={<Globe className="size-4" />}
                  label={short(h)}
                  title={h}
                  hint={`${modeLabel(rules, h)}${c ? ` · ${c.withName}/${c.identified} c/ nome` : ""}`}
                />
              );
            })}
          </div>
        </nav>
        {/* key: trocar de plataforma recomeça o formulário com a regra dela */}
        <RuleEditor key={target} host={target} projectName={projectName} rules={rules} coverage={target ? coverage.get(target) : undefined} />
      </div>
    </Dialog>
  );
}

function TargetButton({ active, onClick, icon, label, hint, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; hint: string; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-current={active}
      className={cn("flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition", active ? "bg-surface-brand text-accent" : "text-fg-soft hover:bg-bg-sunken")}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="block truncate text-[11px] text-fg-mut">{hint}</span>
      </span>
    </button>
  );
}

function RuleEditor({ host, projectName, rules, coverage }: { host: string; projectName: string; rules: Rule[]; coverage?: Coverage }) {
  const own = rules.find((r) => r.host === host);
  const [mode, setMode] = useState<Mode | "inherit">(own ? own.mode : host ? "inherit" : "auto");
  const [nameSel, setNameSel] = useState(own?.nameSelector ?? "");
  const [avatarSel, setAvatarSel] = useState(own?.avatarSelector ?? "");
  const [busy, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const projectDefault = rules.find((r) => r.host === "");

  const options: { v: Mode | "inherit"; label: string }[] = host
    ? [
        { v: "inherit", label: "Padrão do projeto" },
        { v: "auto", label: "Automático" },
        { v: "selectors", label: "Seletores CSS" },
      ]
    : [
        { v: "auto", label: "Automático" },
        { v: "selectors", label: "Seletores CSS" },
      ];
  const invalid = mode === "selectors" && (!selectorOk(nameSel) || !selectorOk(avatarSel) || (!nameSel.trim() && !avatarSel.trim()));

  function save() {
    start(async () => {
      const r = await saveCaptureRuleAction({ host, mode, nameSelector: nameSel, avatarSelector: avatarSel });
      if (!r.ok) return toast("error", r.error ?? "Não foi possível salvar.");
      toast("success", host ? `Configuração de ${short(host)} salva.` : `Padrão de ${projectName} salvo.`);
      router.refresh();
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <h3 className="break-all font-display text-lg font-bold">{host ? host : `Todas as plataformas de ${projectName}`}</h3>
        <p className="mt-0.5 text-sm text-fg-mut">
          {host ? "Use o padrão do projeto ou ajuste só para esta plataforma." : "Vale para toda plataforma deste projeto que não tiver configuração própria."}
        </p>
      </div>

      {coverage && (
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Identificados", v: coverage.identified },
            { label: "Com nome", v: coverage.withName },
            { label: "Com foto", v: coverage.withAvatar },
          ].map((x) => (
            <div key={x.label} className="rounded-xl bg-bg-sunken px-2 py-2">
              <div className="font-display text-lg font-extrabold tabular-nums">{x.v.toLocaleString("pt-BR")}</div>
              <div className="text-[11px] text-fg-mut">{x.label} (24 h)</div>
            </div>
          ))}
        </div>
      )}

      <div className="inline-flex w-fit flex-wrap rounded-lg bg-bg-sunken p-0.5 text-xs font-semibold">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setMode(o.v)}
            className={cn("rounded-md px-3 py-1.5 transition", mode === o.v ? "bg-bg-elev text-fg shadow-[var(--shadow-sm)]" : "text-fg-mut")}
          >
            {o.label}
          </button>
        ))}
      </div>

      {mode === "inherit" && (
        <p className="rounded-xl bg-bg-sunken p-3 text-xs leading-relaxed text-fg-mut">
          Segue o padrão do projeto: <strong className="text-fg-soft">{projectDefault?.mode === "selectors" ? "seletores CSS" : "detecção automática"}</strong>.
        </p>
      )}
      {mode === "auto" && (
        <p className="rounded-xl bg-bg-sunken p-3 text-xs leading-relaxed text-fg-mut">
          Procura a foto de perfil no topo/menu da tela e o nome ao lado dela. Só aceita o que aparecer igual em duas telas diferentes da mesma pessoa e
          ignora mascotes, ícones e personagens. Se o produto não for reconhecido, use seletores.
        </p>
      )}
      {mode === "selectors" && (
        <div className="flex flex-col gap-3">
          <SelectorField label="Nome" value={nameSel} onChange={setNameSel} placeholder="ex.: header [data-user-name]" />
          <SelectorField label="Foto" value={avatarSel} onChange={setAvatarSel} placeholder="ex.: header img.avatar" />
          <p className="text-[11px] leading-relaxed text-fg-mut">
            Abra {host ? <strong>{host}</strong> : "a plataforma"} logado, clique com o botão direito no seu nome (ou na sua foto) → Inspecionar → no elemento
            destacado, botão direito → Copiar → Copiar seletor. Campo vazio = não procura.
          </p>
        </div>
      )}

      <div className="mt-auto flex justify-end border-t border-line pt-3">
        <Button size="sm" onClick={save} disabled={busy || invalid}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar {host ? short(host) : "padrão do projeto"}
        </Button>
      </div>
    </div>
  );
}

/** Vazio ou um seletor CSS válido e seguro. */
function selectorOk(s: string): boolean {
  if (!s.trim()) return true;
  if (!isSafeSelector(s.trim())) return false;
  try {
    document.createDocumentFragment().querySelector(s.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * Campo de seletor: ao colar/sair do campo, troca o ID gerado pelo React/Radix (que muda entre
 * telas e versões do produto) por um atributo estável e avisa; seletor inválido aparece na hora.
 */
function SelectorField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  const [note, setNote] = useState(false);
  const fix = (raw: string) => {
    const r = stabilizeSelector(raw);
    if (r.changed && r.value) setNote(true);
    onChange(r.value);
  };
  const bad = !selectorOk(value);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-fg-soft">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          e.preventDefault();
          fix(e.clipboardData.getData("text"));
        }}
        onBlur={(e) => fix(e.target.value)}
        placeholder={placeholder}
        aria-invalid={bad}
        className={cn("py-2 font-mono text-xs", bad && "border-erro focus:border-erro")}
      />
      {bad ? (
        <span className="text-[11px] text-erro">Seletor CSS inválido. Copie de novo pelo Inspecionar → Copiar → Copiar seletor.</span>
      ) : note ? (
        <span className="text-[11px] leading-relaxed text-sucesso">Ajustado: o ID automático do React (#radix-…) muda a cada tela, então usamos o botão do menu do usuário no lugar.</span>
      ) : null}
    </label>
  );
}
