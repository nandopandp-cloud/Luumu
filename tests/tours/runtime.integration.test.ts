/*
  Fluxo completo do Tour Runtime contra um DOM simulado: busca o tour, exibe os passos no
  Shadow DOM, navega entre rotas, pula alvo ausente, conclui, respeita frequência e manda os
  eventos de analytics. `fetch` é falso: responde o tour e guarda os lotes de eventos.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom, sleep } from "./support/dom-env";
import { defaultSettings, defaultStep } from "../../lib/tours/defaults";
import type { TourPayload, TourEventInput } from "../../lib/tours/types";

installDom("https://app.cliente.com/dashboard");

const posted: TourEventInput[] = [];
const target = (label: string, extra: Record<string, unknown> = {}) => ({
  tag: "button",
  text: label,
  label,
  fingerprint: "fp-" + label,
  strategy: "text",
  stability: 0.7,
  kind: "button",
  ...extra,
});

const tour: TourPayload = {
  id: "tur_test",
  v: 1,
  versionId: "tvr_1",
  name: "Primeiros passos",
  settings: { ...defaultSettings(), frequency: "until_completed" },
  steps: [
    defaultStep("modal", { key: "stp_welcome", title: "Olá!" }),
    defaultStep("tooltip", { key: "stp_create", title: "Crie aqui", route: "/dashboard", target: target("Criar projeto") as never }),
    defaultStep("tooltip", { key: "stp_ghost", title: "Some", target: target("Não existe") as never, waitTimeoutMs: 500, onMissing: "skip" }),
    defaultStep("popover", { key: "stp_reports", title: "Relatórios", route: "/reports", target: target("Exportar") as never }),
  ],
};

(globalThis as Record<string, unknown>).fetch = async (url: string, init?: { body?: string }) => {
  if (String(url).includes("/tours/events")) {
    posted.push(...(JSON.parse(init!.body!).events as TourEventInput[]));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  if (String(url).includes("/tours/tur_test")) return new Response(JSON.stringify(tour), { status: 200 });
  return new Response("{}", { status: 404 });
};

type Runtime = import("../../sdk/tours/runtime").ToursRuntime;
let rt: Runtime;

const card = () => document.querySelector("[data-luumu-ui=tour]")?.shadowRoot?.querySelector(".lt-card") as HTMLElement | null;
const click = (action: string) => (card()!.querySelector(`[data-lt=${action}]`) as HTMLElement).click();
async function until(fn: () => boolean, ms = 3000) {
  const t = Date.now();
  while (!fn()) {
    if (Date.now() - t > ms) throw new Error("timeout esperando condição");
    await sleep(20);
  }
}

before(async () => {
  document.body.innerHTML = `<nav><a href="/reports">Relatórios</a></nav><main><button>Criar projeto</button></main>`;
  // o "router" do cliente: clicar no link troca a tela sem recarregar (SPA)
  document.querySelector("a")!.addEventListener("click", (e) => {
    e.preventDefault();
    history.pushState({}, "", "/reports");
    document.querySelector("main")!.innerHTML = `<button>Exportar</button>`;
  });
  await import("../../sdk/tours/runtime");
  rt = (window as unknown as { __luumuToursRuntime: Runtime }).__luumuToursRuntime;
  rt.boot({
    api: "https://luumu.test/api/v1",
    key: "pk_test",
    host: "app.cliente.com",
    identity: () => ({ id: "u1", plan: "pro" }),
    track: () => {},
    catalog: [],
  });
});

test("tour completo: modal → alvo → alvo ausente pulado → outra rota → conclusão", async () => {
  rt.start("tur_test");
  await until(() => card()?.textContent?.includes("Olá!") ?? false);
  assert.equal(card()!.getAttribute("role"), "dialog");
  assert.equal(card()!.getAttribute("aria-modal"), "true");

  click("next");
  await until(() => card()?.textContent?.includes("Crie aqui") ?? false);
  assert.deepEqual(rt.getCurrentStep(), { tourId: "tur_test", index: 1, total: 4, key: "stp_create" });
  // nada no DOM do cliente foi alterado: o destaque é uma camada própria
  assert.equal(document.querySelector("main button")!.getAttribute("class"), null);

  click("next"); // próximo alvo não existe → espera 500ms → pula → navega para /reports pelo link da app
  await until(() => card()?.textContent?.includes("Relatórios") ?? false, 4000);
  assert.equal(location.pathname, "/reports");

  click("next"); // último passo → conclui
  await until(() => !rt.isActive());
  assert.ok(!card(), "a camada do tour deve sair da página");
  await sleep(50);

  const types = posted.map((e) => `${e.type}${e.stepKey ? ":" + e.stepKey : ""}`);
  for (const expected of [
    "tour_started",
    "tour_viewed",
    "tour_step_viewed:stp_welcome",
    "tour_step_completed:stp_welcome",
    "tour_step_viewed:stp_create",
    "tour_target_not_found:stp_ghost",
    "tour_step_viewed:stp_reports",
    "tour_completed",
  ]) {
    assert.ok(types.includes(expected), `faltou ${expected} em ${types.join(", ")}`);
  }
  // todos os eventos da execução compartilham a sessão e carregam o usuário identificado
  assert.equal(new Set(posted.map((e) => e.sessionId)).size, 1);
  assert.ok(posted.every((e) => e.userId === "u1" && e.tourId === "tur_test"));
});

test("frequência 'até completar': o navegador lembra que o usuário concluiu", () => {
  const mem = JSON.parse(localStorage.getItem("luumu_tour_tur_test_u1") || "{}");
  assert.ok(mem.completed > 0);
});

test("ESC dispensa o tour e registra tour_dismissed", async () => {
  posted.length = 0;
  rt.start("tur_test");
  await until(() => !!card());
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await until(() => !rt.isActive());
  await sleep(30);
  assert.ok(
    posted.some((e) => e.type === "tour_dismissed" && e.meta?.reason === "escape"),
    posted.map((e) => `${e.type}:${JSON.stringify(e.meta ?? {})}`).join(", ")
  );
});
