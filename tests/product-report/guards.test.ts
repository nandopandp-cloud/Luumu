/*
  Regressão de segurança: toda porta de entrada do módulo passa pelo guard da conta autorizada.
  Uma action ou rota nova sem o guard quebra este teste antes de chegar à produção.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

/** Corpo de cada `export async function` do arquivo (até a próxima declaração de topo). */
function exportedFunctions(src: string): { name: string; body: string }[] {
  const re = /^export async function (\w+)\s*\([^)]*\)[^{]*\{/gm;
  const out: { name: string; body: string }[] = [];
  let m: RegExpExecArray | null;
  const starts: { name: string; at: number }[] = [];
  while ((m = re.exec(src))) starts.push({ name: m[1], at: m.index + m[0].length });
  starts.forEach((s, i) => out.push({ name: s.name, body: src.slice(s.at, starts[i + 1]?.at ?? src.length) }));
  return out;
}

test("toda server action do módulo começa pelo guard", () => {
  const fns = exportedFunctions(read("src/app/(app)/product-report/actions.ts"));
  assert.ok(fns.length >= 6, `actions encontradas: ${fns.map((f) => f.name)}`);
  for (const f of fns) {
    const first = f.body.trim().split("\n")[0];
    assert.match(first, /await requireProductReportAccess\(\)/, `${f.name} não chama o guard na primeira linha`);
  }
});

test("layout e página do módulo chamam o guard", () => {
  for (const file of ["src/app/(app)/product-report/layout.tsx", "src/app/(app)/product-report/page.tsx"]) {
    assert.match(read(file), /await requireProductReportAccess\(\)/, file);
  }
});

test("toda rota de API do módulo responde 404 sem a conta autorizada", () => {
  const dir = path.join(root, "src/app/api/product-report");
  const routes: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = path.join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f === "route.ts") routes.push(p);
    }
  };
  walk(dir);
  assert.ok(routes.length >= 1);
  for (const r of routes) {
    const src = readFileSync(r, "utf8");
    for (const f of exportedFunctions(src)) {
      const lines = f.body.trim().split("\n");
      assert.match(lines[0], /await productReportApiSession\(\)/, `${r}: ${f.name}`);
      assert.match(lines[1], /if \(!session\) return .*status: 404/, `${r}: ${f.name}`);
    }
  }
});

test("a rota exige sessão no proxy e o item de menu não está no NAV público", () => {
  assert.match(read("src/proxy.ts"), /"\/product-report"/);
  const nav = read("src/components/shell/nav.ts");
  const navBlock = nav.slice(nav.indexOf("export const NAV"));
  assert.ok(!navBlock.includes("/product-report"), "o item do módulo não pode ir no NAV de todos");
});
