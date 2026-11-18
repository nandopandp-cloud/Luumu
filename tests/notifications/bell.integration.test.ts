/*
  Sino no produto (src/sdk/notifications/bell.ts) num DOM de verdade (happy-dom): só aparece com
  usuário identificado, no espaço reservado do header; contador, painel, lidas por usuário, volta
  ao lugar quando o header é remontado (SPA) e manda cada métrica uma vez.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom, sleep } from "../tours/support/dom-env";
import { DEFAULT_BELL_SETTINGS, publicNotifications, type NotificationForSdk } from "@/lib/notifications/model";
import type { BellWidget } from "@/sdk/notifications/bell";

installDom("https://geniex.escola.com/inicio");
const g = globalThis as Record<string, unknown>;
const posts: { user: string; events: { id: string; kind: string }[] }[] = [];
let identity: Record<string, unknown> = {};
let bell: BellWidget;

const row = (o: Partial<NotificationForSdk>): NotificationForSdk => ({
  id: "n1",
  title: "Simulado no sábado",
  body: "Das 9h às 12h.",
  category: "evento",
  ctaLabel: "Ver simulado",
  ctaUrl: "/simulados",
  audience: {},
  hosts: [],
  pinned: false,
  status: "publicada",
  publishAt: null,
  publishedAt: new Date(Date.now() - 3600_000),
  expiresAt: null,
  ...o,
});

const data = publicNotifications(
  { ...DEFAULT_BELL_SETTINGS, enabled: true },
  [
    row({}),
    row({ id: "n2", title: "Nova trilha de Física", ctaLabel: null, ctaUrl: null, category: "novidade" }),
    row({ id: "n3", title: "Só para o 9º ano", audience: { schoolYears: ["EF9"] } }),
  ],
  "prj_test",
  "geniex.escola.com"
)!;

const slot = () => document.getElementById("luumu-bell")!;
const bellBtn = () => slot().querySelector("[data-luumu-bell]")?.shadowRoot?.querySelector("button") ?? null;
const panel = () => document.querySelector("[data-luumu-notifications]")?.shadowRoot ?? null;

before(async () => {
  document.body.innerHTML = `<header><nav>Início</nav><div id="luumu-bell"></div></header><main></main>`;
  g.fetch = async (url: string, init?: RequestInit) => {
    if (String(url).includes("/notifications/events")) posts.push(JSON.parse(String(init?.body)));
    return new Response("{}", { status: 200 });
  };
  await import("@/sdk/notifications/bell");
  bell = (window as unknown as { __luumuBell: BellWidget }).__luumuBell;
  bell.boot({ api: "https://luumu.test/api/v1", key: "pk_test", data, identity: () => identity });
});

test("sem usuário identificado o sino não aparece", () => {
  assert.equal(bellBtn(), null);
});

test("com identify, entra no espaço reservado com o contador das que valem para ele", () => {
  identity = { id: "8812", school_year: "6º ano" };
  bell.identify();
  const btn = bellBtn();
  assert.ok(btn, "sino montado dentro de #luumu-bell");
  assert.equal(btn!.querySelector(".badge")?.textContent, "2", "o recado do 9º ano fica de fora");
});

test("abrir mostra as novas e zera o contador; fechar move para anteriores", () => {
  bellBtn()!.click();
  const root = panel();
  assert.ok(root, "painel aberto no <body>");
  assert.equal(root!.querySelectorAll(".ntf.unread").length, 2);
  assert.ok(root!.textContent!.includes("Simulado no sábado"));
  assert.ok(root!.querySelector(".cta"), "botão de ação do recado");
  assert.equal(bellBtn()!.querySelector(".badge"), null, "contador some ao abrir");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  assert.equal(document.querySelector("[data-luumu-notifications]"), null, "Esc fecha");
  bellBtn()!.click();
  assert.equal(panel()!.querySelectorAll(".ntf.unread").length, 0, "já lidas na próxima abertura");
  assert.ok(panel()!.textContent!.includes("Anteriores"));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
});

test("lidas são por usuário: outro estudante no mesmo navegador vê as dele como novas", () => {
  identity = { email: "ana@escola.com", school_year: "9º ano" };
  bell.identify();
  assert.equal(bellBtn()!.querySelector(".badge")?.textContent, "3");
  identity = { id: "8812", school_year: "6º ano" };
  bell.identify();
  assert.equal(bellBtn()!.querySelector(".badge"), null);
});

test("header remontado pela SPA: o sino volta ao novo espaço reservado", async () => {
  document.querySelector("header")!.remove();
  const h = document.createElement("header");
  h.innerHTML = `<div id="luumu-bell"></div>`;
  document.body.prepend(h);
  await sleep(400);
  assert.ok(bellBtn(), "remontado no header novo");
});

test("métricas: recebida e vista, uma vez por usuário e recado, sem id nem e-mail", async () => {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  // um envio por usuário: dois estudantes passaram por este navegador
  for (let i = 0; i < 3; i++) {
    document.dispatchEvent(new Event("visibilitychange"));
    await sleep(1100);
  }
  const all = posts.flatMap((p) => p.events.map((e) => `${p.user}|${e.id}|${e.kind}`));
  assert.ok(all.length > 0, "enviou");
  assert.equal(new Set(all).size, all.length, "sem repetição");
  assert.equal(JSON.stringify(posts).includes("8812"), false);
  assert.equal(JSON.stringify(posts).includes("ana@escola.com"), false);
  const kinds = new Set(posts.flatMap((p) => p.events.map((e) => e.kind)));
  assert.ok(kinds.has("delivered") && kinds.has("seen"));
  assert.equal(new Set(posts.map((p) => p.user)).size, 2, "eventos de cada estudante no envio dele");
  const ana = posts.find((p) => p.events.some((e) => e.id === "n3"))!;
  assert.deepEqual(ana.events.map((e) => e.id).sort(), ["n1", "n2", "n3"], "o recado do 9º ano é só da estudante do 9º ano");
  bell.destroy();
});
