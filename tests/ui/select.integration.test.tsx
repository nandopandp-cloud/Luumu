/*
  Select da plataforma (components/ui/Select.tsx) renderizado de verdade com React + happy-dom:
  mesma interface do <select> nativo, menu em portal, teclado, busca e opções desativadas.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";

installDom("https://app.luumu.test/");
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

type Mod = typeof import("../../components/ui/Select");
let Select: Mod["Select"];
let React: typeof import("react");
let createRoot: typeof import("react-dom/client").createRoot;
let act: typeof import("react").act;

before(async () => {
  React = await import("react");
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Select } = await import("../../components/ui/Select"));
});

function mount(el: React.ReactElement) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(el));
  return { host, root, unmount: () => act(() => root.unmount()) };
}
const trigger = (host: Element) => host.querySelector("[role=combobox]") as HTMLButtonElement;
const options = () => Array.from(document.querySelectorAll("[role=option]")) as HTMLElement[];
const key = (el: Element, k: string) => act(() => void el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })));

test("abre, mostra as opções com o selecionado marcado e devolve e.target.value", () => {
  const got: string[] = [];
  function Demo() {
    const [v, setV] = React.useState("30d");
    return React.createElement(
      Select,
      { value: v, onChange: (e) => { got.push(e.target.value); setV(e.target.value); }, "aria-label": "Período" },
      React.createElement("option", { value: "7d" }, "Últimos 7 dias"),
      React.createElement("option", { value: "30d" }, "Últimos 30 dias"),
      React.createElement("option", { value: "all" }, "Todo o período")
    );
  }
  const m = mount(React.createElement(Demo));
  assert.equal(trigger(m.host).textContent, "Últimos 30 dias");
  act(() => trigger(m.host).click());
  assert.equal(trigger(m.host).getAttribute("aria-expanded"), "true");
  assert.deepEqual(options().map((o) => o.getAttribute("aria-selected")), ["false", "true", "false"]);
  act(() => options()[2].click());
  assert.deepEqual(got, ["all"]);
  assert.equal(trigger(m.host).textContent, "Todo o período");
  assert.equal(options().length, 0, "menu fecha depois de escolher");
  m.unmount();
});

test("teclado: setas pulam opção desativada, Enter escolhe, Esc fecha", () => {
  const got: string[] = [];
  const m = mount(
    React.createElement(
      Select,
      { defaultValue: "", onChange: (e) => got.push(e.target.value) },
      React.createElement("option", { value: "", disabled: true }, "Selecione…"),
      React.createElement("option", null, "Azul"),
      React.createElement("option", null, "Verde")
    )
  );
  const t = trigger(m.host);
  key(t, "ArrowDown"); // abre
  key(t, "ArrowDown"); // vai para "Azul" (pula o desativado)
  key(t, "ArrowDown"); // "Verde"
  key(t, "Enter");
  assert.deepEqual(got, ["Verde"], "opção sem value usa o texto");
  key(t, "ArrowDown");
  key(t, "Escape");
  assert.equal(options().length, 0);
  m.unmount();
});

test("listas longas ganham busca (sem acento, sem caixa)", () => {
  const zones = ["America/Sao_Paulo", "America/Manaus", "America/Recife", "Europe/Lisboa", "Europe/Paris", "Asia/Tokyo", "UTC", "America/Bogota", "America/Lima", "Africa/Luanda"];
  const m = mount(React.createElement(Select, { value: "UTC", onChange: () => {} }, ...zones.map((z) => React.createElement("option", { key: z, value: z }, z))));
  act(() => trigger(m.host).click());
  const search = document.querySelector("input[aria-label='Buscar opção']") as HTMLInputElement;
  assert.ok(search, "campo de busca aparece com 9+ opções");
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(search), "value")!.set!;
  act(() => {
    setter.call(search, "SÃO");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.deepEqual(options().map((o) => o.textContent), ["America/Sao_Paulo"]);
  m.unmount();
});

test("desativado não abre", () => {
  const m = mount(React.createElement(Select, { value: "a", disabled: true }, React.createElement("option", { value: "a" }, "A")));
  act(() => trigger(m.host).click());
  assert.equal(options().length, 0);
  m.unmount();
});
