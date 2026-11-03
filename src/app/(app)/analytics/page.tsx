import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { savedPlatform } from "@/lib/platform/selected";
import { AnalyticsUnavailable, EnableAnalytics, WaitingAnalytics } from "@/components/analytics/States";
import { canManageWorkspace, getCurrentProject, getCurrentRole, requireUser } from "@/lib/auth/current";
import { collectingSince, getAnalyticsCached, getAnalyticsSettings, hasAnalyticsData, listAnalyticsUsers, listViews, resolvePeriod, USER_SEGMENTS, type PeriodScope, USER_SORTS, type AnalyticsSettings, type UserSegment, type UserSort } from "@/lib/db/analytics";
import type { UsersData } from "@/components/analytics/UsersView";
import { listHosts } from "@/lib/db/hosts";
import { parseViewConfig, viewHref, type ViewConfig } from "@/lib/analytics/core";
import { datasetsFor, defaultSpan, TAB_LAYOUT, type Block } from "@/lib/analytics/derive";
import { normalizeHosts } from "@/lib/platform/hosts";
import { DEFAULT_PERIOD } from "@/lib/utils/period";

export const dynamic = "force-dynamic";

type SP = { tab?: string; view?: string; period?: string; from?: string; to?: string; host?: string; device?: string; w?: string; q?: string; seg?: string; sort?: string; dir?: string; pg?: string };

/** Mesma configuração = mesma URL (aba, filtros, blocos, tamanhos e ordem). */
const same = (a: ViewConfig, b: ViewConfig) => viewHref(a) === viewHref(b);

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

  // tudo leve e independente: uma rodada só (o que não for usado nos avisos abaixo é descartado)
  const [canManage, role, hasData, views, hosts, since, platform] = await Promise.all([
    canManageWorkspace(),
    getCurrentRole(),
    hasAnalyticsData(projectId),
    listViews(projectId, session.userId),
    listHosts(projectId),
    collectingSince(projectId),
    savedPlatform(projectId),
  ]);
  if (!settings.enabled && !hasData) return <EnableAnalytics canManage={canManage} />;
  if (!hasData) return <WaitingAnalytics canManage={canManage} />;

  const saved = sp.view ? views.find((v) => v.id === sp.view) ?? null : null;

  // a URL manda (é ela que os filtros alteram); a visão salva completa o que faltar
  const config = parseViewConfig({
    tab: sp.tab ?? (sp.w ? "custom" : saved?.config.tab),
    period: sp.period ?? saved?.config.period,
    from: sp.from ?? saved?.config.from,
    to: sp.to ?? saved?.config.to,
    // URL > visão salva > plataforma escolhida no header
    host: normalizeHosts(sp.host) || saved?.config.host || platform || undefined,
    device: sp.device ?? saved?.config.device,
    widgets: sp.w ? sp.w.split(",") : saved?.config.widgets,
    spans: sp.w ? undefined : saved?.config.spans,
  });

  const blocks: Block[] =
    config.tab === "custom" ? (config.widgets ?? []).map((id) => ({ id, span: config.spans?.[id] ?? defaultSpan(id) })) : config.tab === "users" ? [] : TAB_LAYOUT[config.tab];

  const period: PeriodScope = { projectId, period: config.period ?? DEFAULT_PERIOD, from: config.from, to: config.to, host: config.host, device: config.device };
  const data = blocks.length
    ? await getAnalyticsCached(period, settings, datasetsFor(blocks.map((b) => b.id)), {
        pagesLimit: config.tab === "pages" ? 50 : config.tab === "custom" ? 10 : 6,
        eventsLimit: config.tab === "events" ? 40 : config.tab === "custom" ? 10 : 6,
      })
    : {};

  // aba Usuários: a lista (busca/segmento/ordem/página na URL) + os números do topo
  let users: UsersData | null = null;
  if (config.tab === "users") {
    const scope = resolvePeriod(period);
    let list: Awaited<ReturnType<typeof listAnalyticsUsers>>;
    let kpi: Awaited<ReturnType<typeof getAnalyticsCached>>;
    try {
      [list, kpi] = await Promise.all([
        listAnalyticsUsers(scope, {
          q: sp.q,
          segment: (USER_SEGMENTS as readonly string[]).includes(sp.seg ?? "") ? (sp.seg as UserSegment) : "all",
          sort: (USER_SORTS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as UserSort) : "recent",
          dir: sp.dir === "asc" ? "asc" : "desc",
          page: Math.max(1, Number(sp.pg) || 1),
        }),
        getAnalyticsCached(period, settings, new Set(["totals", "newUsers"])),
      ]);
    } catch (e) {
      // sem a 0022 as colunas de e-mail/nome/avatar não existem: avisa qual migração falta em vez de quebrar
      console.error("[analytics] aba Usuários", e);
      return <AnalyticsUnavailable migration="0022_analytics_users_avatar.sql" />;
    }
    users = {
      ...list,
      kpis: { active: kpi.totals?.users ?? 0, identified: kpi.totals?.identified ?? 0, newUsers: kpi.newUsers?.cur ?? 0, activePrev: kpi.totals?.users_prev || null },
    };
  }

  return (
    <AnalyticsShell
      users={users}
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
