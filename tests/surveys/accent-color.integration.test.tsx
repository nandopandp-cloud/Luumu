/*
  Cor de destaque da pesquisa (components/surveys/AccentColorPicker.tsx) com React + happy-dom:
  favoritas do time aparecem e podem ser escolhidas; sem a migração 0046 a área avisa; a estrela
  só favorita uma cor válida. E a normalização da cor (lib/utils/color.ts).
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";
import { normalizeHexColor } from "@/lib/utils/color";

installDom("https://app.luumu.test/surveys/x/appearance");
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as Record<string, unknown>).self ??= globalThis;
// as server actions importam o cliente do banco, que exige as variáveis (nenhuma consulta é feita aqui)
process.env.DATABASE_URL ??= "postgres://teste:teste@localhost:5432/teste";
process.env.AUTH_SECRET ??= "segredo-de-teste";

let React: typeof import("react");
let createRoot: typeof import("react-dom/client").createRoot;
let AccentColorPicker: typeof import("@/components/surveys/AccentColorPicker").AccentColorPicker;

before(async () => {
  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ AccentColorPicker } = await import("@/components/surveys/AccentColorPicker"));
});

test("normaliza a cor: #abc, sem #, espaços e caixa", () => {
  assert.equal(normalizeHexColor(" #abc "), "#AABBCC");
  assert.equal(normalizeHexColor("12a4f0"), "#12A4F0");
  assert.equal(normalizeHexColor("#12345"), "");
  assert.equal(normalizeHexColor("azul"), "");
  assert.equal(normalizeHexColor(null), "");
});

async function mount(props: { value: string; favorites: string[] | null }) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const picked: string[] = [];
  function Harness() {
    const [v, setV] = React.useState(props.value);
    return React.createElement(AccentColorPicker, { value: v, onChange: (c: string) => (picked.push(c), setV(c)), presets: ["#6B2BD9", "#0D0F1A"], favorites: props.favorites });
  }
  await React.act(async () => root.render(React.createElement(Harness)));
  return { host, root, picked };
}

test("favoritas do time aparecem e escolhem a cor com um clique", async () => {
  const { host, root, picked } = await mount({ value: "#12A4F0", favorites: ["#12A4F0", "#FF8800"] });
  const fav = host.querySelector('[aria-label="Cor favorita #FF8800"]') as HTMLButtonElement;
  assert.ok(fav, "favorita listada");
  assert.equal(host.querySelector('[aria-label="Cor favorita #12A4F0"]')!.getAttribute("aria-pressed"), "true", "a cor atual aparece marcada");
  const star = [...host.querySelectorAll("button")].find((b) => /Favorit/.test(b.textContent ?? "")) as HTMLButtonElement;
  assert.equal(star.textContent?.trim(), "Favorita", "a cor atual já é favorita");
  await React.act(async () => fav.click());
  assert.deepEqual(picked, ["#FF8800"]);
  await React.act(async () => root.unmount());
});

test("sem a migração, avisa; com cor inválida, a estrela fica desabilitada", async () => {
  const a = await mount({ value: "#6B2BD9", favorites: null });
  assert.match(a.host.textContent!, /migração 0046/);
  await React.act(async () => a.root.unmount());
  const b = await mount({ value: "#12", favorites: [] });
  const star = [...b.host.querySelectorAll("button")].find((x) => /Favorit/.test(x.textContent ?? "")) as HTMLButtonElement;
  assert.equal(star.disabled, true);
  assert.match(b.host.textContent!, /Nenhuma ainda/);
  await React.act(async () => b.root.unmount());
});
