import type { Metadata } from "next";
import { A11yDemo } from "./A11yDemo";
import { getSession } from "@/lib/auth/session";
import { getCurrentProject } from "@/lib/auth/current";
import { getAccessibilitySettings } from "@/lib/db/accessibility";
import { DEFAULT_A11Y_CONFIG, publicA11yConfig, type PublicA11yConfig } from "@/lib/accessibility/config";
import { SDK_BUNDLE_VERSION } from "@/lib/tours/sdk-version";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demo · Plugin de acessibilidade · Luumu", robots: { index: false } };

/**
 * Plataforma escolar FICTÍCIA rodando o sdk-a11y.js real.
 *  - ?embed=1: dentro da prévia do painel (/accessibility), que manda a configuração em
 *    edição por postMessage.
 *  - sem embed: tela cheia. Com sessão do painel, usa a configuração SALVA do projeto ativo
 *    (ligado ou não); sem sessão, a configuração padrão. Nunca a lista individual.
 */
export default async function AccessibilityDemoPage({ searchParams }: { searchParams: Promise<{ embed?: string }> }) {
  const { embed } = await searchParams;
  let config: PublicA11yConfig = publicA11yConfig(DEFAULT_A11Y_CONFIG);
  let projectName: string | null = null;
  if (await getSession()) {
    try {
      const project = await getCurrentProject();
      if (project) {
        config = publicA11yConfig((await getAccessibilitySettings(project.id)).config);
        projectName = project.name;
      }
    } catch {
      // sem a migração 0044: segue com a configuração padrão
    }
  }
  return <A11yDemo config={config} embed={embed === "1"} projectName={projectName} version={SDK_BUNDLE_VERSION} />;
}
