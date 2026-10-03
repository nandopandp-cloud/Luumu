import Link from "next/link";
import { LuumuLogo } from "@/components/ui/Mascot";
import { AuthForm } from "../AuthForm";
import { BrandPanel } from "../BrandPanel";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
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

          <AuthForm next={next} />

          <p className="mt-6 text-center text-sm text-fg-mut">
            O acesso é feito por convite. Peça a quem administra o seu workspace.
          </p>
        </div>
      </div>

      <BrandPanel />
    </div>
  );
}
