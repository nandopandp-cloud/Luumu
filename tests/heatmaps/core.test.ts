import { test } from "node:test";
import assert from "node:assert/strict";
import {
  biggestDrops,
  clickPathKey,
  formatDuration,
  heatPalette,
  pageLabel,
  parsePageview,
  pctChange,
  reachAt,
  reachCurve,
  redactLabel,
  sectionStats,
  splitPath,
  heatmapSampleRate,
} from "../../lib/heatmaps/core";

const base = { key: "pk_x", host: "App.Cliente.com", path: "home", device: "desktop", sid: "s1" };

test("envio do SDK: números presos aos limites, listas cortadas, lixo descartado", () => {
  const p = parsePageview({
    ...base,
    vw: -5,
    sd: 180,
    dur: 1e12,
    c: [["body>main>button", 2000, -3], ["<script>", 1, 1], "lixo", ...Array.from({ length: 100 }, () => ["a", 1, 1])],
    m: { "body>div|3|4": 7, "body>div|12|1": 3, "x{color:red}|1|1": 2 },
    h: { "body>a": 1500, "<img>": 9 },
    l: { "body>main>button": "Enviar para joao@x.com", "nao-citado": "x" },
    p: ["body>main>button", "body>a", "body>a", "b", "c", "d"],
    r: 0.05,
  })!;
  assert.equal(p.r, 0.05);
  assert.equal(p.host, "app.cliente.com");
  assert.equal(p.vw, 0);
  assert.equal(p.sd, 100);
  assert.equal(p.dur, 2 * 60 * 60 * 1000);
  assert.deepEqual(p.c[0], ["body>main>button", 1000, 0]);
  assert.equal(p.c.length, 58); // 60 lidos; o "<script>" e o "lixo" caem
  assert.deepEqual(Object.keys(p.m), ["body>div|3|4"]);
  assert.deepEqual(Object.keys(p.h), ["body>a"]);
  assert.equal(p.l["body>main>button"], "Enviar para •••@•••");
  assert.equal(p.l["nao-citado"], undefined);
  assert.equal(p.p.length, 4);
  assert.equal(parsePageview({ ...base, path: "" }), null);
  assert.equal(parsePageview({ ...base, device: "geladeira" })!.device, "desktop");
});

test("rótulos sem dados pessoais", () => {
  assert.equal(redactLabel("CPF 123.456.789-00 de Ana"), "CPF ••• de Ana");
  assert.equal(redactLabel("Ligue (11) 98765-4321"), "Ligue (11) •••");
});

test("caminho: 3 primeiros elementos, só com 2 ou mais", () => {
  assert.equal(clickPathKey(["a"]), null);
  const k = clickPathKey(["a", "b", "c", "d"])!;
  assert.deepEqual(splitPath(k), ["a", "b", "c"]);
});

test("curva de alcance: quem parou em 60% viu 25% e 50%, não 75%", () => {
  const c = reachCurve([
    { depth: 30, n: 1 },
    { depth: 60, n: 2 },
    { depth: 100, n: 1 },
  ]);
  assert.equal(c[0], 1);
  assert.equal(c[25], 1);
  assert.equal(c[50], 0.75);
  assert.equal(c[75], 0.25);
  assert.equal(c[100], 0.25);
  assert.equal(reachAt(c, 45), 0.75);
  assert.deepEqual(reachCurve([]), new Array(101).fill(0));
});

test("seções: alcance e as maiores quedas", () => {
  const c = reachCurve([
    { depth: 20, n: 5 },
    { depth: 55, n: 3 },
    { depth: 100, n: 2 },
  ]);
  const stats = sectionStats(
    [
      { label: "Preços", top: 50 },
      { label: "Topo", top: 0 },
      { label: "Recursos", top: 25 },
    ],
    c
  );
  assert.deepEqual(stats.map((s) => s.label), ["Topo", "Recursos", "Preços"]);
  assert.equal(stats[0].reach, 1);
  assert.ok(Math.abs(stats[0].drop - 0.5) < 1e-9); // metade sai antes de "Recursos"
  assert.equal(biggestDrops(stats)[0].label, "Topo");
});

test("formatos e cores", () => {
  assert.equal(pageLabel("home"), "Página inicial");
  assert.equal(pageLabel("cursos/:id"), "/cursos/:id");
  assert.equal(formatDuration(84_000), "1m 24s");
  assert.equal(formatDuration(9_000), "9s");
  assert.equal(pctChange(118, 100), 18);
  assert.equal(pctChange(5, 0), null);
  const pal = heatPalette();
  assert.deepEqual([pal[0], pal[1], pal[2]], [40, 60, 255]); // frio = azul
  assert.deepEqual([pal[1020], pal[1021], pal[1022]], [255, 40, 40]); // quente = vermelho
});

test("amostragem: cabe na cota do mês, com teto diário", () => {
  const base = { limit: 50_000, used: 10_000, daysLeft: 20, dailyCap: 3000 };
  // sobra 40 mil em 20 dias = 2 mil/dia; com 40 mil sessões/dia, grava 5%
  assert.equal(heatmapSampleRate({ ...base, estimatedDaily: 40_000 }), 0.05);
  assert.equal(heatmapSampleRate({ ...base, estimatedDaily: 500 }), 1); // pouco tráfego: tudo
  assert.equal(heatmapSampleRate({ ...base, estimatedDaily: 0 }), 1); // sem histórico
  assert.equal(heatmapSampleRate({ ...base, used: 50_000, estimatedDaily: 100 }), 0); // cota esgotada
  assert.equal(heatmapSampleRate({ ...base, limit: Infinity, estimatedDaily: 30_000 }), 0.1); // ilimitado: teto de 3 mil/dia
  assert.equal(heatmapSampleRate({ ...base, estimatedDaily: 10_000_000 }), 0.01); // piso de 1%
  assert.equal(heatmapSampleRate({ ...base, limit: 0, estimatedDaily: 10 }), 0); // plano sem heatmaps
});
