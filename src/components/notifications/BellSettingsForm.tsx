"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { HostPicker } from "@/components/ui/HostPicker";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { saveBellSettingsAction } from "@/app/(app)/notifications/actions";
import { BELL_SLOT_ID, DEFAULT_ACCENT, parseAudienceList, type BellPlacement, type BellSettings } from "@/lib/notifications/model";
import { BellButton, PanelPreview } from "./BellPreview";

const PLACEMENTS: { value: BellPlacement; label: string; hint: string }[] = [
  { value: "slot", label: "No espaço reservado do header", hint: `O produto coloca <div id="${BELL_SLOT_ID}"></div> onde o sino deve ficar. Recomendado: não depende do layout.` },
  { value: "selector", label: "Dentro de um elemento do site", hint: "Um seletor CSS do header (ex.: .header-actions). Pode precisar de ajuste se o layout mudar." },
  { value: "floating", label: "Flutuante num canto da tela", hint: "Não precisa de nada no produto; aparece em todas as telas do usuário identificado." },
];

export function BellSettingsForm({ initial, hosts, canEdit }: { initial: BellSettings; hosts: string[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState<BellSettings>(initial);
  const [testersText, setTestersText] = useState(initial.testers.join("\n"));
  const [saving, start] = useTransition();
  const set = <K extends keyof BellSettings>(k: K, v: BellSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const testers = parseAudienceList(testersText).slice(0, 50);

  function save() {
    start(async () => {
      const res = await saveBellSettingsAction({ ...s, testers });
      if (res.ok) {
        toast("success", s.enabled ? "Sino salvo. As mudanças chegam ao produto em até 10 minutos." : "Configuração salva. O sino está desligado.");
        router.refresh();
      } else toast("error", res.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-5">
        <Card className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold">Sino ligado neste projeto</h2>
            <p className="mt-1 text-sm text-fg-mut">Aparece só para estudantes identificados (Luumu.identify com id ou e-mail), no ambiente logado.</p>
          </div>
          <Switch checked={s.enabled} onChange={(v) => set("enabled", v)} label="Sino ligado" />
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="font-display text-base font-bold">Onde o sino aparece</h2>
          {hosts.length > 0 && (
            <Field label="Plataformas" hint="Nenhuma marcada = em todas as plataformas do projeto.">
              <HostPicker hosts={hosts} selected={s.hosts} onChange={(v) => set("hosts", v)} />
            </Field>
          )}
          <div className="grid gap-2" role="radiogroup" aria-label="Posição do sino">
            {PLACEMENTS.map((p) => (
              <label
                key={p.value}
                className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition", s.placement === p.value ? "border-accent bg-surface-brand" : "border-line")}
              >
                <input type="radio" className="mt-0.5 accent-[var(--accent)]" checked={s.placement === p.value} onChange={() => set("placement", p.value)} />
                <span>
                  <span className="font-semibold">{p.label}</span>
                  <span className="block text-xs text-fg-mut">{p.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {s.placement === "slot" && (
            <Field label="Peça ao time do produto para colocar no header" hint="O sino entra dentro deste elemento e herda a cor do texto do header.">
              <CodeBlock lang="html" code={`<div id="${BELL_SLOT_ID}"></div>`} />
            </Field>
          )}
          {s.placement === "selector" && (
            <Field label="Seletor CSS" hint="O sino entra no fim deste elemento. Se ele não existir na tela (ex.: página de login), o sino não aparece.">
              <Input value={s.selector} onChange={(e) => set("selector", e.target.value)} placeholder=".header-actions" className="font-mono text-[13px]" />
            </Field>
          )}
          {s.placement === "floating" && (
            <Field label="Canto">
              <Select value={s.corner} onChange={(e) => set("corner", e.target.value as BellSettings["corner"])}>
                <option value="bottom-right">Inferior direito</option>
                <option value="bottom-left">Inferior esquerdo</option>
                <option value="top-right">Superior direito</option>
              </Select>
            </Field>
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="font-display text-base font-bold">Aparência</h2>
          <Field label="Cor de destaque" hint="Botões, aba ativa e o fundo das não lidas.">
            <div className="flex items-center gap-2">
              <input type="color" value={s.accent} onChange={(e) => set("accent", e.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-transparent p-1" />
              <Input value={s.accent} onChange={(e) => set("accent", e.target.value)} className="w-32 font-mono text-[13px]" />
              {s.accent !== DEFAULT_ACCENT && (
                <button type="button" className="text-xs font-semibold text-fg-mut hover:text-accent" onClick={() => set("accent", DEFAULT_ACCENT)}>
                  Usar a padrão
                </button>
              )}
            </div>
          </Field>
          <Field label="Texto do painel vazio">
            <Input value={s.emptyText} maxLength={140} onChange={(e) => set("emptyText", e.target.value)} />
          </Field>
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="font-display text-base font-bold">Usuários de teste</h2>
          <Field
            label="IDs ou e-mails"
            hint={`Recebem os recados "Enviar para teste" antes de irem para todos. Um por linha, até 50 (${testers.length} agora). Os mesmos valores do identify.`}
          >
            <Textarea rows={4} value={testersText} onChange={(e) => setTestersText(e.target.value)} placeholder={"voce@jovensgenios.com"} className="font-mono text-[13px]" />
          </Field>
        </Card>

        {canEdit && (
          <div>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar configuração
            </Button>
          </div>
        )}
      </fieldset>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-fg-mut">
          Prévia <BellButton accent={/^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : DEFAULT_ACCENT} count={2} floating={s.placement === "floating"} />
        </div>
        <div className="rounded-2xl border border-line bg-bg-sunken p-4">
          <PanelPreview
            accent={/^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : DEFAULT_ACCENT}
            emptyText={s.emptyText}
            items={[
              { id: "a", title: "Simulado geral no sábado", body: "Das 9h às 12h, com todas as matérias do bimestre.", category: "evento", ctaLabel: "Ver detalhes", when: "Hoje às 13:56", unread: true },
              { id: "b", title: "Nova trilha de Física", body: "Ondas e som já estão disponíveis na sua página inicial.", category: "novidade", when: "Ontem às 09:42" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
