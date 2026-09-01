"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useToast } from "@/components/ui/Toast";
import { changePasswordAction } from "@/app/(app)/settings/profile/actions";

const MIN = 6;

/** Troca da própria senha: exige a senha atual e a confirmação da nova. */
export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, start] = useTransition();
  const toast = useToast();

  // só sinaliza a divergência depois que a confirmação começou a ser digitada,
  // senão o erro aparece já no primeiro caractere
  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < MIN;
  const valid = current.length > 0 && next.length >= MIN && next === confirm;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    start(async () => {
      const res = await changePasswordAction({
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
      });
      if (res.ok) {
        toast("success", "Senha alterada.");
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        toast("error", res.error ?? "Não foi possível alterar a senha.");
      }
    });
  }

  return (
    <Card as="form" onSubmit={submit}>
      <CardTitle>Senha</CardTitle>
      <CardSubtitle>Use ao menos {MIN} caracteres.</CardSubtitle>

      <div className="mt-4 flex flex-col gap-4">
        <Field label="Senha atual">
          <PasswordInput
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            placeholder="Sua senha de hoje"
          />
        </Field>
        <Field label="Nova senha">
          <PasswordInput
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            placeholder="Nova senha"
            aria-invalid={tooShort || undefined}
          />
          {tooShort && <p className="text-xs font-medium text-erro">Mínimo de {MIN} caracteres.</p>}
        </Field>
        <Field label="Confirmar nova senha">
          <PasswordInput
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Repita a nova senha"
            aria-invalid={mismatch || undefined}
          />
          {mismatch && <p className="text-xs font-medium text-erro">As senhas não coincidem.</p>}
        </Field>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="submit" size="sm" disabled={!valid || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Alterar senha
        </Button>
      </div>
    </Card>
  );
}
