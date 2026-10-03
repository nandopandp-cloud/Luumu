import { HeatmapHeader } from "@/components/heatmaps/HeatmapHeader";
import { HeatmapFilters } from "@/components/heatmaps/HeatmapFilters";
import { HeatmapWorkspace } from "@/components/heatmaps/HeatmapWorkspace";
import { EnableHeatmaps, WaitingForData, HeatmapsUnavailable } from "@/components/heatmaps/HeatmapStates";
import { canManageWorkspace, getCurrentProject } from "@/lib/auth/current";
import { getHeatmapReport, hasAnyPageview, heatmapQuota, isHeatmapsEnabled, listHeatmapPages } from "@/lib/db/heatmaps";
import { listHosts } from "@/lib/db/hosts";
import { getPrimaryPublicKey } from "@/lib/db/keys";
import { HEATMAP_DEVICES, type HeatmapDevice, type HeatmapMode } from "@/lib/heatmaps/core";
import { periodToRange } from "@/lib/period";

export const dynamic = "force-dynamic";

const MODES: HeatmapMode[] = ["clicks", "moves", "scroll"];

export default async function HeatmapsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; page?: string; device?: string; period?: string; from?: string; to?: string; compare?: string }>;
}) {
  const sp = await searchParams;
  const mode: HeatmapMode = MODES.includes(sp.mode as HeatmapMode) ? (sp.mode as HeatmapMode) : "clicks";
  const device = HEATMAP_DEVICES.includes(sp.device as HeatmapDevice) ? (sp.device as HeatmapDevice) : undefined;
  const project = (await getCurrentProject())!;

  // sem a migração 0019 as tabelas não existem: a área avisa em vez de quebrar
  let enabled: boolean;
  try {
    enabled = await isHeatmapsEnabled(project.id);
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <HeatmapHeader mode={mode} />
        <HeatmapsUnavailable />
      </div>
    );
  }

  const canManage = await canManageWorkspace();
  const { from, to } = periodToRange(sp.period, sp.from, sp.to);
  const [pages, anyData, hosts, quota] = await Promise.all([
    listHeatmapPages(project.id, from, to),
    hasAnyPageview(project.id),
    listHosts(project.id),
    heatmapQuota(project.workspaceId),
  ]);

  if (!enabled && !anyData) {
    return (
      <div className="flex flex-col gap-6">
        <HeatmapHeader mode={mode} />
        <EnableHeatmaps canManage={canManage} allowed={quota.allowed} />
      </div>
    );
  }
  if (!anyData) {
    const key = await getPrimaryPublicKey(project.id).catch(() => null);
    return (
      <div className="flex flex-col gap-6">
        <HeatmapHeader mode={mode} />
        <WaitingForData canManage={canManage} hosts={hosts} sdkKey={key} />
      </div>
    );
  }

  const selected = pages.find((p) => `${p.host}|${p.path}` === sp.page) ?? pages[0] ?? null;
  const report = selected ? await getHeatmapReport({ projectId: project.id, host: selected.host, path: selected.path, device, from, to }) : null;
  const multiHost = new Set(pages.map((p) => p.host)).size > 1;

  return (
    <div className="flex flex-col gap-6">
      <HeatmapHeader mode={mode} />
      <HeatmapFilters
        pages={pages.map((p) => ({ value: `${p.host}|${p.path}`, host: p.host, path: p.path, visits: p.n }))}
        selected={selected ? `${selected.host}|${selected.path}` : ""}
        multiHost={multiHost}
        device={device ?? ""}
        mode={mode}
        compare={sp.compare === "1"}
        canCompare={!!from}
        enabled={enabled}
        canManage={canManage}
        quota={{ used: quota.used, limit: quota.limit === Infinity ? null : quota.limit }}
      />
      <HeatmapWorkspace
        key={`${selected?.host}|${selected?.path}|${device}|${mode}`}
        mode={mode}
        page={selected ? { host: selected.host, path: selected.path } : null}
        device={device ?? null}
        report={report}
        compare={sp.compare === "1" && !!from}
      />
    </div>
  );
}
