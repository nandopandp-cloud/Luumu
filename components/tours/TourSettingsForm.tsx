"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Zap, Users, Globe, Repeat, Code2, Loader2, Check, Sparkles, UserPlus, UserCheck, Filter } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { HostPicker } from "@/components/ui/HostPicker";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { FREQUENCY_LABEL } from "@/lib/tours/frequency";
import type { Frequency, TourAudience, TourSettings, TriggerType } from "@/lib/tours/types";
import { saveTourDraftAction } from "@/app/(app)/tours/actions";
import { RulesEditor } from "./RulesEditor";

const TRIGGERS: { value: TriggerType; label: string; hint: string }[] = [
  { value: "first_access", label: "Primeiro acesso", hint: "Na primeira visita do usuário ao produto, neste dispositivo." },
  { value: "page_load", label: "Ao abrir uma página", hint: "Sempre que a página carregar (respeitando a frequência)." },
  { value: "event", label: "Após um evento", hint: "Quando um evento acontecer: um clique capturado ou um Luumu.track()." },
  { value: "manual", label: "Manual (via código)", hint: "Só quando o seu produto chamar Luumu.tours.start()." },
];

const AUDIENCES: { value: TourAudience["mode"]; label: string; hint: string; icon: React.ReactNode }[] = [
  { value: "all", label: "Todos os usuários", hint: "Sem restrição", icon: <Users className="size-4" /> },
  { value: "new", label: "Novos usuários", hint: "Primeiros 7 dias", icon: <UserPlus className="size-4" /> },
  { value: "existing", label: "Usuários existentes", hint: "Depois dos 7 dias", icon: <UserCheck className="size-4" /> },
  { value: "rules", label: "Segmento", hint: "Por plano, cargo...", icon: <Filter className="size-4" /> },
];

export function TourSettingsForm({
  tourId,
  initial,
  hosts,
  events,
}: {
  tourId: string;
  initial: TourSettings;
  hosts: string[];
  events: string[];
}) {
  const [s, setS] = useState(initial);
  const [saving, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const set = (patch: Partial<TourSettings>) => setS((cur) => ({ ...cur, ...patch }));
  const setTrigger = (patch: Partial<TourSettings["trigger"]>) => set({ trigger: { ...s.trigger, ...patch } });
  const setAudience = (patch: Partial<TourAudience>) => set({ audience: { ...s.audience, ...patch } });

  function save() {
    if (s.trigger.type === "event" && !s.trigger.event) return toast("error", "Escolha o evento que inicia o tour.");
    start(async () => {
      const res = await saveTourDraftAction({ id: tourId, settings: s });
      if (!res.ok) return toast("error", res.error);
      setS(res.settings);
      setSaved(true);
      toast("success", "Configurações salvas no rascunho. Publique para valer.");
      setTimeout(() => setSaved(false), 1800);
      router.refresh();
    });
  }

  const snippet = `// inicia este tour a partir do seu código (ex.: botão "Fazer tour")
Luumu.tours.start("${tourId}");`;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-accent" />
          <CardTitle>Quando o tour começa</CardTitle>
        </div>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Gatilho">
            {TRIGGERS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={s.trigger.type === t.value}
                onClick={() => setTrigger({ type: t.value })}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  s.trigger.type === t.value ? "border-accent bg-surface-brand/60" : "border-line hover:border-line-strong"
                )}
              >
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-fg-mut">{t.hint}</span>
              </button>
            ))}
          </div>
          {s.trigger.type === "event" && (
            <Field label="Evento" hint="Eventos que o SDK já capturou neste projeto, ou digite o nome de um Luumu.track().">
              <Input
                list="tour-events"
                value={s.trigger.event ?? ""}
                onChange={(e) => setTrigger({ event: e.target.value })}
                placeholder="project_created"
                className="font-mono text-sm"
              />
              <datalist id="tour-events">
                {events.slice(0, 300).map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </Field>
          )}
          {s.trigger.type !== "manual" && (
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label="Só nesta página (opcional)">
                <Input
                  value={s.trigger.route ?? ""}
                  onChange={(e) => setTrigger({ route: e.target.value.trim() || null })}
                  placeholder="Qualquer página"
                  className="font-mono text-sm"
                />
              </Field>
              <Field label="Atraso">
                <Select value={String(s.trigger.delaySec)} onChange={(e) => setTrigger({ delaySec: Number(e.target.value) })}>
                  {[0, 1, 2, 3, 5, 10, 30].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "Imediato" : `${n}s`}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <div className="rounded-xl bg-bg-sunken p-3.5">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-fg-soft">
              <Code2 className="size-3.5 text-accent" /> Iniciar pelo código (qualquer gatilho)
            </div>
            <CodeBlock code={snippet} lang="js" />
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-accent" />
            <CardTitle>Para quem</CardTitle>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Público">
            {AUDIENCES.map((a) => (
              <button
                key={a.value}
                type="button"
                role="radio"
                aria-checked={s.audience.mode === a.value}
                onClick={() => setAudience({ mode: a.value })}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                  s.audience.mode === a.value ? "border-accent bg-surface-brand/60" : "border-line hover:border-line-strong"
                )}
              >
                <span className="mt-0.5 text-accent">{a.icon}</span>
                <span>
                  <span className="block text-sm font-semibold">{a.label}</span>
                  <span className="block text-xs text-fg-mut">{a.hint}</span>
                </span>
              </button>
            ))}
          </div>
          {(s.audience.mode === "rules" || s.audience.rules.length > 0) && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-fg-soft">Condições</span>
                <Select
                  value={s.audience.match}
                  onChange={(e) => setAudience({ match: e.target.value as "all" | "any" })}
                  className="w-auto py-1 text-xs"
                  aria-label="Combinar condições"
                >
                  <option value="all">Todas devem valer</option>
                  <option value="any">Qualquer uma vale</option>
                </Select>
              </div>
              <RulesEditor rules={s.audience.rules} onChange={(rules) => setAudience({ rules })} />
              <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-fg-mut">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
                Os atributos vêm do Luumu.identify(&#123; plan, role, ... &#125;) chamado no seu produto.
              </p>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Repeat className="size-4 text-accent" />
            <CardTitle>Frequência</CardTitle>
          </div>
          <div className="mt-4">
            <Select value={s.frequency} onChange={(e) => set({ frequency: e.target.value as Frequency })}>
              {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABEL[f]}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-xs text-fg-mut">A memória é por usuário identificado (ou por navegador, se anônimo).</p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-accent" />
            <CardTitle>Plataforma</CardTitle>
          </div>
          <p className="mt-1 text-sm text-fg-mut">Em quais endereços deste projeto o tour pode aparecer.</p>
          <div className="mt-4">
            <HostPicker hosts={hosts} selected={s.targetHosts} onChange={(targetHosts) => set({ targetHosts })} />
          </div>
        </Card>
      </div>

      <div className="flex justify-end lg:col-span-2">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
          {saved ? "Salvo" : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}
