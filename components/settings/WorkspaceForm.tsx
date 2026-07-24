"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Check, Upload } from "lucide-react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { saveWorkspaceAction } from "@/app/(app)/settings/actions";

export interface WorkspaceValues {
  name: string;
  slug: string;
  timezone: string;
  logoUrl: string | null;
}

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "(GMT-3) Brasília" },
  { value: "America/New_York", label: "(GMT-5) Nova York" },
  { value: "Europe/Lisbon", label: "(GMT+0) Lisboa" },
  { value: "Europe/London", label: "(GMT+0) Londres" },
  { value: "America/Mexico_City", label: "(GMT-6) Cidade do México" },
];

export function WorkspaceForm({ initial, canManage }: { initial: WorkspaceValues; canManage: boolean }) {
  const [v, setV] = useState(initial);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const set = (patch: Partial<WorkspaceValues>) => setV((s) => ({ ...s, ...patch }));

  function save() {
    startSaving(async () => {
      const res = await saveWorkspaceAction(v);
      if (res.ok) {
        setSaved(true);
        toast("success", "Configurações salvas.");
        setTimeout(() => setSaved(false), 1800);
        router.refresh();
      } else {
        toast("error", res.error ?? "Não foi possível salvar.");
      }
    });
  }

  async function onLogoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/settings/logo", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no upload.");
      set({ logoUrl: data.url });
      toast("success", "Logo atualizada.");
      router.refresh();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Workspace</CardTitle>
          <CardSubtitle>Informações da sua organização.</CardSubtitle>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              {v.logoUrl ? (
                <Image
                  src={v.logoUrl}
                  alt="Logo do workspace"
                  width={64}
                  height={64}
                  className="size-16 rounded-2xl object-cover"
                />
              ) : (
                <span className="grid size-16 place-items-center rounded-2xl text-2xl font-bold text-white [background:var(--grad-roxo)]">
                  {v.name.charAt(0).toUpperCase() || "W"}
                </span>
              )}
              <div className="flex flex-col gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={onLogoPick}
                  disabled={!canManage}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canManage || uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {v.logoUrl ? "Trocar logo" : "Enviar logo"}
                </Button>
                <span className="text-xs text-fg-mut">PNG, JPG, SVG ou WEBP · máx. 2 MB</span>
              </div>
            </div>
            <Field label="Nome do workspace">
              <Input value={v.name} onChange={(e) => set({ name: e.target.value })} disabled={!canManage} />
            </Field>
            <Field label="URL" hint={`${v.slug || "seu-workspace"}.luumu.com`}>
              <Input value={v.slug} onChange={(e) => set({ slug: e.target.value })} disabled={!canManage} />
            </Field>
            <Field label="Fuso horário">
              <Select value={v.timezone} onChange={(e) => set({ timezone: e.target.value })} disabled={!canManage}>
                {TIMEZONES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Projetos</CardTitle>
            <Badge tone="warn" dot={false}>Em breve</Badge>
          </div>
          <CardSubtitle>Ambientes isolados dentro do workspace.</CardSubtitle>
          <p className="mt-4 rounded-xl border border-line bg-bg-sunken p-4 text-sm text-fg-mut">
            Em breve você poderá separar produção, staging e times diferentes em projetos isolados dentro do
            mesmo workspace.
          </p>
        </Card>
      </div>

      {canManage ? (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setV(initial)} disabled={!dirty || saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
            {saved ? "Salvo" : "Salvar alterações"}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-right text-sm text-fg-mut">
          Apenas administradores podem editar o workspace.
        </p>
      )}
    </>
  );
}
