import Link from "next/link";
import { LuumuLogo, Mascot } from "@/components/ui/Mascot";
import { AuthForm } from "../AuthForm";

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

          <AuthForm mode="login" />

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
