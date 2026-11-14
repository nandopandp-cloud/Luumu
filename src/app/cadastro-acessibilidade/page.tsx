import type { Metadata } from "next";
import { LuumuLogo } from "@/components/ui/LuumuLogo";
import { CadastroForm } from "./CadastroForm";

export const metadata: Metadata = {
  title: "Cadastro de acessibilidade · Luumu",
  robots: { index: false, follow: false },
};

/**
 * Página aberta para o time operacional: envia a planilha-modelo (link do Google Planilhas ou
 * arquivo) e recebe o link do CSV pronto para a plataforma externa (lib/accessibility/cadastro.ts).
 */
export default function CadastroAcessibilidadePage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-bg px-4 py-14 text-fg-soft">
      <LuumuLogo size={30} className="mb-7 text-fg" />
      <CadastroForm />
    </main>
  );
}
