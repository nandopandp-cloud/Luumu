/*
  "Esperar a tela ficar livre" no cenário do Preparasp: o tour de carregamento da home não pode
  abrir no instante em que "/" carrega. O site ainda redireciona para a jornada do avatar e, de
  volta à home, abre o vídeo da Liga Genial — sem role=dialog, então só a checagem "o alvo do
  1º passo está livre?" percebe. O tour só começa com a home estável e o alvo à vista.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom, sleep } from "./support/dom-env";
import { defaultSettings, defaultStep } from "@/lib/tours/defaults";
import type { TourPayload } from "@/lib/tours/types";

installDom("https://preparasp.jovensgenios.com/");

const ranking = { tag: "button", text: "Ranking", label: "Ranking", fingerprint: "fp-ranking", strategy: "text", stability: 0.7, kind: "button" };
const trigger = { type: "page_load" as const, route: "/", delaySec: 0, waitReady: true };
const tour: TourPayload = {
  id: "tur_home",
  v: 1,
  versionId: "tvr_1",
  name: "Onboarding",
  settings: { ...defaultSettings(), trigger },
  steps: [
    defaultStep("modal", { key: "stp_hello", title: "Olá!" }),
    defaultStep("spotlight", { key: "stp_ranking", title: "Ranking", route: "/", target: ranking as never }),
  ],
};

(globalThis as Record<string, unknown>).fetch = async (url: string) => {
  if (String(url).includes("/tours/tur_home")) return new Response(JSON.stringify(tour), { status: 200 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

// o vídeo é um <div> fixo comum por cima de tudo: só o "o que está na frente do alvo" o enxerga
let video: HTMLElement | null = null;
(document as unknown as { elementsFromPoint: (x: number, y: number) => Element[] }).elementsFromPoint = () => {
  const btn = document.querySelector("main button");
  return [video, btn, document.body].filter((e): e is Element => !!e && e.isConnected);
};

type Runtime = import("@/sdk/tours/runtime").ToursRuntime;
let rt: Runtime;
const card = () => document.querySelector("[data-luumu-ui=tour]")?.shadowRoot?.querySelector(".lt-card") as HTMLElement | null;

before(async () => {
  document.body.innerHTML = `<main></main>`;
  await import("@/sdk/tours/runtime");
  rt = (window as unknown as { __luumuToursRuntime: Runtime }).__luumuToursRuntime;
  rt.boot({
    api: "https://luumu.test/api/v1",
    key: "pk_test",
    host: "preparasp.jovensgenios.com",
    identity: () => ({ id: "aluno1" }),
    track: () => {},
    catalog: [{ id: "tur_home", v: 1, trigger, frequency: "until_dismissed", audience: tour.settings.audience }],
  });
});

test("redirecionado para o avatar, depois vídeo na home: o tour só abre com a home livre", async () => {
  // primeiro acesso: a home redireciona na hora para a jornada do avatar
  history.pushState({}, "", "/onboarding");
  document.querySelector("main")!.innerHTML = `<h1>Crie seu avatar</h1>`;
  await sleep(2800);
  assert.equal(rt.isActive(), false, "não abre na jornada do avatar");

  // salvou o avatar: volta para a home, e o vídeo da Liga Genial abre por cima
  history.pushState({}, "", "/");
  document.querySelector("main")!.innerHTML = `<button>Ranking</button>`;
  video = document.createElement("div");
  document.body.appendChild(video);
  await sleep(2800);
  assert.equal(rt.isActive(), false, "não abre por cima do vídeo");

  // fechou o vídeo: depois de ~2s de home estável, o tour começa
  video.remove();
  video = null;
  const t = Date.now();
  while (!card()?.textContent?.includes("Olá!")) {
    if (Date.now() - t > 4000) throw new Error("o tour não abriu com a home livre");
    await sleep(50);
  }
  assert.ok(Date.now() - t >= 1500, "espera a tela ficar estável antes de abrir");
  assert.equal(location.pathname, "/");
});
