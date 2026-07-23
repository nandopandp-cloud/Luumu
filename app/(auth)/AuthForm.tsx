"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { Field, Input } from "@/components/ui/Input";
import { loginAction, signupAction, type AuthResult } from "./actions";

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

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? loginAction : signupAction;
  const [state, formAction] = useActionState<AuthResult, FormData>(action, {});

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      {mode === "signup" && (
        <Field label="Nome">
          <Input name="name" placeholder="Seu nome" required />
        </Field>
      )}
      <Field label="E-mail de trabalho">
        <Input name="email" type="email" placeholder="voce@empresa.com" required />
      </Field>
      <Field label="Senha">
        <Input name="password" type="password" placeholder={mode === "signup" ? "Crie uma senha" : "••••••••"} required />
      </Field>

      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-erro/30 bg-erro/10 px-3 py-2 text-sm font-medium text-erro">
          <AlertTriangle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <SubmitButton label={mode === "login" ? "Entrar" : "Criar conta"} />
    </form>
  );
}
