"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FlaskConical, Loader2, Pin, Save, Send } from "lucide-react";
import Link from "@/components/ui/Link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { SegmentedControl } from "@/components/ui/Tabs";
import { HostPicker } from "@/components/ui/HostPicker";
import { SchoolYearPicker } from "@/components/surveys/SchoolYearPicker";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { saveNotificationAction } from "@/app/(app)/notifications/actions";
import {
  LIMITS,
  NOTIFICATION_CATEGORIES,
  parseAudienceList,
  validUrl,
  type NotificationCategory,
} from "@/lib/notifications/model";
import { BellButton, CategoryIcon, PanelPreview } from "./BellPreview";

export interface EditorValues {
  id?: string;
  title: string;
  body: string;
  category: NotificationCategory;
  ctaLabel: string;
  ctaUrl: string;
  schoolYears: string[];
  list: string[];
  hosts: string[];
  pinned: boolean;
  /** "YYYY-MM-DDTHH:mm" no fuso do workspace; "" = assim que publicar / não expira */
  publishAt: string;
  expiresAt: string;
  status: string;
}

type AudienceMode = "todos" | "anos" | "lista";
type When = "now" | "schedule";

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={cn("text-xs tabular-nums", value.length > max ? "text-erro" : "text-fg-mut")}>{value.length}/{max}</span>;
}

export function NotificationEditor({
  initial,
  hosts,
  testers,
  accent,
  emptyText,
  canEdit,
  bellEnabled,
  defaultExpires,
}: {
  initial: EditorValues;
  hosts: string[];
  /** quantos usuários de teste o projeto tem */
  testers: number;
  accent: string;
  emptyText: string;
  canEdit: boolean;
  bellEnabled: boolean;
  /** sugestão de fim para recados novos ("YYYY-MM-DDTHH:mm", daqui a 7 dias) */
  defaultExpires: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<EditorValues>(initial);
  const [listText, setListText] = useState(initial.list.join("\n"));
  const [audience, setAudience] = useState<AudienceMode>(initial.list.length ? "lista" : initial.schoolYears.length ? "anos" : "todos");
  const [when, setWhen] = useState<When>(initial.publishAt ? "schedule" : "now");
  const [expires, setExpires] = useState(initial.expiresAt ? "date" : initial.id ? "never" : "date");
  const [saving, start] = useTransition();
  const set = <K extends keyof EditorValues>(k: K, value: EditorValues[K]) => setV((p) => ({ ...p, [k]: value }));

  const list = audience === "lista" ? parseAudienceList(listText) : [];
  const expiresAt = expires === "never" ? "" : v.expiresAt || defaultExpires;
  const urlBad = !!v.ctaUrl && !validUrl(v.ctaUrl);
  const isLive = v.status === "publicada";

  function submit(intent: "rascunho" | "teste" | "publicada") {
    start(async () => {
      const res = await saveNotificationAction({
        id: v.id,
        title: v.title,
        body: v.body,
        category: v.category,
        ctaLabel: v.ctaUrl ? v.ctaLabel : "",
        ctaUrl: v.ctaLabel ? v.ctaUrl : "",
        schoolYears: audience === "anos" ? v.schoolYears : [],
        list,
        hosts: v.hosts,
        pinned: v.pinned,
        publishAt: when === "schedule" ? v.publishAt : "",
        expiresAt,
        intent,
      });
      if (!res.ok) {
        toast("error", res.error);
        return;
      }
      toast(
        "success",
        intent === "rascunho" ? "Rascunho salvo." : intent === "teste" ? "Enviada para os usuários de teste." : when === "schedule" ? "Notificação agendada." : "Notificação publicada."
      );
      if (intent === "rascunho" && res.id && !v.id) router.replace(`/notifications/${res.id}`);
      else if (intent !== "rascunho") router.push("/notifications");
      else router.refresh();
    });
  }

  const preview = [
    { id: "x", title: v.title, body: v.body, category: v.category, ctaLabel: v.ctaUrl ? v.ctaLabel : "", when: "Agora", pinned: v.pinned, unread: true },
    { id: "y", title: "Bem-vindo de volta!", body: "Confira as novidades da semana na sua página inicial.", category: "novidade" as const, when: "Ontem às 09:42" },
  ];

  const disabled = !canEdit || saving;

  return (
    <div>
      <Link href="/notifications" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-mut hover:text-accent">
        <ArrowLeft className="size-4" /> Notificações
      </Link>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">{v.id ? "Editar recado" : "Novo recado"}</h1>
          <p className="mt-1.5 text-sm text-fg-mut">Uma mensagem que aparece no sino dos estudantes, no produto.</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => submit("rascunho")}>
              <Save className="size-4" /> Salvar rascunho
            </Button>
            <Button
              variant="subtle"
              size="sm"
              disabled={disabled || testers === 0}
              title={testers === 0 ? "Cadastre usuários de teste em Sino e instalação" : undefined}
              onClick={() => submit("teste")}
            >
              <FlaskConical className="size-4" /> Enviar para teste
            </Button>
            <Button size="sm" disabled={disabled} onClick={() => submit("publicada")}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {isLive ? "Salvar alterações" : when === "schedule" ? "Agendar" : "Publicar"}
            </Button>
          </div>
        )}
      </div>

      {!bellEnabled && (
        <div className="mb-5 rounded-xl border border-aviso/40 bg-aviso/10 px-4 py-3 text-sm text-fg-soft">
          O sino está desligado neste projeto: os recados só aparecem para os estudantes depois de ligá-lo em{" "}
          <Link href="/notifications?tab=sino" className="font-semibold text-accent">Sino e instalação</Link>.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-5">
          <Card className="flex flex-col gap-4">
            <Field label="Título" action={<Counter value={v.title} max={LIMITS.title} />}>
              <Input value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Simulado geral no sábado" autoFocus={!v.id} />
            </Field>
            <Field label="Mensagem" action={<Counter value={v.body} max={LIMITS.body} />}>
              <Textarea rows={3} value={v.body} onChange={(e) => set("body", e.target.value)} placeholder="O que o estudante precisa saber, em uma ou duas frases." />
            </Field>
            <Field label="Categoria" hint="Define o ícone e a cor no painel do estudante.">
              <div className="flex flex-wrap gap-2">
                {NOTIFICATION_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set("category", c.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                      v.category === c.id ? "border-accent bg-surface-brand text-fg" : "border-line text-fg-soft hover:border-line-strong"
                    )}
                  >
                    <CategoryIcon category={c.id} size={26} /> {c.label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
              <Field label="Botão (opcional)" action={<Counter value={v.ctaLabel} max={LIMITS.ctaLabel} />}>
                <Input value={v.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} placeholder="Ex.: Ver simulado" />
              </Field>
              <Field label="Link do botão" hint='Página do produto ("/simulados") ou endereço https://'>
                <Input value={v.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} placeholder="/simulados" className={cn(urlBad && "border-erro")} />
              </Field>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
              <span className="flex items-center gap-2.5 text-sm">
                <Pin className="size-4 text-accent" />
                <span>
                  <span className="font-semibold">Fixar no topo</span>
                  <span className="block text-xs text-fg-mut">Fica acima das outras enquanto estiver no ar.</span>
                </span>
              </span>
              <Switch checked={v.pinned} onChange={(x) => set("pinned", x)} label="Fixar no topo" />
            </label>
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="font-display text-base font-bold">Para quem</h2>
            <SegmentedControl<AudienceMode>
              value={audience}
              onChange={setAudience}
              options={[
                { value: "todos", label: "Todos os estudantes" },
                { value: "anos", label: "Anos escolares" },
                { value: "lista", label: "Lista de estudantes" },
              ]}
            />
            {audience === "anos" && (
              <>
                <SchoolYearPicker selected={v.schoolYears} onChange={(x) => set("schoolYears", x)} />
                <p className="text-xs text-fg-mut">Usa o ano escolar que o produto envia no identify (ou que a Luumu lê da tela).</p>
              </>
            )}
            {audience === "lista" && (
              <Field label="IDs ou e-mails" hint={`Um por linha (ou separados por vírgula). ${list.length} ${list.length === 1 ? "estudante" : "estudantes"}. Os mesmos valores que o produto envia no identify.`}>
                <Textarea rows={5} value={listText} onChange={(e) => setListText(e.target.value)} placeholder={"8812\nana.souza@escola.com"} className="font-mono text-[13px]" />
              </Field>
            )}
            {hosts.length > 1 && (
              <Field label="Plataformas" hint="Nenhuma marcada = todas as plataformas onde o sino está ligado.">
                <HostPicker hosts={hosts} selected={v.hosts} onChange={(x) => set("hosts", x)} />
              </Field>
            )}
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="font-display text-base font-bold">Quando</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Entra no ar">
                <SegmentedControl<When> value={when} onChange={setWhen} options={[{ value: "now", label: "Ao publicar" }, { value: "schedule", label: "Agendar" }]} />
                {when === "schedule" && <Input type="datetime-local" value={v.publishAt} onChange={(e) => set("publishAt", e.target.value)} className="mt-2" />}
              </Field>
              <Field label="Sai do ar">
                <SegmentedControl value={expires} onChange={setExpires} options={[{ value: "date", label: "Em uma data" }, { value: "never", label: "Não expira" }]} />
                {expires === "date" && <Input type="datetime-local" value={expiresAt} onChange={(e) => set("expiresAt", e.target.value)} className="mt-2" />}
              </Field>
            </div>
            <p className="text-xs text-fg-mut">
              Horários de Brasília. Um recado publicado agora chega em até 10 minutos para quem já está navegando; os agendados entram na hora marcada.
            </p>
          </Card>
        </fieldset>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-fg-mut">
            Prévia no produto <BellButton accent={accent} count={1} />
          </div>
          <div className="rounded-2xl border border-line bg-bg-sunken p-4">
            <PanelPreview items={preview} accent={accent} emptyText={emptyText} />
          </div>
        </div>
      </div>
    </div>
  );
}
