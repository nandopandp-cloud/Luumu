import { AppShell } from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { requireUser, getCurrentProject } from "@/lib/auth/current";
import { listProjects } from "@/lib/db/projects";
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
    listProjects(session.workspaceId),
    getCurrentProject(),
  ]);
  const ws = wsRows[0];

  return (
    <ToastProvider>
      <AppShell
        user={{ name: session.name, email: session.email }}
        workspace={{ name: ws?.name ?? "Workspace", plan: ws?.plan ?? "growth", logoUrl: ws?.logoUrl ?? null }}
        projects={projectList.map((p) => ({ id: p.id, name: p.name }))}
        activeProjectId={activeProject?.id ?? null}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
