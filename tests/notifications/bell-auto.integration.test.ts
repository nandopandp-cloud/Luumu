/*
  Avisos automáticos no sino (src/sdk/notifications/bell.ts) num DOM de verdade (happy-dom): o sino
  lê a lista das turmas do identify, mostra "Nova tarefa" e o lembrete de prazo, não acende com o
  que é antigo na primeira vez, tira a atividade quando o estudante chega à tela de resultado (ou
  o produto chama complete) e manda as métricas com o id do aviso.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom, sleep } from "../tours/support/dom-env";
import { DEFAULT_BELL_SETTINGS, publicNotifications } from "@/lib/notifications/model";
import type { FeedActivity } from "@/lib/notifications/activities";
import type { BellWidget } from "@/sdk/notifications/bell";

installDom("https://preparasp.jovensgenios.com/inicio");
const g = globalThis as Record<string, unknown>;
const H = 3600_000;
const now = Date.now();
const feedCalls: string[] = [];
const posts: { events: { id: string; kind: string }[] }[] = [];
let identity: Record<string, unknown> = {};
let bell: BellWidget;

const feeds: Record<string, FeedActivity[]> = {
  "6A": [
    { id: "t1", k: "tarefa", t: "Frações", s: "Matemática", u: "/instituicao/assignments/t1", a: now - H, d: now + 10 * H },
    { id: "old", k: "tarefa", t: "Revisão antiga", u: "/instituicao/assignments/old", a: now - 4 * 24 * H, d: now + 5 * 24 * H },
  ],
  "6B": [
    { id: "p9", k: "prova_genial", t: "Prova Genial 3", u: "/instituicao/avaliacoes/p9", a: now - 2 * H },
    // a mesma tarefa nas duas turmas do estudante: um aviso só
    { id: "t1", k: "tarefa", t: "Frações", s: "Matemática", u: "/instituicao/assignments/t1", a: now - H, d: now + 10 * H },
  ],
};

const data = publicNotifications({ ...DEFAULT_BELL_SETTINGS, enabled: true, auto: { enabled: true, novas: true, dueHours: 24 } }, [], "prj_test", "preparasp.jovensgenios.com")!;

const slot = () => document.getElementById("luumu-bell")!;
const bellBtn = () => slot().querySelector("[data-luumu-bell]")?.shadowRoot?.querySelector("button") ?? null;
const panel = () => document.querySelector("[data-luumu-notifications]")?.shadowRoot ?? null;
const badge = () => bellBtn()?.querySelector(".badge")?.textContent ?? null;
const titles = () => [...(panel()?.querySelectorAll(".nt") ?? [])].map((e) => e.textContent?.trim());

before(async () => {
  document.body.innerHTML = `<header><div id="luumu-bell"></div></header><main></main>`;
  g.fetch = async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/notifications/feed")) {
      const c = new URL(u).searchParams.get("c")!;
      feedCalls.push(c);
      return new Response(JSON.stringify({ items: feeds[c] ?? [] }), { status: 200 });
    }
    if (u.includes("/notifications/events")) posts.push(JSON.parse(String(init?.body)));
    return new Response("{}", { status: 200 });
  };
  await import("@/sdk/notifications/bell");
  bell = (window as unknown as { __luumuBell: BellWidget }).__luumuBell;
  bell.boot({ api: "https://luumu.test/api/v1", key: "pk_test", data, identity: () => identity });
});

test("sem turmas no identify, o sino não busca atividades", async () => {
  identity = { id: "8812" };
  bell.identify();
  await sleep(20);
  assert.equal(feedCalls.length, 0);
  assert.equal(badge(), null);
});

test("com class_ids, lê cada turma uma vez e mostra os avisos sem repetir a tarefa", async () => {
  identity = { id: "8812", class_ids: ["6A", "6B"] };
  bell.identify();
  await sleep(30);
  assert.deepEqual(feedCalls.sort(), ["6A", "6B"]);
  // Frações (nova + prazo em 10h), Prova Genial (nova); a revisão antiga entra como lida
  assert.equal(badge(), "3");
  bellBtn()!.click();
  assert.deepEqual(titles(), ["Falta 1 dia", "Nova tarefa", "Nova Prova Genial", "Nova tarefa"]);
  assert.ok(panel()!.textContent!.includes("Matemática · Frações"));
  assert.equal(panel()!.querySelectorAll(".ntf.unread").length, 3, "a antiga fica em Anteriores");
  bellBtn()!.click();
});

test("chegar à tela de resultado tira a atividade do sino", async () => {
  history.pushState({}, "", "/instituicao/assignments/t1/complete");
  document.querySelector("main")!.innerHTML = "<p>Parabéns!</p>"; // o SPA mexe no DOM ao trocar de tela
  await sleep(350);
  bellBtn()!.click();
  assert.deepEqual(titles(), ["Nova Prova Genial", "Nova tarefa"], "Frações (nova e prazo) saiu");
  bellBtn()!.click();
});

test("Luumu.notifications.complete tira a atividade informada pelo produto", () => {
  bell.complete("p9");
  bellBtn()!.click();
  assert.deepEqual(titles(), ["Nova tarefa"]);
  assert.ok(panel()!.textContent!.includes("Revisão antiga"));
  bellBtn()!.click();
});

test("concluídas ficam guardadas por estudante; outro estudante no mesmo computador vê as dele", async () => {
  history.pushState({}, "", "/inicio");
  identity = { id: "9001", class_ids: ["6A"] };
  bell.identify();
  await sleep(30);
  bellBtn()!.click();
  assert.deepEqual(titles(), ["Falta 1 dia", "Nova tarefa", "Nova tarefa"], "para ele Frações continua pendente");
  bellBtn()!.click();
});

test("métricas vão com o id do aviso (o servidor soma por atividade)", async () => {
  await sleep(3200);
  const ids = posts.flatMap((p) => p.events.map((e) => `${e.id}|${e.kind}`));
  assert.ok(ids.includes("n:t1|delivered"));
  assert.ok(ids.includes("n:p9|seen"));
  assert.ok(ids.some((x) => /^d:t1:\d+\|delivered$/.test(x)));
});

test("debug mostra turmas, atividades e avisos", () => {
  const d = bell.debug() as { turmasNoIdentify: string[]; atividadesPorTurma: Record<string, string[]>; avisosNoSino: unknown[] };
  assert.deepEqual(d.turmasNoIdentify, ["6A"]);
  assert.equal(d.atividadesPorTurma["6A"].length, 2);
  assert.equal(d.avisosNoSino.length, 3);
});
