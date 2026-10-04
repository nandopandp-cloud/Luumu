import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { AnalyticsUnavailable, EnableAnalytics, WaitingAnalytics } from "@/components/analytics/States";
import { canManageWorkspace, getCurrentProject, getCurrentRole, requireUser } from "@/lib/auth/current";
import { collectingSince, getAnalytics, getAnalyticsSettings, hasAnalyticsData, listViews, type AnalyticsSettings } from "@/lib/db/analytics";
import { listHosts } from "@/lib/db/hosts";
import { parseViewConfig, type ViewConfig } from "@/lib/analytics/core";
import { datasetsFor, defaultSpan, TAB_LAYOUT, type Block } from "@/lib/analytics/derive";
import { normalizeHost } from "@/lib/hosts";
import { periodToRange } from "@/lib/period";

export const dynamic = "force-dynamic";

type SP = { tab?: string; view?: string; period?: string; from?: string; to?: string; host?: string; device?: string; w?: string };

const same = (a: ViewConfig, b: ViewConfig) =>
  a.tab === b.tab &&
  (a.period ?? "30d") === (b.period ?? "30d") &&
  (a.from ?? "") === (b.from ?? "") &&
  (a.to ?? "") === (b.to ?? "") &&
  (a.host ?? "") === (b.host ?? "") &&
  (a.device ?? "") === (b.device ?? "") &&
  (a.widgets ?? []).join(",") === (b.widgets ?? []).join(",");

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [session, project] = await Promise.all([requireUser(), getCurrentProject()]);
  const projectId = project!.id;

  // sem a migração 0020 as tabelas não existem: a área avisa em vez de quebrar
  let settings: AnalyticsSettings;
  try {
    settings = await getAnalyticsSettings(projectId, true);
  } catch {
    return <AnalyticsUnavailable />;
  }

  const [canManage, role, hasData] = await Promise.all([canManageWorkspace(), getCurrentRole(), hasAnalyticsData(projectId)]);
  if (!settings.enabled && !hasData) return <EnableAnalytics canManage={canManage} />;
  if (!hasData) return <WaitingAnalytics canManage={canManage} />;

  const [views, hosts, since] = await Promise.all([listViews(projectId, session.userId), listHosts(projectId), collectingSince(projectId)]);
  const saved = sp.view ? views.find((v) => v.id === sp.view) ?? null : null;

  // a URL manda (é ela que os filtros alteram); a visão salva completa o que faltar
  const config = parseViewConfig({
    tab: sp.tab ?? (sp.w ? "custom" : saved?.config.tab),
    period: sp.period ?? saved?.config.period,
    from: sp.from ?? saved?.config.from,
    to: sp.to ?? saved?.config.to,
    host: normalizeHost(sp.host) || saved?.config.host,
    device: sp.device ?? saved?.config.device,
    widgets: sp.w ? sp.w.split(",") : saved?.config.widgets,
  });

  const blocks: Block[] = config.tab === "custom" ? (config.widgets ?? []).map((id) => ({ id, span: defaultSpan(id) })) : TAB_LAYOUT[config.tab];

  const range = periodToRange(config.period ?? "30d", config.from, config.to);
  const to = range.to ?? new Date();
  const from = range.from ?? new Date(to.getTime() - 365 * 86_400_000);
  const data = blocks.length
    ? await getAnalytics({ projectId, from, to, host: config.host, device: config.device }, settings, datasetsFor(blocks.map((b) => b.id)), {
        pagesLimit: config.tab === "pages" ? 50 : config.tab === "custom" ? 10 : 6,
        eventsLimit: config.tab === "events" ? 40 : config.tab === "custom" ? 10 : 6,
      })
    : {};

  return (
    <AnalyticsShell
      config={config}
      blocks={blocks}
      data={data}
      views={views}
      currentView={saved}
      dirty={!!saved && !same(saved.config, config)}
      hosts={hosts}
      settings={{ northStarEvent: settings.northStarEvent, activationEvent: settings.activationEvent, taskStartEvent: settings.taskStartEvent, taskDoneEvent: settings.taskDoneEvent }}
      canManage={canManage}
      canConfigure={role === "owner" || role === "admin" || role === "editor"}
      enabled={settings.enabled}
      since={since}
    />
  );
}
