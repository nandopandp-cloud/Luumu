"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createTourAction } from "@/app/(app)/tours/actions";

/** Botão + diálogo de criação: nome, objetivo e onde o produto está. */
export function NewTourButton({ hosts, label = "Novo tour", icon }: { hosts: string[]; label?: string; icon?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [host, setHost] = useState(hosts[0] ?? "");
  const [path, setPath] = useState("/");
  const [custom, setCustom] = useState(hosts.length === 0);
  const [url, setUrl] = useState("");
  const [saving, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const startUrl = custom ? url.trim() : host ? `https://${host}${path.startsWith("/") ? path : `/${path}`}` : "";

  function submit() {
    start(async () => {
      const res = await createTourAction({ name, description, startUrl });
      if (!res.ok) return toast("error", res.error);
      setOpen(false);
      router.push(`/tours/${res.id}`);
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {icon ?? <Plus className="size-4" />} {label}
      </Button>
      {open && (
        <Dialog
          title="Novo tour guiado"
          description="Comece pelo básico. Os passos você monta em seguida, direto no seu produto."
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={submit} disabled={!name.trim() || saving}>
                {saving && <Loader2 className="size-4 animate-spin" />} Criar e montar passos
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Nome do tour">
              <Input
                autoFocus
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim() && submit()}
                placeholder="Ex.: Primeiros passos"
              />
            </Field>
            <Field label="Objetivo (opcional)" hint="Só para o seu time: o que o usuário deve aprender com este tour.">
              <Input
                value={description}
                maxLength={300}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ensinar novos usuários a criar o primeiro projeto"
              />
            </Field>
            <Field label="Onde o tour começa" hint="É a página que abre quando você for selecionar elementos.">
              {custom ? (
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://app.seuproduto.com/dashboard" />
              ) : (
                <div className="flex gap-2">
                  <Select value={host} onChange={(e) => setHost(e.target.value)} className="min-w-0 flex-1">
                    {hosts.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                  <Input value={path} onChange={(e) => setPath(e.target.value)} className="w-36" placeholder="/dashboard" />
                </div>
              )}
              {hosts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCustom((v) => !v)}
                  className="mt-1.5 text-xs font-semibold text-accent hover:underline"
                >
                  {custom ? "Escolher uma plataforma detectada" : "Digitar outro endereço"}
                </button>
              )}
            </Field>
          </div>
        </Dialog>
      )}
    </>
  );
}
