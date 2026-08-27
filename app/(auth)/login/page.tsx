import Link from "next/link";
import { LuumuLogo } from "@/components/ui/Mascot";
import { AuthForm } from "../AuthForm";
import { BrandPanel } from "../BrandPanel";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Formulário */}
      <div className="flex flex-col justify-center bg-bg px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-2">
            <LuumuLogo size={36} />
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

      <BrandPanel />
    </div>
  );
}
