import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReportModel, goalFor, resolveValues, type StoredPeriod, type SyncSnapshot } from "../../lib/product-report/model";
import { DEFAULT_WEIGHTS } from "../../lib/product-report/indicators";

const NOW = new Date("2026-10-20T12:00:00Z"); // quinzena 2026-10-1 já fechada

const fullSync = (createdAt: string, over: Partial<SyncSnapshot["values"]> = {}): SyncSnapshot => ({
  createdAt,
  status: "ok",
  error: null,
  projects: { geniex: { id: "prj_g", name: "GenieX" }, exploradores: { id: "prj_x", name: "Exploradores" }, educadores: { id: "prj_e", name: "Educadores" } },
  values: {
    "educadores.adherence": { value: 64 }, "educadores.usage": { value: 13 }, "educadores.csat": { value: 86.5, detail: "CSAT Out" },
    "exploradores.adherence": { value: 43.7 }, "exploradores.usage": { value: 5 }, "exploradores.csat": { value: 78.9 },
    "geniex.adherence": { value: 65 }, "geniex.usage": { value: 22 },
    ...over,
  },
});

const stored = (period: string, p: Partial<StoredPeriod> = {}): StoredPeriod => ({ period, goals: {}, manual: {}, notes: "", updatedAt: "2026-10-01T00:00:00.000Z", ...p });

const GOALS = { "ns.csat": 95, "ns.adherence": 50, "ns.usage": 15 };

test("metas são herdadas da última quinzena que as definiu", () => {
  const byPeriod = new Map([
    ["2026-09-1", stored("2026-09-1", { goals: { "ns.csat": 90 } })],
    ["2026-09-2", stored("2026-09-2", { goals: { "ns.csat": 95 } })],
  ]);
  assert.deepEqual(goalFor("ns.csat", "2026-09-2", byPeriod), { value: 95, from: null });
  assert.deepEqual(goalFor("ns.csat", "2026-10-2", byPeriod), { value: 95, from: "2026-09-2" });
  assert.deepEqual(goalFor("ns.csat", "2026-08-2", byPeriod), { value: null, from: null });
});

test("dado da Luumu tem prioridade; valor informado só cobre o que falta", () => {
  const sync = fullSync("2026-10-16T10:00:00Z", { "geniex.usage": { value: null, warnings: ["sem sessões"] } });
  const st = stored("2026-10-1", { manual: { "geniex.usage": { value: 20, source: "manual" }, "geniex.adherence": { value: 1, source: "manual" } } });
  const r = resolveValues(sync, st);
  assert.equal(r["geniex.adherence"].value, 65); // Luumu vence o manual
  assert.match(r["geniex.adherence"].source!, /Analytics/);
  assert.equal(r["geniex.usage"].value, 20);
  assert.equal(r["geniex.usage"].source, "Informado manualmente");
  assert.deepEqual(r["geniex.usage"].warnings, []);
});

test("sincronização com erro não fornece valores", () => {
  const sync: SyncSnapshot = { ...fullSync("2026-10-16T10:00:00Z"), status: "error", error: "timeout" };
  assert.equal(resolveValues(sync, undefined)["geniex.adherence"].value, null);
});

test("modelo completo: North Star, status, comparação com a quinzena anterior e nova meta", () => {
  const m = buildReportModel({
    period: "2026-10-1",
    stored: [
      stored("2026-09-2", { goals: GOALS, manual: { "geniex.adherence": { value: 60, source: "planilha" } } }),
      stored("2026-10-2", { goals: { "ns.adherence": 55 } }),
    ],
    syncs: {
      "2026-10-1": fullSync("2026-10-16T10:00:00Z"),
      "2026-09-2": fullSync("2026-10-01T10:00:00Z", { "geniex.adherence": { value: 55 } }),
    },
    weights: DEFAULT_WEIGHTS,
    now: NOW,
  });

  assert.ok(Math.abs(m.northStar.value! - 98.83578947) < 1e-6);
  const adh = m.components.find((c) => c.metric === "adherence")!.row;
  assert.equal(adh.target, 50);
  assert.equal(adh.targetFrom, "2026-09-2");
  assert.equal(adh.nextTarget, 55);
  assert.equal(adh.nextTargetFrom, null);
  assert.equal(adh.status, "met");
  const csat = m.components.find((c) => c.metric === "csat")!.row;
  assert.equal(csat.status, "missed"); // 82,7 < 95

  const gnx = m.groups.find((g) => g.key === "geniex")!.rows.find((r) => r.key === "geniex.adherence")!;
  assert.equal(gnx.prev, 55); // Luumu na quinzena anterior, não o valor da planilha
  assert.equal(gnx.delta, 10);
  assert.equal(gnx.status, "no_target");

  assert.deepEqual(m.groups.map((g) => g.title), ["Gestão de Produto", "GenieX", "Exploradores", "Educadores"]);
  assert.deepEqual(m.groups[1].rows.map((r) => r.key), ["geniex.adherence", "geniex.usage"]); // sem CSAT
  assert.equal(m.history.length, 8);
  assert.equal(m.history.at(-1)!.period, "2026-10-1");
  assert.equal(m.history.at(-1)!.targets["ns.adherence"], 50);
  assert.equal(m.alerts.length, 0, JSON.stringify(m.alerts));
});

test("alertas: sem sincronização, sincronização antes do fim, dado ausente e falha", () => {
  const none = buildReportModel({ period: "2026-10-1", stored: [stored("2026-10-1", { goals: GOALS })], syncs: {}, weights: DEFAULT_WEIGHTS, now: NOW });
  assert.ok(none.alerts.some((a) => /ainda não foram buscados/.test(a.text)));
  assert.equal(none.northStar.value, null);
  assert.equal(none.northStar.status, "no_data");

  const early = buildReportModel({
    period: "2026-10-1",
    stored: [stored("2026-10-1", { goals: GOALS })],
    syncs: { "2026-10-1": fullSync("2026-10-10T10:00:00Z", { "geniex.usage": { value: null, warnings: ["nenhuma sessão registrada"] } }) },
    lastAttempt: { ...fullSync("2026-10-17T10:00:00Z"), status: "error", error: "banco indisponível" },
    weights: DEFAULT_WEIGHTS,
    now: NOW,
  });
  const texts = early.alerts.map((a) => a.text);
  assert.ok(texts.some((t) => /antes do fim da quinzena/.test(t)));
  assert.ok(texts.some((t) => t === "GenieX · Tempo de uso: nenhuma sessão registrada"));
  assert.ok(texts.some((t) => t === "GenieX · Tempo de uso: sem dado nesta quinzena."));
  assert.ok(early.alerts.some((a) => a.tone === "error" && /banco indisponível/.test(a.text)));
  assert.equal(early.northStar.value, null);
});

test("quinzena histórica toda informada: aviso de origem em vez de pedir atualização", () => {
  const manual = Object.fromEntries(
    Object.entries(fullSync("x").values).map(([k, v]) => [k, { value: v!.value as number, source: "planilha" as const }])
  );
  const m = buildReportModel({ period: "2026-09-2", stored: [stored("2026-09-2", { goals: GOALS, manual })], syncs: {}, weights: DEFAULT_WEIGHTS, now: NOW });
  assert.deepEqual(m.alerts, [{ tone: "info", text: "Todos os números desta quinzena vêm de valores informados (planilha ou manual), não da Luumu." }]);
  assert.ok(Math.abs(m.northStar.value! - 98.83578947) < 1e-6);
});

test("quinzena em andamento é sinalizada", () => {
  const m = buildReportModel({ period: "2026-10-2", stored: [], syncs: {}, weights: DEFAULT_WEIGHTS, now: NOW });
  assert.equal(m.closed, false);
  assert.ok(m.alerts.some((a) => a.tone === "info" && /em andamento/.test(a.text)));
});
