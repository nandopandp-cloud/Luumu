import { test } from "node:test";
import assert from "node:assert/strict";
import { axisTicks, dotValue, moodFor } from "../../components/dashboard/ScoreEvolutionCard";

test("o ponto do gráfico de área usa o valor real, não o par [base, valor]", () => {
  // formato que o Recharts entrega no <Area>: value = [0, 75]
  assert.equal(dotValue({ value: [0, 75], payload: { value: 75 } }), 75);
  assert.equal(dotValue({ value: [0, 60] }), 60);
  assert.equal(dotValue({ value: 78 }), 78);
  assert.equal(dotValue({ value: null, payload: { value: null } }), null);
});

test("faixas de sentimento", () => {
  const label = (n: number) => moodFor(n).label;
  // 0–29 | 30–49 | 50–69 | 70–89 | 90–100
  assert.equal(label(0), "Muito negativo");
  assert.equal(label(29), "Muito negativo");
  assert.equal(label(30), "Negativo");
  assert.equal(label(49), "Negativo");
  assert.equal(label(50), "Neutro");
  assert.equal(label(60), "Neutro");
  assert.equal(label(69), "Neutro");
  assert.equal(label(70), "Positivo");
  assert.equal(label(71), "Positivo");
  assert.equal(label(75), "Positivo");
  assert.equal(label(78), "Positivo");
  assert.equal(label(89), "Positivo");
  assert.equal(label(90), "Muito positivo");
  assert.equal(label(100), "Muito positivo");
  // e, sobretudo, o bug antigo: valor inválido nunca vira "Muito positivo" por acidente
  assert.equal(dotValue({ value: [0, NaN] }), null);
});

test("eixo vertical focado nos dados, de 5 em 5", () => {
  const pct = { min: 0, max: 100 };
  // o caso do gráfico: semanas com 60–78%
  assert.deepEqual(axisTicks([75, 75, 78, 71, 60], pct), { domain: [55, 85], ticks: [55, 60, 65, 70, 75, 80, 85] });
  // nunca passa dos limites da métrica
  const top = axisTicks([92, 98, 100], pct);
  assert.equal(top.domain[1], 100);
  assert.ok(top.ticks.every((t) => t >= 0 && t <= 100));
  // faixa larga: passo maior, no máximo ~8 marcações
  const wide = axisTicks([5, 95], pct);
  assert.ok(wide.ticks.length <= 8, String(wide.ticks));
  // contagens começam no zero
  assert.equal(axisTicks([40, 55, 61], { min: 0, max: Number.MAX_SAFE_INTEGER }, true).domain[0], 0);
  // série plana não vira um eixo de largura zero
  const flat = axisTicks([70, 70, 70], pct);
  assert.ok(flat.domain[1] - flat.domain[0] >= 10);
});
