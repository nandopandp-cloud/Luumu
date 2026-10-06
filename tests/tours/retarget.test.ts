import { test } from "node:test";
import assert from "node:assert/strict";
import { retargetHosts } from "../../lib/tours/retarget";
import { defaultSettings, starterSteps } from "../../lib/tours/defaults";
import type { TourSettings, TourStep } from "../../lib/tours/types";

const SRC = "preparasp.jovensgenios.com";
const DST = "matematicaem.jovensgenios.com";

function fixture(): { settings: TourSettings; steps: TourStep[] } {
  const settings: TourSettings = {
    ...defaultSettings(`https://${SRC}/inicio?x=1`),
    targetHosts: [SRC],
    audience: { mode: "rules", match: "all", rules: [{ field: "host", op: "eq", value: SRC }, { field: "user.plan", op: "eq", value: SRC }] },
  };
  const [a, b] = starterSteps();
  const steps: TourStep[] = [
    { ...a, action: { type: "open_url", value: `https://${SRC}/aulas`, newTab: true }, conditions: [{ field: "host", op: "neq", value: SRC }] },
    { ...(b ?? a), key: "b", imageUrl: "https://x.public.blob.vercel-storage.com/i.png", action: { type: "open_url", value: "https://youtube.com/v" } },
  ];
  return { settings, steps };
}

test("um destino: troca plataforma, URL inicial, links e regras de host da origem", () => {
  const { settings, steps } = retargetHosts(fixture().settings, fixture().steps, [DST]);
  assert.deepEqual(settings.targetHosts, [DST]);
  assert.equal(settings.startUrl, `https://${DST}/inicio?x=1`);
  assert.equal(settings.audience.rules[0].value, DST);
  assert.equal(settings.audience.rules[1].value, SRC); // não é regra de host: intacta
  assert.equal(steps[0].action.value, `https://${DST}/aulas`);
  assert.equal(steps[0].conditions[0].value, DST);
  // links externos e imagens não mudam
  assert.equal(steps[1].action.value, "https://youtube.com/v");
  assert.equal(steps[1].imageUrl, "https://x.public.blob.vercel-storage.com/i.png");
});

test("vários destinos ou 'todas': só muda targetHosts", () => {
  for (const hosts of [[DST, "squad.jovensgenios.com"], []]) {
    const { settings, steps } = retargetHosts(fixture().settings, fixture().steps, hosts);
    assert.deepEqual(settings.targetHosts, hosts);
    assert.equal(settings.startUrl, `https://${SRC}/inicio?x=1`);
    assert.equal(steps[0].action.value, `https://${SRC}/aulas`);
  }
});

test("não altera o original", () => {
  const f = fixture();
  retargetHosts(f.settings, f.steps, [DST]);
  assert.deepEqual(f.settings.targetHosts, [SRC]);
  assert.equal(f.steps[0].action.value, `https://${SRC}/aulas`);
});
