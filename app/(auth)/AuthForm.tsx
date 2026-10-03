"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Loader2, AlertTriangle, Mail } from "lucide-react";
import { Field, Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { loginAction, type AuthResult } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 disabled:opacity-60 [background:var(--grad-roxo)]"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {label} {!pending && <ArrowRight className="size-4" />}
    </button>
  );
}

/** Formulário de login. Contas novas não se cadastram sozinhas: entram por convite de um workspace. */
export function AuthForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<AuthResult, FormData>(loginAction, {});

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      {/* destino pretendido antes do login; a action revalida antes de redirecionar */}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="E-mail de trabalho">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-mut" />
          <Input
            name="email"
            type="email"
            placeholder="voce@empresa.com"
            required
            className="pl-10"
          />
        </div>
      </Field>
      <Field label="Senha">
        <PasswordInput
          name="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </Field>

      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-erro/30 bg-erro/10 px-3 py-2 text-sm font-medium text-erro">
          <AlertTriangle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <SubmitButton label="Entrar" />
    </form>
  );
}
