"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, FolderKanban, Loader2, Plus } from "lucide-react";
import { LogoImage } from "@/components/ui/LogoImage";
import { switchProjectAction } from "@/app/(app)/projects/actions";

interface ProjectOpt {
  id: string;
  name: string;
  logoUrl: string | null;
}

function ProjectAvatar({ project, size = 32 }: { project: ProjectOpt | undefined; size?: number }) {
  if (project?.logoUrl) {
    return (
      <LogoImage
        src={project.logoUrl}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-lg text-white [background:var(--grad-roxo)]"
    >
      {project ? (
        <span className="text-xs font-bold">{project.name.charAt(0).toUpperCase()}</span>
      ) : (
        <FolderKanban className="size-4" />
      )}
    </span>
  );
}

export function ProjectSwitcher({
  projects,
  activeProjectId,
  workspaceName,
  onNavigate,
}: {
  projects: ProjectOpt[];
  activeProjectId: string | null;
  workspaceName: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const active = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  function pick(id: string) {
    setOpen(false);
    if (id === active?.id) return;
    start(async () => {
      await switchProjectAction(id);
      router.refresh();
    });
  }

  return (
    <div className="relative mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-bg-sunken px-3 py-2 text-left transition hover:border-line-strong"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {pending ? (
            <span className="grid size-8 shrink-0 place-items-center rounded-lg text-white [background:var(--grad-roxo)]">
              <Loader2 className="size-4 animate-spin" />
            </span>
          ) : (
            <ProjectAvatar project={active} size={32} />
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{active?.name ?? "Projeto"}</div>
            <div className="truncate text-[11px] text-fg-mut">{workspaceName}</div>
          </div>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-fg-mut" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 shadow-[var(--shadow-lg)]">
            <div className="px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-fg-mut">
              Projetos
            </div>
            <div className="max-h-60 overflow-y-auto">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pick(p.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-fg-soft hover:bg-bg-sunken"
                >
                  <ProjectAvatar project={p} size={22} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.id === active?.id && <Check className="size-4 shrink-0 text-accent" />}
                </button>
              ))}
            </div>
            <div className="mt-1 border-t border-line">
              <a
                href="/settings"
                onClick={onNavigate}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-accent hover:bg-surface-brand"
              >
                <Plus className="size-4" /> Gerenciar projetos
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
