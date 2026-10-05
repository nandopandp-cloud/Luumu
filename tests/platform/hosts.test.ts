// Seleção de várias plataformas no header: "a,b" na URL, no cookie e nos escopos de consulta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hostList, normalizeHosts } from "../../lib/hosts";
import { parseViewConfig } from "../../lib/analytics/core";

test("lista de plataformas: normaliza, tira repetidas e vazias", () => {
  assert.deepEqual(hostList("Preparasp.jovensgenios.com, https://matematicaem.jovensgenios.com/x,,preparasp.jovensgenios.com"), [
    "preparasp.jovensgenios.com",
    "matematicaem.jovensgenios.com",
  ]);
  assert.deepEqual(hostList(""), []);
  assert.deepEqual(hostList(null), []);
  assert.equal(normalizeHosts("a.com , b.com"), "a.com,b.com");
  assert.equal(normalizeHosts("a.com"), "a.com");
});

test("visão salva do Analytics guarda uma ou várias plataformas", () => {
  assert.equal(parseViewConfig({ tab: "overview", host: "a.com,b.com" }).host, "a.com,b.com");
  assert.equal(parseViewConfig({ tab: "overview", host: "a.com" }).host, "a.com");
  assert.equal(parseViewConfig({ tab: "overview", host: "a.com;drop" }).host, undefined);
});
