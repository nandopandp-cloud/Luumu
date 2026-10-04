import { HeatmapHeader } from "@/components/heatmaps/HeatmapHeader";
import { HeatmapFilters } from "@/components/heatmaps/HeatmapFilters";
import { HeatmapWorkspace } from "@/components/heatmaps/HeatmapWorkspace";
import { EnableHeatmaps, WaitingForData, HeatmapsUnavailable } from "@/components/heatmaps/HeatmapStates";
import { canManageWorkspace, getCurrentProject } from "@/lib/auth/current";
import { getHeatmapReport, hasAnyPageview, heatmapQuota, isHeatmapsEnabled, listHeatmapPages, snapshotDevices } from "@/lib/db/heatmaps";
import { listHosts } from "@/lib/db/hosts";
import { getPrimaryPublicKey } from "@/lib/db/keys";
import { HEATMAP_DEVICES, type HeatmapDevice, type HeatmapMode } from "@/lib/heatmaps/core";
import { DEFAULT_PERIOD, periodToRange } from "@/lib/period";

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
  // heatmap acumula: por padrão, todas as visitas registradas
  const { from, to } = periodToRange(sp.period ?? DEFAULT_PERIOD, sp.from, sp.to);
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
  const scope = selected ? { projectId: project.id, host: selected.host, path: selected.path, from, to } : null;
  const [report, snapDevices] = scope
    ? await Promise.all([getHeatmapReport({ ...scope, device }), snapshotDevices(project.id, scope.host, scope.path)])
    : [null, [] as HeatmapDevice[]];

  /*
    O mapa é desenhado sobre a cópia de UM dispositivo: celular e desktop têm layouts
    diferentes, e um clique do celular não tem onde cair na página do desktop. Sem filtro, o
    mapa usa o dispositivo mais visitado que tem cópia (os números ao lado seguem somando
    todos); com filtro, o próprio.
  */
  const byVisits = [...(report?.devices ?? [])].sort((a, b) => b.n - a.n).map((d) => d.device);
  const mapDevice: HeatmapDevice | null =
    device ?? byVisits.find((d) => snapDevices.includes(d)) ?? byVisits[0] ?? null;
  const mapReport =
    scope && report && !device && mapDevice && byVisits.length > 1 ? await getHeatmapReport({ ...scope, device: mapDevice }) : report;
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
        // sem o modo na chave: trocar Cliques/Movimento/Scroll não baixa nem remonta a cópia da página
        key={`${selected?.host}|${selected?.path}|${device}`}
        mode={mode}
        page={selected ? { host: selected.host, path: selected.path } : null}
        device={device ?? null}
        mapDevice={mapDevice}
        mapDevices={byVisits}
        report={report}
        mapReport={mapReport}
        compare={sp.compare === "1" && !!from}
      />
    </div>
  );
}
