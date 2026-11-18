import { test } from "node:test";
import assert from "node:assert/strict";
import {
  audienceHash,
  displayStatus,
  draftProblem,
  fromLocalInput,
  normalizeBellSettings,
  parseAudienceList,
  publicNotifications,
  toLocalInput,
  validUrl,
  visibleTo,
  DEFAULT_BELL_SETTINGS,
  type NotificationDraft,
  type NotificationForSdk,
} from "@/lib/notifications/model";

const NOW = Date.parse("2026-11-18T15:00:00Z");
const h = (n: number) => new Date(NOW + n * 3600_000);

const row = (o: Partial<NotificationForSdk>): NotificationForSdk => ({
  id: "ntf_1",
  title: "Simulado",
  body: "Sábado",
  category: "evento",
  ctaLabel: null,
  ctaUrl: null,
  audience: {},
  hosts: [],
  pinned: false,
  status: "publicada",
  publishAt: null,
  publishedAt: h(-1),
  expiresAt: null,
  ...o,
});
const on = { ...DEFAULT_BELL_SETTINGS, enabled: true };

test("status no painel: agendada, no ar e expirada vêm das datas", () => {
  assert.equal(displayStatus({ status: "publicada", publishAt: h(2), expiresAt: null }, NOW), "agendada");
  assert.equal(displayStatus({ status: "publicada", publishAt: h(-2), expiresAt: h(2) }, NOW), "no_ar");
  assert.equal(displayStatus({ status: "publicada", publishAt: null, expiresAt: h(-1) }, NOW), "expirada");
  assert.equal(displayStatus({ status: "teste", publishAt: h(2), expiresAt: null }, NOW), "teste");
  assert.equal(displayStatus({ status: "rascunho", publishAt: null, expiresAt: null }, NOW), "rascunho");
});

test("recorte público: sino desligado ou de outra plataforma não vai para o /config", () => {
  assert.equal(publicNotifications(DEFAULT_BELL_SETTINGS, [row({})], "prj", "geniex.com", NOW), null);
  assert.equal(publicNotifications({ ...on, hosts: ["geniex.com"] }, [row({})], "prj", "outro.com", NOW), null);
  assert.equal(publicNotifications({ ...on, hosts: ["geniex.com"] }, [row({})], "prj", "geniex.com", NOW)!.items.length, 1);
});

test("recorte público: só publicadas no ar ou agendadas para as próximas 24h; fixadas primeiro", () => {
  const out = publicNotifications(
    on,
    [
      row({ id: "a", publishedAt: h(-5) }),
      row({ id: "b", publishedAt: h(-1), pinned: true }),
      row({ id: "c", status: "rascunho" }),
      row({ id: "d", status: "arquivada" }),
      row({ id: "e", expiresAt: h(-1) }),
      row({ id: "f", publishAt: h(30) }),
      row({ id: "g", publishAt: h(3) }),
      row({ id: "h", hosts: ["outra.com"] }),
    ],
    "prj",
    "geniex.com",
    NOW
  )!;
  assert.deepEqual(out.items.map((i) => i.id), ["b", "g", "a"]);
  assert.equal(out.items[0].p, 1);
});

test("lista de público vai em hash, nunca em texto; teste só para os usuários de teste", () => {
  const out = publicNotifications(
    { ...on, testers: ["eu@jovensgenios.com"] },
    [row({ id: "l", audience: { list: ["Ana@Escola.com", "8812"] } }), row({ id: "t", status: "teste" })],
    "prj",
    null,
    NOW
  )!;
  const json = JSON.stringify(out);
  assert.equal(json.includes("ana@escola.com"), false);
  assert.equal(json.includes("8812"), false);
  assert.equal(json.includes("jovensgenios"), false);
  const l = out.items.find((i) => i.id === "l")!;
  assert.ok(visibleTo(l, { email: " ANA@escola.com " }, out.salt, NOW));
  assert.ok(visibleTo(l, { id: 8812 }, out.salt, NOW));
  assert.equal(visibleTo(l, { id: "9999" }, out.salt, NOW), false);
  const t = out.items.find((i) => i.id === "t")!;
  assert.ok(visibleTo(t, { email: "eu@jovensgenios.com" }, out.salt, NOW));
  assert.equal(visibleTo(t, { email: "ana@escola.com" }, out.salt, NOW), false);
  // sem usuários de teste, o recado em teste não sai
  assert.equal(publicNotifications(on, [row({ status: "teste" })], "prj", null, NOW)!.items.length, 0);
});

test("o hash depende do sal (projeto)", () => {
  assert.notEqual(audienceHash("p1", "8812"), audienceHash("p2", "8812"));
  assert.equal(audienceHash("p1", "8812"), audienceHash("p1", "8812"));
});

test("visível: ano escolar e datas", () => {
  const out = publicNotifications(on, [row({ id: "y", audience: { schoolYears: ["EF6"] } }), row({ id: "s", publishAt: h(2) })], "prj", null, NOW)!;
  const y = out.items.find((i) => i.id === "y")!;
  assert.ok(visibleTo(y, { school_year: "6º ano" }, "prj", NOW));
  assert.equal(visibleTo(y, { school_year: "7º ano" }, "prj", NOW), false);
  assert.equal(visibleTo(y, {}, "prj", NOW), false, "sem ano escolar, fora do público");
  const s = out.items.find((i) => i.id === "s")!;
  assert.equal(visibleTo(s, {}, "prj", NOW), false, "agendado ainda não aparece");
  assert.ok(visibleTo(s, {}, "prj", NOW + 3 * 3600_000), "entra na hora marcada");
});

const draft = (o: Partial<NotificationDraft>): NotificationDraft => ({
  title: "Simulado",
  body: "Sábado às 9h",
  category: "evento",
  ctaLabel: "",
  ctaUrl: "",
  audience: { schoolYears: [], list: [] },
  hosts: [],
  pinned: false,
  publishAt: null,
  expiresAt: null,
  ...o,
});

test("validação do recado", () => {
  assert.equal(draftProblem(draft({}), true, NOW), null);
  assert.equal(draftProblem(draft({ body: "" }), false, NOW), null, "rascunho pode ficar sem mensagem");
  assert.match(draftProblem(draft({ body: "" }), true, NOW)!, /mensagem/);
  assert.match(draftProblem(draft({ title: " " }), false, NOW)!, /título/);
  assert.match(draftProblem(draft({ ctaLabel: "Ver" }), true, NOW)!, /link/);
  assert.match(draftProblem(draft({ ctaLabel: "Ver", ctaUrl: "javascript:alert(1)" }), true, NOW)!, /link do botão/);
  assert.match(draftProblem(draft({ publishAt: h(5), expiresAt: h(2) }), true, NOW)!, /depois do início/);
  assert.match(draftProblem(draft({ expiresAt: h(-1) }), true, NOW)!, /já passou/);
});

test("link do botão: caminho do produto ou https", () => {
  for (const ok of ["", "/tarefas", "/simulados?x=1", "https://geniex.com/x"]) assert.ok(validUrl(ok), ok);
  for (const bad of ["//evil.com", "http://x.com", "javascript:alert(1)", "data:text/html,x", "/a b"]) assert.equal(validUrl(bad), false, bad);
});

test("lista colada: separa por linha, vírgula e ponto e vírgula, sem repetir", () => {
  assert.deepEqual(parseAudienceList("8812\nAna@Escola.com, 8812;  9040 \n\n"), ["8812", "ana@escola.com", "9040"]);
});

test("configuração do sino: valores inválidos voltam ao padrão", () => {
  const s = normalizeBellSettings({ enabled: "true", placement: "x", accent: "red", corner: "meio", emptyText: "", testers: ["A@B.com", "a@b.com", "com espaço"] });
  assert.equal(s.enabled, false);
  assert.equal(s.placement, "slot");
  assert.equal(s.accent, DEFAULT_BELL_SETTINGS.accent);
  assert.equal(s.corner, "bottom-right");
  assert.equal(s.emptyText, DEFAULT_BELL_SETTINGS.emptyText);
  assert.deepEqual(s.testers, ["a@b.com"]);
});

test("datas do editor no fuso de Brasília", () => {
  const d = fromLocalInput("2026-11-20T08:00", "America/Sao_Paulo")!;
  assert.equal(d.toISOString(), "2026-11-20T11:00:00.000Z");
  assert.equal(toLocalInput(d, "America/Sao_Paulo"), "2026-11-20T08:00");
  assert.equal(fromLocalInput("", "America/Sao_Paulo"), null);
  assert.equal(fromLocalInput("20/11/2026", "America/Sao_Paulo"), null);
});
