/*
  "Pergunte algo sobre seus dados" renderizado de verdade (React + happy-dom), com os dados de
  exemplo tipados (lib/insights/mock.ts).
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";

installDom("https://app.luumu.test/insights");
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let React: typeof import("react");
let createRoot: typeof import("react-dom/client").createRoot;
let AiQuery: typeof import("../../components/insights/AiQuery").AiQuery;
let insightsMock: typeof import("../../lib/insights/mock").insightsMock;

before(async () => {
  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ AiQuery } = await import("../../components/insights/AiQuery"));
  ({ insightsMock } = await import("../../lib/insights/mock"));
});

test("sugestão preenche sem enviar; Enter responde com os dados; pergunta livre não é inventada", () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  React.act(() => root.render(React.createElement(AiQuery, { data: insightsMock })));

  const input = host.querySelector("input[aria-label='Pergunte algo sobre seus dados']") as HTMLInputElement;
  const chip = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.includes("Quais são os principais problemas?"))!;
  React.act(() => chip.click());
  assert.equal(input.value, "Quais são os principais problemas?");
  assert.equal(host.querySelector("[role=status]"), null, "sugestão não envia sozinha");

  const form = host.querySelector("form")!;
  React.act(() => void form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  const answer = host.querySelector("[role=status]")!;
  assert.match(answer.textContent ?? "", /performance/i);
  assert.ok(host.querySelector("a[href='#recommendations']"), "leva à seção que aprofunda");

  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")!.set!;
  React.act(() => {
    setter.call(input, "Quem vai ganhar o jogo de amanhã?");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  React.act(() => void form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  assert.match(host.querySelector("[role=status]")!.textContent ?? "", /Ainda não consigo responder perguntas livres/);
  React.act(() => root.unmount());
});
