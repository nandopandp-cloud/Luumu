/*
  Conversa com a Luumu (components/insights/InsightsExperience.tsx) renderizada de verdade
  (React + happy-dom), com os dados de exemplo e uma função `ask` simulada (as regras locais).
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";

installDom("https://app.luumu.test/insights");
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom/happy-dom não rolam a página: o chat pede scroll a cada mensagem
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

let React: typeof import("react");
let createRoot: typeof import("react-dom/client").createRoot;
let InsightsExperience: typeof import("../../components/insights/InsightsExperience").InsightsExperience;
let insightsMock: typeof import("../../lib/insights/mock").insightsMock;
let answerQuestion: typeof import("../../lib/insights/ask").answerQuestion;

before(async () => {
  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ InsightsExperience } = await import("../../components/insights/InsightsExperience"));
  ({ insightsMock } = await import("../../lib/insights/mock"));
  ({ answerQuestion } = await import("../../lib/insights/ask"));
});

const flush = () => React.act(async () => await new Promise((r) => setTimeout(r, 0)));
const submit = (form: Element) =>
  React.act(() => void form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

test("do painel para a conversa: pergunta, resposta com visual, resposta rápida com contexto e volta ao painel", async () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const calls: { question: string; history: { role: string }[] }[] = [];
  const ask = async ({ question, history }: { question: string; history: { role: "user" | "assistant"; content: string }[] }) => {
    calls.push({ question, history });
    return answerQuestion(question, insightsMock, history);
  };
  React.act(() =>
    root.render(
      React.createElement(
        InsightsExperience,
        { data: insightsMock, user: { name: "Fernando", avatarUrl: null }, filters: {}, filtersSlot: null, ask },
        React.createElement("div", { id: "dashboard-cards" }, "cards")
      )
    )
  );

  // painel: sugestão só preenche
  const input = () => host.querySelector("input[aria-label='Pergunte algo sobre seus dados']") as HTMLInputElement;
  const chip = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.includes("O que melhorou no último período?"))!;
  React.act(() => chip.click());
  assert.equal(input().value, "O que melhorou no último período?");
  assert.equal(calls.length, 0);
  assert.ok(host.querySelector("#dashboard-cards"));

  // Enter: vira conversa
  submit(host.querySelector("form")!);
  await flush();
  assert.match(host.textContent ?? "", /Converse com seus dados/);
  const log = host.querySelector("[role=log]")!;
  assert.match(log.textContent ?? "", /O que melhorou no último período\?/); // balão do usuário
  assert.match(log.textContent ?? "", /O CSAT subiu 4 p\.p\., para 75%\./); // resposta da Luumu
  assert.match(log.textContent ?? "", /vs\. período anterior/); // bloco visual de satisfação
  assert.match(log.textContent ?? "", /Quer que eu mostre quais temas/); // pergunta de continuação

  // resposta rápida: envia na hora, com o histórico
  const quick = Array.from(log.querySelectorAll("button")).find((b) => b.textContent?.includes("Sim, mostre os temas"))!;
  React.act(() => quick.click());
  await flush();
  assert.equal(calls[1].question, "Sim, mostre os temas");
  assert.equal(calls[1].history.length, 2);
  assert.match(log.textContent ?? "", /Temas mais citados/);

  // voltar aos insights mantém a conversa
  const back = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.includes("Voltar aos insights"))!;
  React.act(() => back.click());
  assert.ok(host.querySelector("#dashboard-cards"));
  assert.match(host.textContent ?? "", /Voltar à conversa \(2\)/);
  React.act(() => root.unmount());
});
