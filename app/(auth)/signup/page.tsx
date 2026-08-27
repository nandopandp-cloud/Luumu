import Link from "next/link";
import { Check } from "lucide-react";
import { LuumuLogo } from "@/components/ui/Mascot";
import { AuthForm } from "../AuthForm";
import { BrandPanel } from "../BrandPanel";

const perks = [
  "14 dias grátis, sem cartão",
  "Pesquisas ilimitadas no trial",
  "Cancelamento com 1 clique",
];

export default function SignupPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center bg-bg px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-2">
            <LuumuLogo size={36} />
          </Link>

          <h1 className="font-display text-3xl font-extrabold tracking-tight">Comece grátis</h1>
          <p className="mt-1.5 text-sm text-fg-mut">Transforme feedback em crescimento hoje.</p>

          <AuthForm mode="signup" />

          <ul className="mt-6 flex flex-col gap-2">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-fg-mut">
                <span className="grid size-4 shrink-0 place-items-center rounded-full bg-luumu-verde/20 text-[#2F8F3F]">
                  <Check className="size-2.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-center text-sm text-fg-mut">
            Já tem conta?{" "}
            <Link href="/login" className="font-semibold text-accent">Entrar</Link>
          </p>
        </div>
      </div>

      <BrandPanel mascotName="Comemorando" />
    </div>
  );
}
