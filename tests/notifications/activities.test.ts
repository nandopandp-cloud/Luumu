/*
  Avisos automáticos de atividades: regras puras (lib/notifications/activities.ts), leitura do
  webhook (lib/notifications/webhook.ts) e assinatura (lib/notifications/signature.ts).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activityItems,
  classIdsOf,
  dueTitle,
  isCompletionPath,
  itemText,
  normalizeAuto,
  parseItemId,
  staleOnFirstSync,
  toFeed,
  type FeedActivity,
} from "@/lib/notifications/activities";
import { DEFAULT_BELL_SETTINGS, publicNotifications } from "@/lib/notifications/model";
import { eventsOf, parseEvent } from "@/lib/notifications/webhook";
import { signWebhookBody, verifyWebhookSignature } from "@/lib/notifications/signature";

const NOW = Date.parse("2026-11-26T15:00:00Z");
const H = 3600_000;
const act = (o: Partial<FeedActivity> = {}): FeedActivity => ({ id: "t123", k: "tarefa", t: "Frações", u: "/instituicao/assignments/t123", a: NOW - 2 * H, d: NOW + 3 * 24 * H, ...o });
const AUTO = { n: 1 as const, d: 24 };

test("turmas do identify: class_ids ou classIds, texto ou lista, sem repetidas e com limite", () => {
  assert.deepEqual(classIdsOf({ class_ids: ["6A", " 6A ", 7, "", null] }), ["6A", "7"]);
  assert.deepEqual(classIdsOf({ classIds: "9B" }), ["9B"]);
  assert.deepEqual(classIdsOf({}), []);
  assert.equal(classIdsOf({ class_ids: Array.from({ length: 30 }, (_, i) => `t${i}`) }).length, 10);
});

test("nova: vale 7 dias depois da liberação; liberação agendada e prazo vencido não aparecem", () => {
  const ids = (list: FeedActivity[]) => activityItems(list, AUTO, new Set(), NOW).map((i) => i.id);
  assert.deepEqual(ids([act()]), ["n:t123"]);
  assert.deepEqual(ids([act({ a: NOW - 8 * 24 * H, d: undefined })]), [], "liberada há mais de 7 dias");
  assert.deepEqual(ids([act({ a: NOW + H })]), [], "liberação no futuro");
  assert.deepEqual(ids([act({ d: NOW - H })]), [], "prazo já passou");
  assert.deepEqual(ids([act(), act()]), ["n:t123"], "a mesma atividade em duas turmas conta uma vez");
});

test("prazo: aparece na antecedência configurada, com id que muda quando o prazo muda", () => {
  const due = NOW + 10 * H;
  const items = activityItems([act({ d: due })], AUTO, new Set(), NOW);
  assert.deepEqual(items.map((i) => i.id), [`d:t123:${due}`, "n:t123"], "no empate, o prazo primeiro");
  assert.equal(items[0].at, NOW - 2 * H, "a janela do prazo abriu antes da liberação: vale a liberação");
  assert.equal(activityItems([act({ d: due })], { n: 0, d: 0 }, new Set(), NOW).length, 0, "tudo desligado");
  assert.equal(activityItems([act({ d: NOW + 30 * H })], { n: 0, d: 24 }, new Set(), NOW).length, 0, "ainda fora da janela");
});

test("concluída não gera aviso nenhum", () => {
  assert.equal(activityItems([act({ d: NOW + 5 * H })], AUTO, new Set(["t123"]), NOW).length, 0);
});

test("primeira sincronização: o que foi liberado há mais de 48h entra como lido", () => {
  const items = activityItems([act({ id: "old", a: NOW - 3 * 24 * H }), act({ id: "new", a: NOW - H })], AUTO, new Set(), NOW);
  assert.deepEqual(staleOnFirstSync(items, NOW), ["n:old"]);
});

test("id do aviso volta para atividade e tipo; id de recado não é aviso", () => {
  assert.deepEqual(parseItemId("n:t123"), { activityId: "t123", item: "nova" });
  assert.deepEqual(parseItemId("d:a:b:1764100000000"), { activityId: "a:b", item: "prazo" });
  assert.equal(parseItemId("ntf_abc"), null);
});

test("textos: nova tarefa, nova Prova Genial e lembrete de prazo", () => {
  const due = new Date(2026, 10, 27, 23, 59).getTime();
  const now = new Date(2026, 10, 27, 8, 0).getTime();
  const [prazo, nova] = activityItems([act({ s: "Matemática", d: due, a: now - 30 * H })], AUTO, new Set(), now);
  assert.deepEqual(itemText(nova, AUTO, now), { title: "Nova tarefa", body: "Matemática · Frações. Entrega até hoje às 23:59." });
  assert.deepEqual(itemText(prazo, AUTO, now), { title: "Falta 1 dia", body: "Tarefa: Matemática · Frações. Entrega até hoje às 23:59." });
  assert.equal(itemText(nova, AUTO, now - 24 * H).body, "Matemática · Frações. Entrega até amanhã às 23:59.");
  const [p] = activityItems([act({ k: "prova_genial", d: undefined, a: now - H })], AUTO, new Set(), now);
  assert.equal(itemText(p, AUTO, now).title, "Nova Prova Genial");
  assert.equal(dueTitle(12), "Faltam 12 horas");
  assert.equal(dueTitle(48), "Faltam 2 dias");
});

test("conclusão: a tela de resultado DESTA atividade, nas rotas que a jornada reconhece", () => {
  const t = act();
  assert.equal(isCompletionPath("/instituicao/assignments/t123/complete", t), true);
  assert.equal(isCompletionPath("/instituicao/assignments/t123/complete/", t), true);
  assert.equal(isCompletionPath("/instituicao/assignments/t999/complete", t), false, "outra tarefa");
  assert.equal(isCompletionPath("/instituicao/assignments/t123", t), false, "só abriu");
  assert.equal(isCompletionPath("/instituicao/assignments/t123/topic/9/quiz", t), false, "iniciou");
  const p = act({ id: "p45", k: "prova_genial", u: "https://preparasp.jovensgenios.com/instituicao/avaliacoes/p45?from=sino" });
  assert.equal(isCompletionPath("/instituicao/avaliacoes/p45/results", p), true);
  assert.equal(isCompletionPath("/instituicao/avaliacoes/p45/quiz", p), false);
});

test("configuração: padrão desligado; /config só leva os avisos quando ligados", () => {
  assert.deepEqual(normalizeAuto({}), { enabled: false, novas: true, dueHours: 24 });
  assert.deepEqual(normalizeAuto({ enabled: true, novas: false, dueHours: 7 }), { enabled: true, novas: false, dueHours: 24 });
  const base = { ...DEFAULT_BELL_SETTINGS, enabled: true };
  assert.equal(publicNotifications(base, [], "p", null)!.auto, undefined);
  assert.deepEqual(publicNotifications({ ...base, auto: { enabled: true, novas: true, dueHours: 12 } }, [], "p", null)!.auto, { n: 1, d: 12 });
});

test("feed: chaves curtas, sem campos vazios e só tipos conhecidos", () => {
  const rows = [
    { externalId: "t1", type: "tarefa", title: "A", subject: null, url: "/x", assignedAt: new Date(NOW), dueAt: null },
    { externalId: "t2", type: "outro", title: "B", subject: "Mat", url: "/y", assignedAt: new Date(NOW), dueAt: new Date(NOW + H) },
  ];
  assert.deepEqual(toFeed(rows), [{ id: "t1", k: "tarefa", t: "A", u: "/x", a: NOW }]);
});

/* ---------- webhook ---------- */

const assigned = {
  id: "evt_1",
  event: "activity.assigned",
  occurredAt: "2026-11-26T10:00:00-03:00",
  activity: { id: "t123", type: "tarefa", title: "Frações e decimais", subject: "Matemática", url: "/instituicao/assignments/t123", dueAt: "2026-12-03T23:59:00-03:00" },
  classIds: ["6A-2026", "6B-2026", "6A-2026"],
};

test("webhook: evento completo vira a fotografia da atividade", () => {
  const ev = parseEvent(assigned, NOW);
  if (!ev.ok || ev.event !== "activity.assigned") return assert.fail("evento válido esperado");
  assert.equal(ev.activity.assignedAt.toISOString(), "2026-11-26T13:00:00.000Z", "sem assignedAt, vale o occurredAt");
  assert.equal(ev.activity.dueAt?.toISOString(), "2026-12-04T02:59:00.000Z");
  assert.deepEqual(ev.activity.classIds, ["6A-2026", "6B-2026"]);
});

test("webhook: cancelamento só precisa do id da atividade", () => {
  const ev = parseEvent({ id: "evt_2", event: "activity.canceled", occurredAt: "2026-11-26T12:00:00Z", activity: { id: "t123" } }, NOW);
  assert.ok(ev.ok && ev.event === "activity.canceled");
});

test("webhook: cada problema volta com o motivo", () => {
  const bad = (patch: Record<string, unknown>, act: Record<string, unknown> = {}) => {
    const ev = parseEvent({ ...assigned, ...patch, activity: { ...assigned.activity, ...act } }, NOW);
    return ev.ok ? "ok" : ev.error;
  };
  assert.match(bad({ id: "" }), /"id"/);
  assert.match(bad({ event: "activity.done" }), /"event"/);
  assert.match(bad({ occurredAt: "2026-11-26T10:00:00" }), /fuso/, "data sem fuso é ambígua");
  assert.match(bad({ classIds: [] }), /não pode ser vazio/);
  assert.match(bad({}, { type: "quiz" }), /"activity.type"/);
  assert.match(bad({}, { url: "javascript:alert(1)" }), /"activity.url"/);
  assert.match(bad({}, { title: "x".repeat(121) }), /120/);
  assert.equal(bad({ event: "activity.updated", classIds: [] }), "ok", "update pode tirar todas as turmas");
});

test("webhook: um evento sozinho ou um lote de até 100", () => {
  assert.equal(eventsOf(assigned)?.length, 1);
  assert.equal(eventsOf({ events: [assigned, assigned] })?.length, 2);
  assert.equal(eventsOf({ events: [] }), null);
  assert.equal(eventsOf({ events: Array(101).fill(assigned) }), null);
  assert.equal(eventsOf([assigned]), null);
});

test("assinatura: confere com o segredo atual ou o anterior, dentro de 5 minutos", () => {
  const body = JSON.stringify(assigned);
  const ts = 1764160000;
  const sig = signWebhookBody("whsec_old", ts, body);
  assert.equal(verifyWebhookSignature(["whsec_new", "whsec_old"], String(ts), sig, body, ts + 60), "ok");
  assert.equal(verifyWebhookSignature(["whsec_new"], String(ts), sig, body, ts + 60), "invalid");
  assert.equal(verifyWebhookSignature(["whsec_old"], String(ts), sig, body + " ", ts + 60), "invalid", "corpo alterado");
  assert.equal(verifyWebhookSignature(["whsec_old"], String(ts), sig, body, ts + 301), "expired");
  assert.equal(verifyWebhookSignature(["whsec_old"], null, sig, body, ts), "missing");
});
