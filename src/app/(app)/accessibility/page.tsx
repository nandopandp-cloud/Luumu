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

  // sem as migrações 0044/0045 a consulta falha: a área avisa em vez de quebrar, e o erro real
  // vai para o log (antes ele era engolido e "falta a migração" escondia a causa)
  let settings;
  try {
    settings = await getAccessibilitySettings(project.id);
  } catch (err) {
    console.error("[accessibility] falha ao ler a configuração do plugin:", err);
    // o Drizzle embrulha o erro do Postgres ("Failed query: …"); o motivo fica em `cause`
    const e = err as { message?: unknown; cause?: { message?: unknown } };
    return <AccessibilityUnavailable detail={[e?.message, e?.cause?.message].filter((m) => typeof m === "string").join(" ")} />;
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
      verification={{ requireVerified: settings.requireVerified, hasSecret: settings.hasSecret }}
      inviteeCount={settings.invitees}
      updatedAt={settings.updatedAt?.toISOString() ?? null}
    />
  );
}
