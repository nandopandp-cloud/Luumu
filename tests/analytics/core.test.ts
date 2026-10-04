import { test } from "node:test";
import assert from "node:assert/strict";
import { whoFrom } from "../../sdk/analytics/identity";
import {
  classifyChannel,
  detectBrowser,
  detectOS,
  eventLabel,
  frequencyOf,
  parseAnalytics,
  parseViewConfig,
  viewHref,
} from "../../lib/analytics/core";
import { acquisitionKpis, channelSeries, channelTable, datasetsFor, hoursGrid, kpis, retentionCurve, TAB_LAYOUT, WIDGET_DATASETS } from "../../lib/analytics/derive";
import { WIDGET_IDS } from "../../lib/analytics/core";

const now = Date.parse("2026-10-03T15:00:00Z");
const base = { key: "pk_x", aid: "anon123456", sid: "sess123456", st: now, pages: [{ id: "pg1", path: "home", t: now, dur: 5000, ev: ["click_x"] }] };

test("envio do SDK: ids, relógio, limites e eventos validados", () => {
  const p = parseAnalytics({ ...base, device: "geladeira", utm: { source: "Google", medium: "CPC", campaign: "Brand Q3" }, ref: "WWW.Google.com" }, now)!;
  assert.equal(p.device, "desktop");
  assert.deepEqual(p.utm, { source: "google", medium: "cpc", campaign: "Brand Q3" });
  assert.equal(p.ref, "www.google.com");
  assert.equal(parseAnalytics({ ...base, aid: "x" }, now), null); // aid curto demais
  assert.equal(parseAnalytics({ ...base, pages: [] }, now), null);
  const bad = parseAnalytics({ ...base, st: 0, pages: [{ id: "<x>", path: "a", t: now - 3 * 86_400_000, dur: 1e12, ev: ["ok_event", "Não Vale", 3] }] }, now)!;
  assert.equal(bad.st, now); // relógio absurdo → agora
  assert.equal(bad.pages[0].t, now);
  assert.equal(bad.pages[0].dur, 4 * 60 * 60 * 1000);
  assert.deepEqual(bad.pages[0].ev, ["ok_event"]);
  assert.match(bad.pages[0].id, /^[a-z0-9]+$/);
  const who = parseAnalytics({ ...base, uid: "u-1", email: " Ana@Escola.COM ", name: "Ana <b>Souza</b>" }, now)!;
  assert.equal(who.email, "ana@escola.com");
  assert.equal(who.name, "Ana bSouza/b"); // sem < e >: nada de marcação
  assert.equal(parseAnalytics({ ...base, email: "não é e-mail" }, now)!.email, null);
  assert.equal(who.avatar, null);
  const pic = "https://cdn.escola.com/fotos/ana.png?s=96";
  assert.equal(parseAnalytics({ ...base, avatar: pic }, now)!.avatar, pic);
  for (const bad of ["http://cdn.escola.com/a.png", "data:image/png;base64,AAAA", "javascript:alert(1)", "https://x.com/a b.png", `https://x.com/${"a".repeat(600)}`, 42])
    assert.equal(parseAnalytics({ ...base, avatar: bad }, now)!.avatar, null, String(bad).slice(0, 40));
  const cont = parseAnalytics({ ...base, pages: [{ id: "pg1", c: true, path: "home", t: now, dur: 1000, ev: [] }] }, now)!;
  assert.equal(cont.pages[0].c, true);
});

test("canal: UTM primeiro, depois a referência; o próprio site é direto", () => {
  const ch = (ref: string, s = "", m = "") => classifyChannel({ ref, host: "app.cliente.com", utmSource: s, utmMedium: m });
  assert.equal(ch("", "google", "cpc"), "ads");
  assert.equal(ch("", "newsletter", "email"), "email");
  assert.equal(ch("", "instagram", "social"), "social");
  assert.equal(ch("", "parceiro", "banner"), "ads");
  assert.equal(ch("", "parceiro", "algo"), "other");
  assert.equal(ch("www.google.com.br"), "organic");
  assert.equal(ch("l.instagram.com"), "social");
  assert.equal(ch("wa.me"), "social");
  assert.equal(ch("blog.parceiro.com"), "referral");
  assert.equal(ch(""), "direct");
  assert.equal(ch("app.cliente.com"), "direct");
  assert.equal(ch("sso.app.cliente.com"), "direct"); // subdomínio do próprio produto
  assert.equal(ch("x.com"), "social");
});

test("sistema e navegador pelo User-Agent", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const edge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0";
  assert.equal(detectOS(iphone), "iOS");
  assert.equal(detectBrowser(iphone), "Safari");
  assert.equal(detectOS(edge), "Windows");
  assert.equal(detectBrowser(edge), "Edge");
  assert.equal(detectBrowser("Mozilla/5.0 (Linux; Android 14) Chrome/126.0 Mobile Safari/537.36"), "Chrome");
});

test("frequência de uso e rótulos de evento", () => {
  assert.equal(frequencyOf(20, 30), "daily");
  assert.equal(frequencyOf(5, 30), "weekly");
  assert.equal(frequencyOf(2, 30), "monthly");
  assert.equal(frequencyOf(1, 30), "sporadic");
  assert.equal(eventLabel("click_salvar_alteracoes"), "Clique: salvar alteracoes");
  assert.equal(eventLabel("luumu_survey_response"), "Respondeu uma pesquisa");
});

test("visão salva: config limpa e link de volta", () => {
  const c = parseViewConfig({ tab: "custom", period: "90d", host: "App.X.com", device: "mobile", widgets: ["kpi_dau", "hack", "users_trend"] });
  assert.equal(c.host, undefined); // host precisa vir normalizado
  assert.deepEqual(c.widgets, ["kpi_dau", "users_trend"]);
  assert.equal(parseViewConfig({ tab: "x" }).tab, "overview");
  assert.equal(parseViewConfig({ tab: "pages", widgets: ["kpi_dau"] }).widgets, undefined);
  assert.equal(viewHref({ tab: "custom", period: "7d", widgets: ["kpi_dau", "hours"] }, "avw_1"), "/analytics?view=avw_1&tab=custom&period=7d&w=kpi_dau%2Chours");
  assert.equal(viewHref({ tab: "overview" }), "/analytics");
});

test("visão personalizada: ordem e tamanho dos blocos vão e voltam pela URL", () => {
  const c = parseViewConfig({ tab: "custom", period: "today", widgets: ["users_trend:8", "kpi_dau:3", "kpi_dau:6", "hours:99", "hack:4", "top_pages"] });
  assert.equal(c.period, "today");
  assert.deepEqual(c.widgets, ["users_trend", "kpi_dau", "hours", "top_pages"]); // sem repetidos nem desconhecidos
  assert.deepEqual(c.spans, { users_trend: 8, kpi_dau: 6, hours: 12 }); // 99 → 12; o último tamanho vale
  const href = viewHref(c, "avw_9");
  assert.equal(decodeURIComponent(href), "/analytics?view=avw_9&tab=custom&period=today&w=users_trend:8,kpi_dau:6,hours:12,top_pages");
  // visão salva no banco (spans como objeto) e visão antiga sem spans
  assert.deepEqual(parseViewConfig({ tab: "custom", widgets: ["kpi_dau", "hours"], spans: { hours: 6, kpi_mau: 4, kpi_dau: 1 } }).spans, { hours: 6, kpi_dau: 2 });
  assert.equal(parseViewConfig({ tab: "custom", widgets: ["kpi_dau"] }).spans, undefined);
  assert.equal(parseViewConfig({ tab: "overview", widgets: ["kpi_dau:4"] }).spans, undefined);
});

test("todo bloco das abas existe no catálogo e sabe de quais dados precisa", () => {
  for (const blocks of Object.values(TAB_LAYOUT)) for (const b of blocks) assert.ok(WIDGET_IDS.includes(b.id), b.id);
  for (const w of WIDGET_IDS) assert.ok(WIDGET_DATASETS[w]?.length, w);
  assert.deepEqual([...datasetsFor(["kpi_dau", "users_trend"])].sort(), ["daily", "mau"]);
});

test("KPIs: médias, variações e métricas não configuradas", () => {
  const d = {
    daily: { cur: [{ d: "2026-10-01", users: 10, sessions: 20, ms: 60000, pv: 40 }, { d: "2026-10-02", users: 20, sessions: 30, ms: 120000, pv: 60 }], prev: [{ d: "2026-09-01", users: 10, sessions: 10, ms: 60000, pv: 10 }] },
    totals: { users: 25, users_prev: 10, sessions: 50, sessions_prev: 10, ms: 90000, ms_prev: 60000, pv: 100, pv_prev: 10, identified: 5, mau: 100, mau_prev: 50 },
    configured: { active: 25, active_prev: 10, any_event: 20, surveyed: 3 },
  };
  const k = kpis(d as never);
  assert.equal(k.dau.value, 15);
  assert.deepEqual(k.dau.delta, { value: 50, unit: "%" });
  assert.equal(k.stickiness.value, 0.15);
  assert.deepEqual(k.stickiness.delta, { value: -5, unit: "p.p." }); // 15/100 vs 10/50
  assert.equal(k.northStar, null); // sem evento configurado: o card pede configuração
  assert.equal(k.taskSuccess, null);
  assert.equal(k.sessionsPerUser.value, 2);
});

test("aquisição: ativação e canais somando os novos", () => {
  const d = {
    newUsers: { byDay: [{ d: "2026-10-01", channel: "organic", users: 3 }, { d: "2026-10-02", channel: "ads", users: 1 }], cur: 4, prev: 2 },
    outcomes: [
      { channel: "organic", landing: "home", campaign: "", users: 3, activated: 2, surveyed: 1 },
      { channel: "ads", landing: "home", campaign: "Q3", users: 1, activated: 1, surveyed: 0 },
    ],
    outcomesPrev: [{ channel: "organic", landing: "home", campaign: "", users: 2, activated: 1, surveyed: 0 }],
    channels: [{ channel: "organic", users: 10, sessions: 12, ms: 1000 }],
  };
  const a = acquisitionKpis(d as never);
  assert.equal(a.newUsers.value, 4);
  assert.equal(a.activation.value, 0.75);
  assert.deepEqual(a.activation.delta, { value: 25, unit: "p.p." });
  const series = channelSeries(d as never);
  assert.equal(series[0].ads, 0); // dia sem "ads" vira 0 (sem buraco no gráfico empilhado)
  const t = channelTable(d as never);
  assert.equal(t[0].channel, "organic");
  assert.equal(t[0].active, 10);
});

test("retenção e horários", () => {
  const curve = retentionCurve({ retention: { cohorts: [{ cohort: "2026-08-03", size: 10, weeks: [10, 5, 2] }, { cohort: "2026-08-10", size: 30, weeks: [30, 9] }], d1: null, d7: null, d30: null } } as never, 3);
  assert.equal(curve[0].pct, 1);
  assert.equal(curve[1].pct, 14 / 40);
  const h = hoursGrid({ hours: [{ dow: 1, h: 9, users: 4 }, { dow: 7, h: 23, users: 8 }] } as never);
  assert.equal(h.norm[0][9], 0.5);
  assert.equal(h.norm[6][23], 1);
});

test("identify: nome e foto pelos nomes de campo mais comuns", () => {
  assert.deepEqual(whoFrom({ id: "u1", email: "a@b.com", name: " Ana Souza ", avatar: "https://cdn.x.com/a.png" }), { id: "u1", email: "a@b.com", name: "Ana Souza", avatar: "https://cdn.x.com/a.png" });
  assert.equal(whoFrom({ firstName: "Ana", lastName: "Souza" }).name, "Ana Souza");
  assert.equal(whoFrom({ first_name: "Ana" }).name, "Ana");
  assert.equal(whoFrom({ nome: "Ana", first_name: "Outra" }).name, "Ana"); // nome completo vence as partes
  assert.equal(whoFrom({ displayName: "ana.s" }).name, "ana.s");
  assert.equal(whoFrom({ picture: "https://lh3.googleusercontent.com/a/x" }).avatar, "https://lh3.googleusercontent.com/a/x");
  assert.equal(whoFrom({ photoURL: "https://x.com/p.jpg" }).avatar, "https://x.com/p.jpg");
  assert.equal(whoFrom({ avatar: "http://x.com/p.jpg" }).avatar, null);
  assert.deepEqual(whoFrom({}), { id: null, email: null, name: null, avatar: null });
});
