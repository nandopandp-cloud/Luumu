import type { Metadata } from "next";
import { AccessibilityAdmin } from "@/components/accessibility/AccessibilityAdmin";
import { AccessibilityUnavailable } from "@/components/accessibility/AccessibilityStates";
import { canManageWorkspace, getCurrentProject } from "@/lib/auth/current";
import { getAccessibilitySettings } from "@/lib/db/accessibility";
import { getPrimaryPublicKey } from "@/lib/db/keys";
import { listHosts } from "@/lib/db/hosts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Acessibilidade · Luumu" };

export default async function AccessibilityPage() {
  const project = (await getCurrentProject())!;

  // sem a migração 0044 a tabela não existe: a área avisa em vez de quebrar
  let settings;
  try {
    settings = await getAccessibilitySettings(project.id);
  } catch {
    return <AccessibilityUnavailable />;
  }
  const [canManage, sdkKey, hosts] = await Promise.all([
    canManageWorkspace(),
    getPrimaryPublicKey(project.id).catch(() => null),
    // plataformas do projeto: entram no pedido de personalização do VLibras
    listHosts(project.id).catch(() => [] as string[]),
  ]);

  return (
    <AccessibilityAdmin
      projectName={project.name}
      projectLogo={project.logoUrl ?? ""}
      canManage={canManage}
      sdkKey={sdkKey}
      hosts={hosts}
      initial={{ enabled: settings.enabled, config: settings.config }}
      updatedAt={settings.updatedAt?.toISOString() ?? null}
    />
  );
}
