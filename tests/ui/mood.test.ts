import { test } from "node:test";
import assert from "node:assert/strict";
import { dotValue, moodFor } from "../../components/dashboard/ScoreEvolutionCard";

test("o ponto do gráfico de área usa o valor real, não o par [base, valor]", () => {
  // formato que o Recharts entrega no <Area>: value = [0, 75]
  assert.equal(dotValue({ value: [0, 75], payload: { value: 75 } }), 75);
  assert.equal(dotValue({ value: [0, 60] }), 60);
  assert.equal(dotValue({ value: 78 }), 78);
  assert.equal(dotValue({ value: null, payload: { value: null } }), null);
});

test("faixas de sentimento", () => {
  const label = (n: number) => moodFor(n).label;
  assert.equal(label(10), "Muito negativo");
  assert.equal(label(20), "Negativo");
  assert.equal(label(45), "Neutro");
  assert.equal(label(60), "Positivo");
  assert.equal(label(75), "Positivo");
  assert.equal(label(78), "Positivo");
  assert.equal(label(79.9), "Positivo");
  assert.equal(label(80), "Muito positivo");
  assert.equal(label(100), "Muito positivo");
  // e, sobretudo, o bug antigo: valor inválido nunca vira "Muito positivo" por acidente
  assert.equal(dotValue({ value: [0, NaN] }), null);
});
