"use client";

import { useState, useTransition } from "react";
import { Zap, Loader2, Check } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { saveSettingsAction } from "@/app/(app)/surveys/actions";

const triggers = [
  "Ao finalizar compra", "Ao criar conta", "Ao concluir onboarding",
  "Ao cancelar assinatura", "Ao usar determinada feature",
  "Após X dias de inatividade", "Ao sair da página",
];

export interface SettingsValues {
  id: string;
  channel: string;
  audience: string;
  segment: string;
  language: string;
  trigger: string;
  triggerEvent: string;
  frequency: string;
  delay: string;
  startsAt: string;
  endsAt: string;
}

export interface WorkspaceEvent {
  name: string;
  count: number;
  lastSeenAt: Date | string;
}

export function SurveySettingsForm({
  initial,
  events = [],
}: {
  initial: SettingsValues;
  events?: WorkspaceEvent[];
}) {
  const [v, setV] = useState(initial);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const toast = useToast();

  const set = (patch: Partial<SettingsValues>) => setV((s) => ({ ...s, ...patch }));

  function save() {
    startSaving(async () => {
      // "" no seletor de evento → null (sem gatilho por evento)
      await saveSettingsAction({ ...v, triggerEvent: v.triggerEvent || null });
      setSaved(true);
      toast("success", "Configurações salvas.");
      setTimeout(() => setSaved(false), 1800);
    });
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Público & segmento</CardTitle>
          <div className="mt-4 flex flex-col gap-4">
            <Field label="Público">
              <Select value={v.audience} onChange={(e) => set({ audience: e.target.value })}>
                <option>Todos os usuários</option>
                <option>Novos usuários (&lt; 30 dias)</option>
                <option>Clientes pagantes</option>
                <option>Usuários em trial</option>
              </Select>
            </Field>
            <Field label="Segmento">
              <Select value={v.segment} onChange={(e) => set({ segment: e.target.value })}>
                <option>Todos</option>
                <option>Brasil · Plano Growth</option>
                <option>Enterprise</option>
                <option>Free</option>
              </Select>
            </Field>
            <Field label="Idioma">
              <Select value={v.language} onChange={(e) => set({ language: e.target.value })}>
                <option value="pt">Português (BR)</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
              </Select>
            </Field>
            <Field label="Canal">
              <Select value={v.channel} onChange={(e) => set({ channel: e.target.value })}>
                <option>In-app</option>
                <option>E-mail</option>
                <option>Link</option>
                <option>WhatsApp</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-accent" />
            <CardTitle>Trigger & frequência</CardTitle>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <Field label="Contexto de disparo">
              <Select value={v.trigger} onChange={(e) => set({ trigger: e.target.value })}>
                {triggers.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Gatilho por evento (SDK)">
              <Select value={v.triggerEvent} onChange={(e) => set({ triggerEvent: e.target.value })}>
                <option value="">Nenhum — exibir no carregamento</option>
                {events.map((ev) => (
                  <option key={ev.name} value={ev.name}>
                    {ev.name} · {ev.count} {ev.count === 1 ? "evento" : "eventos"}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Frequência">
                <Select value={v.frequency} onChange={(e) => set({ frequency: e.target.value })}>
                  <option>Uma vez por usuário</option>
                  <option>Recorrente (30 dias)</option>
                  <option>Sempre</option>
                </Select>
              </Field>
              <Field label="Atraso">
                <Input value={v.delay} onChange={(e) => set({ delay: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início">
                <Input type="date" value={v.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
              </Field>
              <Field label="Fim">
                <Input type="date" value={v.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
              </Field>
            </div>
            <div className="rounded-xl bg-bg-sunken p-3">
              {events.length === 0 ? (
                <p className="text-xs leading-relaxed text-fg-mut">
                  Nenhum evento rastreado ainda. Instale o SDK e chame{" "}
                  <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px]">luumu.track(&quot;seu_evento&quot;)</code>{" "}
                  no seu produto — os eventos aparecerão aqui para servir de gatilho.
                </p>
              ) : v.triggerEvent ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-fg-soft">
                  <span>Dispara quando o SDK registrar</span>
                  <Badge tone="brand" dot={false}>{v.triggerEvent}</Badge>
                </div>
              ) : (
                <p className="text-xs text-fg-mut">
                  Sem gatilho por evento: a pesquisa aparece no carregamento (respeitando frequência).
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
          {saved ? "Salvo" : "Salvar configurações"}
        </Button>
      </div>
    </>
  );
}
