import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { LuumuLogo, Mascot } from "@/components/ui/Mascot";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Formulário */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-2">
            <LuumuLogo size={36} />
            <span className="font-display text-2xl font-extrabold tracking-tight">Luumu</span>
          </Link>

          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Bem-vindo de volta
          </h1>
          <p className="mt-1.5 text-sm text-fg-mut">
            Entre para ouvir, entender e melhorar.
          </p>

          <form className="mt-8 flex flex-col gap-4">
            <Field label="E-mail">
              <Input type="email" placeholder="voce@empresa.com" defaultValue="fernando@jovensgenios.com" />
            </Field>
            <Field label="Senha">
              <Input type="password" placeholder="••••••••" defaultValue="luumu-demo" />
            </Field>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-fg-soft">
                <input type="checkbox" defaultChecked className="accent-luumu-roxo" /> Lembrar de mim
              </label>
              <a className="font-semibold text-accent">Esqueci a senha</a>
            </div>
            <Button href="/dashboard" size="lg" className="mt-2 w-full">
              Entrar <ArrowRight className="size-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-fg-mut">
            Não tem conta?{" "}
            <Link href="/signup" className="font-semibold text-accent">
              Comece grátis
            </Link>
          </p>
        </div>
      </div>

      {/* Painel de marca */}
      <div className="relative hidden items-center justify-center overflow-hidden lg:flex [background:var(--luumu-roxo-escuro)]">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,.12) 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="relative z-10 max-w-md px-10 text-center text-white">
          <Mascot name="Feliz" size={200} float className="mx-auto" />
          <h2 className="mt-6 font-display text-4xl font-extrabold leading-tight">
            Ouça. Entenda. <span className="text-grad-verde">Melhore.</span>
          </h2>
          <p className="mt-3 text-white/80">
            A plataforma de Voice of Customer que transforma feedback em crescimento.
          </p>
        </div>
      </div>
    </div>
  );
}
