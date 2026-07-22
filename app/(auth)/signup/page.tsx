import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { LuumuLogo, Mascot } from "@/components/ui/Mascot";

const perks = [
  "14 dias grátis, sem cartão",
  "Pesquisas ilimitadas no trial",
  "Cancelamento com 1 clique",
];

export default function SignupPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-2">
            <LuumuLogo size={36} />
            <span className="font-display text-2xl font-extrabold tracking-tight">Luumu</span>
          </Link>

          <h1 className="font-display text-3xl font-extrabold tracking-tight">Comece grátis</h1>
          <p className="mt-1.5 text-sm text-fg-mut">Transforme feedback em crescimento hoje.</p>

          <form className="mt-8 flex flex-col gap-4">
            <Field label="Nome">
              <Input placeholder="Seu nome" />
            </Field>
            <Field label="E-mail de trabalho">
              <Input type="email" placeholder="voce@empresa.com" />
            </Field>
            <Field label="Senha">
              <Input type="password" placeholder="Crie uma senha" />
            </Field>
            <Button href="/dashboard" size="lg" className="mt-2 w-full">
              Criar conta <ArrowRight className="size-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-fg-mut">
            Já tem conta?{" "}
            <Link href="/login" className="font-semibold text-accent">Entrar</Link>
          </p>
        </div>
      </div>

      <div className="relative hidden flex-col items-center justify-center overflow-hidden lg:flex [background:var(--luumu-roxo-escuro)]">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,.12) 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="relative z-10 max-w-md px-10 text-center text-white">
          <Mascot name="Comemorando" size={190} float className="mx-auto" />
          <h2 className="mt-6 font-display text-3xl font-extrabold leading-tight">
            Mais de 2.500 empresas já ouvem com a Luumu
          </h2>
          <ul className="mt-6 flex flex-col items-start gap-2.5 text-left">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-2 text-white/90">
                <span className="grid size-5 place-items-center rounded-full bg-luumu-verde text-[#0A2E12]">
                  <Check className="size-3" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
