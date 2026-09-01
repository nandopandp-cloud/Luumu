import { AppShell } from "@/components/shell/AppShell";
import { NoProjectAccess } from "@/components/shell/NoProjectAccess";
import { ToastProvider } from "@/components/ui/Toast";
import { requireUser, getCurrentProject, getVisibleProjects } from "@/lib/auth/current";
import { db } from "@/lib/db/client";
import { workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const [wsRows, projectList, activeProject] = await Promise.all([
    db
      .select({ name: workspaces.name, plan: workspaces.plan, logoUrl: workspaces.logoUrl })
      .from(workspaces)
      .where(eq(workspaces.id, session.workspaceId))
      .limit(1),
    getVisibleProjects(),
    getCurrentProject(),
  ]);
  const ws = wsRows[0];

  return (
    <ToastProvider>
      <AppShell
        user={{ name: session.name, email: session.email }}
        workspace={{ name: ws?.name ?? "Workspace", plan: ws?.plan ?? "growth", logoUrl: ws?.logoUrl ?? null }}
        projects={projectList.map((p) => ({ id: p.id, name: p.name, logoUrl: p.logoUrl }))}
        activeProjectId={activeProject?.id ?? null}
      >
        {/*
          Membro cujo escopo não inclui nenhum projeto: as páginas do app resolvem dados a
          partir do projeto ativo e lançariam sem ele, então trocamos o conteúdo por uma
          explicação. O aviso vive no layout (e não em cada página) porque a condição é a
          mesma para todas.
        */}
        {activeProject ? children : <NoProjectAccess />}
      </AppShell>
    </ToastProvider>
  );
}
