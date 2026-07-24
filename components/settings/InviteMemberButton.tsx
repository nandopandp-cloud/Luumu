"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useToast } from "@/components/ui/Toast";
import { inviteMemberAction } from "@/app/(app)/settings/actions";

function randomPassword() {
  // senha temporária legível (o admin repassa ao novo membro)
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function InviteMemberButton({ canManage }: { canManage: boolean }) {
  const [open, setOpen] = useState(false);

  if (!canManage) {
    return (
      <Button size="sm" disabled>
        <UserPlus className="size-4" /> Convidar membro
      </Button>
    );
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Convidar membro
      </Button>
      {open && <InviteDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(randomPassword());
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [saving, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const valid = name.trim().length >= 2 && /.+@.+\..+/.test(email) && password.length >= 6;

  function submit() {
    start(async () => {
      const res = await inviteMemberAction({ name, email, password, role });
      if (res.ok) {
        toast("success", "Membro adicionado.");
        onClose();
        router.refresh();
      } else {
        toast("error", res.error ?? "Não foi possível adicionar o membro.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-bg-elev p-6 shadow-[var(--shadow-lg)]">
        <h3 className="font-display text-lg font-bold">Convidar membro</h3>
        <p className="mt-1 text-sm text-fg-mut">
          Crie o acesso com uma senha temporária e repasse ao novo membro. Ele poderá trocá-la depois.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <Field label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do membro" autoFocus />
          </Field>
          <Field label="E-mail">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="membro@empresa.com" />
          </Field>
          <Field label="Senha temporária">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(password);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1400);
                }}
              >
                {copied ? <Check className="size-4 text-sucesso" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </Field>
          <Field label="Papel">
            <Select value={role} onChange={(e) => setRole(e.target.value as "admin" | "editor" | "viewer")}>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </Select>
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={!valid || saving} onClick={submit}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} Adicionar membro
          </Button>
        </div>
      </div>
    </div>
  );
}
