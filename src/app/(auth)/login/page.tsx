import Link from "next/link";
import { LuumuLogo } from "@/components/ui/Mascot";
import { AuthForm } from "../AuthForm";
import { BrandPanel } from "../BrandPanel";
import { GoogleButton } from "../GoogleButton";
import { googleSsoEnabled } from "@/lib/auth/google-sso";
import { GOOGLE_ERROR_MESSAGE, isGoogleLoginError, SSO_DOMAIN } from "@/lib/auth/google";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const google = googleSsoEnabled();
  // erro devolvido pelo login com Google (/api/auth/google/callback)
  const googleError = isGoogleLoginError(error) ? GOOGLE_ERROR_MESSAGE[error] : undefined;
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

          {google && <GoogleButton next={next} />}
          <AuthForm next={next} initialError={googleError} compact={google} />

          <p className="mt-6 text-center text-sm text-fg-mut">
            {google
              ? `Quem tem e-mail @${SSO_DOMAIN} entra com o Google. Os demais acessos são por convite.`
              : "O acesso é feito por convite. Peça a quem administra o seu workspace."}
          </p>
        </div>
      </div>

      <BrandPanel />
    </div>
  );
}
