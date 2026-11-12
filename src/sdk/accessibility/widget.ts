/*
  Plugin de Acessibilidade — widget no produto do cliente (bundle sob demanda: public/sdk-a11y.js).

  O core (sdk/luumu.ts) só baixa este arquivo quando o /config traz `a11y` (plugin ligado no
  painel da Luumu). Tudo vive num Shadow DOM marcado com data-luumu-ui, então o CSS do site
  não deforma o painel e o painel não vaza estilo para o site. Os efeitos na página estão em
  page-effects.ts; Libras e navegação por rosto em módulos próprios.

  Peças:
   - launcher: botões flutuantes (Acessibilidade, Libras, Navegação por rosto);
   - painel: perfis rápidos + recursos agrupados, com "Restaurar padrão" e "Pronto";
   - convite: modal para os estudantes sinalizados pelo cliente (lib/accessibility/audience.ts);
   - avisos: "Máscara de leitura ativada".

  As escolhas do estudante ficam no localStorage, por projeto e por usuário (computador de
  escola é compartilhado). Nada sobre as escolhas vai para o servidor.

  Acessibilidade do próprio widget: botões nativos, role=switch/radio com aria-checked,
  diálogos com aria-modal e foco preso, Esc fecha, e o foco volta para onde estava.
*/
import {
  activeCount,
  COLOR_BLIND_OPTIONS,
  CONTRAST_OPTIONS,
  DEFAULT_PREFS,
  FEATURE_GROUPS,
  FEATURES,
  NUDGE_PROFILE_ORDER,
  normalizePrefs,
  profileAvailable,
  profileInfo,
  SATURATION_OPTIONS,
  TEXT_SIZES,
  toggleProfile,
  type A11yPrefs,
  type FeatureId,
  type PrefKey,
  type ProfileId,
} from "../../lib/accessibility/features";
import { messageHtml, nudgeImageUrl, readableOn, shade, type PublicA11yConfig } from "../../lib/accessibility/config";
import { matchesAnyGroup } from "../../lib/accessibility/audience";
import { scopeDecision } from "../../lib/accessibility/scope";
import { userKeyFrom } from "../../lib/accessibility/invitees";
import { nudgeDue, parseNudgeMemo, type NudgeMemo } from "../../lib/accessibility/nudge";
import { icon } from "./icons";
import { WIDGET_CSS } from "./styles";
import { createPageEffects, type PageEffects } from "./page-effects";
import { createLibras, type Libras } from "./libras";
import { createFaceNav, type FaceNav } from "./face-nav";

export interface A11yBootConfig {
  api: string;
  key: string;
  host: string;
  config: PublicA11yConfig;
  /** traits atuais do identify (com o ano escolar lido da tela, quando houver) */
  identity: () => Record<string, unknown>;
  /** prévia do painel/demonstração: não grava no navegador e pode forçar o convite */
  preview?: { nudge?: boolean };
  /** o servidor respondeu que o plugin está desligado: o core tira o widget e o catálogo guardado */
  onDisabled?: () => void;
}

export type A11yView = "panel" | "nudge" | "libras" | "face";

export interface A11yWidget {
  boot(c: A11yBootConfig): void;
  update(config: PublicA11yConfig): void;
  open(view?: A11yView): void;
  close(): void;
  /** o produto chamou Luumu.identify/reset: reavalia estudante, escolhas, escopo e convite */
  identify(): void;
  destroy(): void;
}

const UI_ATTR = "data-luumu-ui";
const MATCH_TTL_MS = 12 * 60 * 60 * 1000;
const SIMPLE_CONTENT_TYPE = "text/plain;charset=UTF-8";
const SELECT_FEATURES: Partial<Record<FeatureId, { key: PrefKey; options: { value: string; label: string }[] }>> = {
  contrast: { key: "contrast", options: CONTRAST_OPTIONS },
  saturation: { key: "saturation", options: SATURATION_OPTIONS },
  colorBlind: { key: "colorBlind", options: COLOR_BLIND_OPTIONS },
};
const FEMININE: Partial<Record<FeatureId, true>> = { readingMask: true, legibleFont: true, saturation: true, focusRing: true, faceNav: true, libras: true };
const VERBAL: Partial<Record<FeatureId, [string, string]>> = {
  highlightLinks: ["Links destacados", "Links sem destaque"],
  highlightHeadings: ["Títulos destacados", "Títulos sem destaque"],
  stopAnimations: ["Animações pausadas", "Animações liberadas"],
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function toastText(id: FeatureId, on: boolean): string {
  const v = VERBAL[id];
  if (v) return on ? v[0] : v[1];
  const label = FEATURES.find((f) => f.id === id)!.label;
  return `${label} ${on ? "ativad" : "desativad"}${FEMININE[id] ? "a" : "o"}`;
}

function createWidget(): A11yWidget {
  let boot: A11yBootConfig | null = null;
  let cfg: PublicA11yConfig;
  let hostEl: HTMLElement | null = null;
  let rootEl: HTMLElement;
  let launcher: HTMLElement;
  let scrim: HTMLElement;
  let panel: HTMLElement;
  let toastEl: HTMLElement;
  let nudgeEl: HTMLElement | null = null;
  let effects: PageEffects;
  let libras: Libras;
  let face: FaceNav;
  let prefs: A11yPrefs = { ...DEFAULT_PREFS };
  // quando o estudante mudou as escolhas pela última vez (decide quem vence na sincronização)
  let prefsAt = 0;
  let owner = "anon";
  // o plugin vale para este estudante? (escopo de ativação; null = ainda decidindo)
  let inScope: boolean | null = null;
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  // desfecho do convite (visto/aceito/dispensado): guardado no aparelho E na conta do estudante
  let nudgeMemo: NudgeMemo | null = null;
  // leitura da conta em andamento: o convite espera por ela antes de decidir se aparece
  let pulling: Promise<void> = Promise.resolve();
  let remoteBlocked = false;
  let panelOpen = false;
  let releasePanelTrap: (() => void) | null = null;
  let releaseNudgeTrap: (() => void) | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let darkQuery: MediaQueryList | null = null;
  const memory: Record<string, string> = {};
  const timers: ReturnType<typeof setTimeout>[] = [];

  /* ---------------- armazenamento ---------------- */
  const preview = () => !!boot?.preview;
  function get(k: string): string | null {
    if (preview()) return memory[k] ?? null;
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  }
  function set(k: string, v: string) {
    if (preview()) {
      memory[k] = v;
      return;
    }
    try {
      localStorage.setItem(k, v);
    } catch {}
  }
  function sessionFlag(k: string, v?: string): string | null {
    if (preview()) {
      if (v !== undefined) memory[`s:${k}`] = v;
      return memory[`s:${k}`] ?? null;
    }
    try {
      if (v !== undefined) sessionStorage.setItem(k, v);
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  }
  const json = (raw: string | null): unknown => {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  // chave do estudante: ID do identify (ou e-mail); "anon" = não identificado
  const currentOwner = (): string => userKeyFrom(boot?.identity() ?? {}) || "anon";
  const prefsKey = () => `luumu_a11y_${boot!.key}:${owner}`;
  const nudgeKey = () => `luumu_a11y_nudge_${boot!.key}:${owner}`;

  /* ---------------- servidor (dados de UM estudante: o logado) ---------------- */
  /** Identificação que vai nas rotas do plugin: id, e-mail e a assinatura (user_hash), se houver. */
  function who() {
    const i = boot!.identity();
    const id = typeof i.id === "string" || typeof i.id === "number" ? i.id : null;
    const email = typeof i.email === "string" ? i.email : null;
    const h = typeof i.user_hash === "string" ? i.user_hash : typeof i.userHash === "string" ? i.userHash : null;
    return { key: boot!.key, id, email, h };
  }
  async function post(path: string, body: object, keepalive = false): Promise<Record<string, unknown> | null> {
    if (preview() || remoteBlocked) return null;
    try {
      const r = await fetch(`${boot!.api}/accessibility/${path}`, {
        method: "POST",
        headers: { "Content-Type": SIMPLE_CONTENT_TYPE },
        body: JSON.stringify({ ...who(), ...body }),
        keepalive,
      });
      // projeto exige verificação e o produto não mandou o user_hash: para de tentar nesta página
      if (r.status === 403) remoteBlocked = true;
      // plugin desligado no painel enquanto o catálogo guardado ainda dizia "ligado"
      if (r.status === 404) {
        remoteBlocked = true;
        const off = boot!.onDisabled;
        setTimeout(() => off?.(), 0);
      }
      return r.ok ? ((await r.json()) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  /* ---------------- preferências: aparelho + conta do estudante ---------------- */
  /*
    As escolhas valem para o estudante em qualquer aparelho: ficam no servidor, pelo ID. O
    localStorage é só o cache que deixa a página certa já no primeiro desenho. A sincronização
    com o servidor acontece uma vez por sessão do navegador (custa uma request por visita, não
    por página) e a cada mudança; a escolha mais recente vence.
  */
  function loadPrefs() {
    owner = currentOwner();
    const raw = json(get(prefsKey())) as { p?: unknown; t?: unknown } | null;
    // formato antigo (só as preferências) ainda é aceito
    const wrapped = raw && typeof raw === "object" && "p" in raw;
    prefs = normalizePrefs(wrapped ? raw!.p : raw);
    prefsAt = wrapped && typeof raw!.t === "number" ? raw!.t : 0;
    nudgeMemo = parseNudgeMemo(json(get(nudgeKey())));
    pulling = pullPrefs();
  }
  function storeLocal() {
    set(prefsKey(), JSON.stringify({ p: prefs, t: prefsAt }));
  }
  /** Envia preferências + desfecho do convite para a conta (keepalive: sobrevive ao fechar a aba). */
  function pushNow() {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = null;
    if (owner === "anon") return;
    void post("prefs", { op: "set", prefs, t: prefsAt, nudge: nudgeMemo }, true);
  }
  // junta cliques seguidos numa gravação só; ao sair da página, envia o que estiver pendente
  function schedulePush() {
    if (owner === "anon" || preview()) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, 800);
  }
  const flushPending = () => {
    if (pushTimer) pushNow();
  };
  const onHidden = () => {
    if (document.visibilityState === "hidden") flushPending();
  };
  function savePrefs() {
    prefsAt = Date.now();
    storeLocal();
    schedulePush();
  }
  async function pullPrefs() {
    if (owner === "anon" || preview()) return;
    const flag = `luumu_a11y_synced_${boot!.key}:${owner}`;
    if (sessionFlag(flag) === "1") return;
    const who0 = owner;
    const r = await post("prefs", { op: "get" });
    if (!r || who0 !== owner) return;
    sessionFlag(flag, "1");
    const remoteAt = typeof r.t === "number" ? r.t : 0;
    const remoteMemo = parseNudgeMemo(r.nudge);
    let push = false;
    if (r.prefs && remoteAt > prefsAt) {
      // outro aparelho (ou antes de limpar o navegador) mudou depois: a conta vence
      prefs = normalizePrefs(r.prefs);
      prefsAt = remoteAt;
      storeLocal();
      applyAll();
    } else if (prefsAt > remoteAt) push = true; // escolhas feitas aqui antes do login: sobem
    // o convite segue a mesma regra: o desfecho mais recente vale
    if (remoteMemo && (!nudgeMemo || remoteMemo.at > nudgeMemo.at)) {
      nudgeMemo = remoteMemo;
      set(nudgeKey(), JSON.stringify(nudgeMemo));
    } else if (nudgeMemo && (!remoteMemo || nudgeMemo.at > remoteMemo.at)) push = true;
    if (push) pushNow();
  }

  /** identify chegou depois do boot (ou trocou o usuário): carrega as escolhas e o escopo dele */
  function syncOwner() {
    if (currentOwner() === owner) return;
    loadPrefs();
    applyAll();
    void decideScope();
  }

  /* ---------------- lista de convidados (servidor) ---------------- */
  // st: desfecho do convite que o servidor já registrou para este convidado
  type MatchMemo = { m: boolean; p: string | null; st: string | null; at: number };
  async function inviteeMatch(): Promise<MatchMemo | null> {
    if (!cfg.nudge.hasList || owner === "anon" || preview()) return null;
    const cacheKey = `luumu_a11y_match_${boot!.key}:${owner}`;
    const cached = json(get(cacheKey)) as MatchMemo | null;
    if (cached && typeof cached.at === "number" && Date.now() - cached.at < MATCH_TTL_MS) return cached;
    const r = await post("match", {});
    if (!r) return null;
    const memo: MatchMemo = { m: !!r.match, p: typeof r.profile === "string" ? r.profile : null, st: typeof r.status === "string" ? r.status : null, at: Date.now() };
    set(cacheKey, JSON.stringify(memo));
    return memo;
  }

  /* ---------------- escopo de ativação ---------------- */
  async function decideScope() {
    if (preview()) return setScope(true);
    const d = scopeDecision(cfg.scope, boot!.identity(), cfg.nudge.hasList);
    if (d !== "ask") return setScope(d === "yes");
    const m = await inviteeMatch();
    setScope(!!m?.m);
  }
  function setScope(v: boolean) {
    if (inScope === v) return;
    inScope = v;
    if (hostEl) hostEl.hidden = !v;
    if (!v) {
      closePanel();
      closeNudge();
      if (face.active) face.stop();
    }
    applyAll();
  }

  /* ---------------- estado efetivo ---------------- */
  const enabled = (f: FeatureId) => cfg.features[f] !== false;
  function effective(p: A11yPrefs): A11yPrefs {
    const out = { ...p };
    for (const f of FEATURES) {
      if (enabled(f.id) || f.id === "faceNav") continue;
      (out as unknown as Record<string, unknown>)[f.id] = DEFAULT_PREFS[f.id as PrefKey];
    }
    return out;
  }
  const side = (): "left" | "right" => (cfg.launcher.position.endsWith("left") ? "left" : "right");

  function speak(text: string) {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") return toast("Este navegador não tem leitor de voz.");
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 2000));
    u.lang = "pt-BR";
    const voice = synth.getVoices().find((v) => /^pt(-|_)BR/i.test(v.lang)) || synth.getVoices().find((v) => /^pt/i.test(v.lang));
    if (voice) u.voice = voice;
    synth.speak(u);
  }

  function applyAll() {
    // fora do escopo de ativação o plugin não existe para este estudante: página intacta
    const eff = inScope ? effective(prefs) : { ...DEFAULT_PREFS };
    effects.apply(eff);
    // Libras: com o VLibras aberto, ele mesmo escuta os cliques nos textos
    effects.setPicker(eff.textReader ? (text) => speak(text) : null);
    effects.setFocusReader(eff.textReader ? (t) => speak(t) : null);
    if (!eff.textReader) window.speechSynthesis?.cancel();
    if (eff.libras && !libras.visible) libras.show();
    if (!eff.libras && libras.visible) libras.hide();
    rootEl.classList.toggle("legible", eff.legibleFont);
    renderLauncher();
    if (panelOpen) renderPanel(true);
  }

  /* ---------------- tema ---------------- */
  function applyTheme() {
    const acc = cfg.brand.accent;
    const dark = cfg.brand.theme === "dark" || (cfg.brand.theme === "auto" && !!darkQuery?.matches);
    rootEl.classList.toggle("dark", dark);
    rootEl.style.setProperty("--acc", acc);
    rootEl.style.setProperty("--acc-ink", readableOn(acc));
    rootEl.style.setProperty("--acc-soft", dark ? shade(acc, -0.72) : shade(acc, 0.9));
    rootEl.style.setProperty("--acc-line", dark ? shade(acc, -0.4) : shade(acc, 0.65));
    // painel: cabeçalho escuro, blocos de ícone e seção Leitura derivados da cor de destaque
    rootEl.style.setProperty("--head-bg", shade(acc, -0.58));
    rootEl.style.setProperty("--head-bg2", shade(acc, -0.4));
    rootEl.style.setProperty("--acc-tile", dark ? shade(acc, -0.62) : shade(acc, 0.88));
    rootEl.style.setProperty("--sec-lav", dark ? shade(acc, -0.8) : shade(acc, 0.93));
    // convite: fundo levemente tingido pela cor de destaque e tinta navy (layout de referência)
    rootEl.style.setProperty("--n-bg", dark ? "var(--bg)" : shade(acc, 0.975));
    rootEl.style.setProperty("--n-ink", dark ? "#F1F5F9" : "#0E0D35");
    rootEl.style.setProperty("--n-ink2", dark ? "#CBD5E1" : "#22213F");
  }

  /* ---------------- aviso ---------------- */
  function toast(msg: string) {
    toastEl.innerHTML = `${icon("info", 20)}<span>${esc(msg)}</span>`;
    toastEl.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  /* ---------------- foco preso nos diálogos ---------------- */
  /** `focusSelf`: o foco inicial vai para o próprio diálogo (o leitor de tela anuncia o título) */
  function trapFocus(container: HTMLElement, focusSelf = false): () => void {
    const before = (hostEl?.shadowRoot?.activeElement as HTMLElement | null) ?? (document.activeElement as HTMLElement | null);
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>("button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex='-1'])")).filter(
        (el) => !el.hidden && el.offsetParent !== null
      );
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusables();
      if (!list.length) return;
      const active = hostEl!.shadowRoot!.activeElement as HTMLElement | null;
      const i = active ? list.indexOf(active) : -1;
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        list[list.length - 1].focus();
      } else if (!e.shiftKey && i === list.length - 1) {
        e.preventDefault();
        list[0].focus();
      }
    };
    container.addEventListener("keydown", onKey);
    setTimeout(() => (focusSelf ? container : focusables()[0] ?? container).focus?.(), 30);
    return () => {
      container.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }

  /* ---------------- launcher ---------------- */
  /** Cores da cápsula: as quatro escolhidas no painel viram gradientes, anel, brilho e contraste. */
  function launcherVars(): string {
    const c = cfg.launcher.colors;
    const main = c.main || cfg.brand.accent;
    const darkSurface = readableOn(c.surface) === "#FFFFFF";
    const vars: Record<string, string> = {
      "--lb-main": main,
      "--lb-main-hi": shade(main, 0.22),
      "--lb-main-lo": shade(main, -0.22),
      "--lb-main-ring": shade(main, 0.42),
      "--lb-main-glow": `${main}8C`,
      "--lb-main-ink": readableOn(main),
      "--lb-surface": `${c.surface}F0`,
      "--lb-surface-solid": c.surface,
      "--lb-surface-ink": readableOn(c.surface),
      "--lb-btn-hi": shade(c.button, darkSurface ? 0.1 : 0.4),
      "--lb-btn-lo": shade(c.button, darkSurface ? -0.18 : -0.05),
      "--lb-icon": c.icon,
      "--lb-line": darkSurface ? "rgba(255,255,255,.09)" : "rgba(15,23,42,.09)",
      "--lb-shade": darkSurface ? "rgba(6,8,18,.45)" : "rgba(15,23,42,.16)",
    };
    return Object.entries(vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
  }

  function renderLauncher() {
    const pos = cfg.launcher.position;
    const left = pos.endsWith("left");
    const middle = pos.startsWith("middle");
    launcher.className = `launcher${left ? " left" : ""}${middle ? " mid" : ""}${cfg.launcher.showLabels ? " labels" : ""}`;
    launcher.setAttribute("style", launcherVars());
    launcher.style.left = left ? "20px" : "auto";
    launcher.style.right = left ? "auto" : "20px";
    // no meio da tela o botão principal fica parado e a cápsula cresce para baixo
    launcher.style.top = middle ? "calc(50% - 40px)" : "auto";
    launcher.style.bottom = middle ? "auto" : `${cfg.launcher.offset}px`;
    const eff = effective(prefs);
    const count = activeCount(eff);
    /*
      Cápsula de atalhos: só o botão de acessibilidade fica à vista; Libras e navegação por rosto
      aparecem quando a cápsula cresce (mouse em cima ou foco pelo teclado — Tab no botão
      principal já revela os atalhos). Em telas de toque (sem hover) eles ficam no painel.
    */
    const extra = (a: string, label: string, ico: string, on: boolean) =>
      `<button type="button" class="lb lb-x${on ? " on" : ""}" data-a="${a}" aria-pressed="${on}" aria-label="${label}">
        ${icon(ico, 28, 2.1)}<span class="lb-label" aria-hidden="true">${label}</span>${on ? `<span class="lb-badge" aria-hidden="true">${icon("check", 12, 3.4)}</span>` : ""}</button>`;
    const extras: string[] = [];
    if (enabled("libras") && cfg.launcher.librasShortcut) extras.push(extra("libras", "Libras", "hands", eff.libras));
    if (enabled("faceNav") && cfg.launcher.faceShortcut) extras.push(extra("face", "Navegação por rosto", "face", face.active));
    launcher.innerHTML = `<div class="lb-pill">
      ${extras.length ? `<div class="lb-more"><div class="lb-more-in">${extras.join("")}</div></div>` : ""}
      <button type="button" class="lb lb-main${panelOpen ? " on" : ""}" data-a="open" aria-haspopup="dialog" aria-expanded="${panelOpen}" aria-label="${esc(cfg.launcher.label)}${count ? `, ${count} ${count === 1 ? "ajuste ativo" : "ajustes ativos"}` : ""}">
        ${icon("access", 32, 2.6)}<span class="lb-label" aria-hidden="true">${esc(cfg.launcher.label)}</span>${count ? `<span class="lb-badge" aria-hidden="true">${count}</span>` : ""}</button>
    </div>`;
  }

  /* ---------------- painel ---------------- */
  // cartões do convite usam os ícones do layout de referência do convite
  const NUDGE_ICON: Partial<Record<ProfileId, string>> = { foco: "bolt", leitura: "eye", ritmo: "sliders", visao: "zoom", calma: "moon", cores: "palette", ouvir: "speaker", libras: "hands" };

  // Contraste, saturação e daltonismo: a chave liga a variação mais comum; as outras aparecem abaixo
  const SELECT_ON: Partial<Record<FeatureId, string>> = { contrast: "high", saturation: "low", colorBlind: "deutan" };

  function rowFor(id: FeatureId, eff: A11yPrefs): string {
    const f = FEATURES.find((x) => x.id === id)!;
    const lab = `lb-${id}`;
    const head = (desc: string, live = false) =>
      `<span class="tile" aria-hidden="true">${icon(f.icon, 24, 2)}</span><span class="row-div" aria-hidden="true"></span>
        <div class="txt"><b id="${lab}">${esc(f.label)}</b><span${live ? ' aria-live="polite"' : ""}>${esc(desc)}</span></div>`;
    if (id === "textSize") {
      const i = eff.textSize;
      return `<div class="row${i > 0 ? " on" : ""}">${head(`${f.description} · ${TEXT_SIZES[i]}%`, true)}
        <div class="stepper" role="group" aria-labelledby="${lab}">
          <button type="button" data-a="size" data-d="-1" data-k="size-" aria-label="Diminuir texto"${i === 0 ? " disabled" : ""}>A−</button>
          <button type="button" data-a="size" data-d="1" data-k="size+" aria-label="Aumentar texto"${i === TEXT_SIZES.length - 1 ? " disabled" : ""}>A+</button>
        </div></div>`;
    }
    const select = SELECT_FEATURES[id];
    if (select) {
      const v = eff[select.key] as string;
      const on = v !== "off";
      return `<div class="row${on ? " on" : ""}" data-row="${id}">${head(f.description)}
        <button type="button" class="sw" role="switch" aria-checked="${on}" aria-labelledby="${lab}" data-a="toggle" data-id="${id}" data-k="sw:${id}"></button>
        ${on ? `<div class="chips" role="radiogroup" aria-label="${esc(f.label)}: variação">${select.options
          .filter((o) => o.value !== "off")
          .map(
            (o) =>
              `<button type="button" class="chip" role="radio" aria-checked="${o.value === v}" data-a="choose" data-id="${id}" data-v="${o.value}" data-k="${id}:${o.value}">${esc(o.label)}</button>`
          )
          .join("")}</div>` : ""}</div>`;
    }
    const on = id === "faceNav" ? face.active : !!eff[id as PrefKey];
    return `<div class="row${on ? " on" : ""}" data-row="${id}">${head(f.description)}
      <button type="button" class="sw" role="switch" aria-checked="${on}" aria-labelledby="${lab}" data-a="toggle" data-id="${id}" data-k="sw:${id}"></button></div>`;
  }

  function renderPanel(keepFocus = false) {
    const shadow = hostEl!.shadowRoot!;
    const focusKey = keepFocus ? ((shadow.activeElement as HTMLElement | null)?.dataset?.k ?? null) : null;
    const body = panel.querySelector(".p-body") as HTMLElement | null;
    const scroll = body?.scrollTop ?? 0;
    const eff = effective(prefs);
    const logo = cfg.brand.logoUrl;
    const profiles = cfg.profiles.filter((p) => profileAvailable(p, cfg.features));
    const profileSec = profiles.length
      ? `<section class="sec sec-perfis" aria-labelledby="lu-sec-perfis"><h3 class="sec-t" id="lu-sec-perfis"><span class="sec-i" aria-hidden="true">${icon("access", 22, 2.2)}</span>Perfis de acessibilidade</h3>
        <p class="sec-sub">Ligue vários recursos de uma vez. Dá para combinar perfis.</p>
        <div class="profiles">${profiles
          .map((id) => {
            const p = profileInfo(id);
            const on = prefs.profiles.includes(id);
            return `<button type="button" class="prof" aria-pressed="${on}" data-a="profile" data-id="${id}" data-k="pf:${id}"><span class="ck" aria-hidden="true">${icon("check", 12, 3.4)}</span><span class="pi" aria-hidden="true">${icon(p.icon, 24, 2)}</span><b>${esc(p.label)}</b><span class="pd">${esc(p.description)}</span></button>`;
          })
          .join("")}</div></section>`
      : "";
    const groups = FEATURE_GROUPS.map((g) => {
      const rows = FEATURES.filter((f) => f.group === g.id && enabled(f.id)).map((f) => rowFor(f.id, eff));
      return rows.length
        ? `<section class="sec sec-${g.id}" aria-labelledby="lu-sec-${g.id}"><h3 class="sec-t" id="lu-sec-${g.id}"><span class="sec-i" aria-hidden="true">${icon(g.icon, 22, 2)}</span>${esc(g.label)}</h3>${rows.join("")}</section>`
        : "";
    }).join("");
    panel.className = `panel${side() === "left" ? " left" : ""}${panelOpen ? " open" : ""}`;
    panel.innerHTML = `
<header class="p-head">
  <svg class="p-wave" viewBox="0 0 240 140" preserveAspectRatio="none" aria-hidden="true"><path d="M70 140C112 112 132 52 240 30V140Z" fill="currentColor" opacity=".55"/><path d="M118 140C150 118 175 84 240 74V140Z" fill="currentColor"/></svg>
  <span class="p-logo">${logo ? `<img src="${esc(logo)}" alt="">` : icon("access", 34, 2.4)}</span>
  <div class="p-hd"><h2 class="p-title" id="lu-a11y-title">${esc(cfg.brand.title)}</h2>${cfg.brand.subtitle ? `<p class="p-sub">${esc(cfg.brand.subtitle)}</p>` : ""}</div>
  <button type="button" class="x" data-a="close" data-k="close" aria-label="Fechar">${icon("close", 22, 2.4)}</button>
</header>
<div class="p-body">
  ${profileSec}
  ${groups || `<p class="empty">Nenhum recurso disponível.</p>`}
</div>
<footer class="p-foot">
  <button type="button" class="btn ghost" data-a="reset" data-k="reset">${icon("reset", 20, 2.2)}<span>Restaurar padrão</span></button>
  <button type="button" class="btn primary" data-a="close" data-k="done">${icon("checkCircle", 20, 2.2)}<span>Pronto</span></button>
</footer>
<div class="powered">Acessibilidade por Luumu</div>`;
    const nb = panel.querySelector(".p-body") as HTMLElement;
    nb.scrollTop = scroll;
    if (focusKey) (panel.querySelector(`[data-k="${focusKey}"]`) as HTMLElement | null)?.focus();
  }

  function openPanel() {
    if (panelOpen) return;
    syncOwner();
    panelOpen = true;
    renderPanel();
    scrim.classList.add("open");
    requestAnimationFrame(() => panel.classList.add("open"));
    releasePanelTrap = trapFocus(panel, true);
    renderLauncher();
  }
  function closePanel() {
    if (!panelOpen) return;
    panelOpen = false;
    panel.classList.remove("open");
    scrim.classList.remove("open");
    releasePanelTrap?.();
    releasePanelTrap = null;
    renderLauncher();
  }

  function setPrefs(next: A11yPrefs) {
    prefs = next;
    savePrefs();
    applyAll();
  }

  function onAction(e: Event) {
    const t = e.target as HTMLElement;
    if (t === scrim) return closePanel();
    const btn = t.closest("[data-a]") as HTMLElement | null;
    const row = t.closest("[data-row]") as HTMLElement | null;
    // clicar no texto da linha também liga/desliga (a chave continua sendo o controle)
    const a = btn?.dataset.a ?? (row ? "toggle" : null);
    const id = (btn?.dataset.id ?? row?.dataset.row) as FeatureId | ProfileId | undefined;
    if (!a) return;
    switch (a) {
      case "open":
        return panelOpen ? closePanel() : openPanel();
      case "close":
        return closePanel();
      case "libras": {
        const on = !effective(prefs).libras;
        setPrefs({ ...prefs, libras: on });
        return toast(toastText("libras", on));
      }
      case "face":
        return face.active ? face.stop() : face.openIntro();
      case "size": {
        const d = Number(btn!.dataset.d);
        const size = Math.min(TEXT_SIZES.length - 1, Math.max(0, prefs.textSize + d));
        if (size !== prefs.textSize) setPrefs({ ...prefs, textSize: size });
        return;
      }
      case "choose": {
        const sel = SELECT_FEATURES[id as FeatureId]!;
        const v = btn!.dataset.v!;
        setPrefs({ ...prefs, [sel.key]: v } as A11yPrefs);
        const label = sel.options.find((o) => o.value === v)!.label;
        return toast(`${FEATURES.find((f) => f.id === id)!.label}: ${label}`);
      }
      case "toggle": {
        const fid = id as FeatureId;
        if (fid === "faceNav") {
          if (face.active) face.stop();
          else {
            closePanel();
            face.openIntro();
          }
          return;
        }
        const sel = SELECT_FEATURES[fid];
        if (sel) {
          const on = effective(prefs)[sel.key] === "off";
          setPrefs({ ...prefs, [sel.key]: on ? SELECT_ON[fid] : "off" } as A11yPrefs);
          return toast(toastText(fid, on));
        }
        const on = !effective(prefs)[fid as PrefKey];
        setPrefs({ ...prefs, [fid]: on } as A11yPrefs);
        return toast(toastText(fid, on));
      }
      case "profile": {
        const pid = id as ProfileId;
        const was = prefs.profiles.includes(pid);
        setPrefs(toggleProfile(prefs, pid, cfg.features));
        return toast(`${profileInfo(pid).label}: ${was ? "desativado" : "ativado"}`);
      }
      case "reset":
        if (face.active) face.stop();
        setPrefs({ ...DEFAULT_PREFS });
        return toast("Configurações restauradas");
    }
  }

  /* ---------------- convite ---------------- */
  function closeNudge() {
    releaseNudgeTrap?.();
    releaseNudgeTrap = null;
    nudgeEl?.remove();
    nudgeEl = null;
  }

  // perfil sugerido só para este estudante (lista de convidados), quando houver
  let inviteeProfile: ProfileId | null = null;
  let invited = false;

  function remember(s: NudgeMemo["s"]) {
    nudgeMemo = { s, at: Date.now() };
    set(nudgeKey(), JSON.stringify(nudgeMemo));
    // na conta do estudante: aceitar vale em qualquer aparelho e depois de limpar o navegador
    schedulePush();
    // o painel da Luumu mostra quem viu, aceitou ou dispensou (só para convidados da lista)
    if (invited) void post("match", { event: s }, true);
  }

  /** Caminho relativo (ex.: a ilustração padrão) é da Luumu, não do site do cliente. */
  function asset(url: string): string {
    if (!url.startsWith("/")) return url;
    try {
      return new URL(url, boot!.api).href;
    } catch {
      return url;
    }
  }

  function showNudge() {
    if (nudgeEl) return;
    const n = cfg.nudge;
    const pid = inviteeProfile ?? n.profile;
    const suggested = pid && profileAvailable(pid, cfg.features) ? pid : null;
    // até três perfis no convite (os primeiros do painel); o sugerido entra e já vem marcado
    const available = NUDGE_PROFILE_ORDER.filter((p) => cfg.profiles.includes(p) && profileAvailable(p, cfg.features));
    const cards = (suggested ? [suggested, ...available.filter((p) => p !== suggested)] : available).slice(0, 3);
    const picked = new Set<ProfileId>(suggested ? [suggested] : []);
    const img = nudgeImageUrl(n);
    nudgeEl = document.createElement("div");
    nudgeEl.className = "mwrap";
    nudgeEl.innerHTML = `
<div class="nudge${img ? "" : " no-art"}" role="dialog" aria-modal="true" aria-labelledby="lu-n-t" aria-describedby="lu-n-d" tabindex="-1">
  <button type="button" class="n-x" data-n="dismiss" aria-label="Fechar">${icon("close", 26, 2.4)}</button>
  ${img ? `<div class="n-art"><img src="${esc(asset(img))}" alt="" decoding="async"></div>` : ""}
  <div class="n-body">
    <h2 class="n-title" id="lu-n-t">${esc(n.title)}</h2>
    <span class="n-bar" aria-hidden="true"></span>
    <p class="n-text" id="lu-n-d">${messageHtml(n.message)}</p>
    ${cards.length ? `<div class="n-cards" role="group" aria-label="Escolha o que ativar">${cards
      .map((id) => {
        const p = profileInfo(id);
        return `<button type="button" class="n-card" data-n="pick" data-id="${id}" aria-pressed="${picked.has(id)}" title="${esc(p.description)}"><span class="n-ck">${icon("check", 12, 3.4)}</span>${icon(NUDGE_ICON[id] ?? p.icon, 30, 2.2)}<b>${esc(p.nudgeLabel)}</b></button>`;
      })
      .join("")}</div>` : ""}
  </div>
  <div class="n-actions">
    <button type="button" class="n-btn ghost" data-n="dismiss">${esc(n.dismiss)}</button>
    <button type="button" class="n-btn primary" data-n="accept">${esc(n.cta)}</button>
  </div>
</div>`;
    nudgeEl.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const btn = t.closest("[data-n]") as HTMLElement | null;
      const a = t === nudgeEl ? "dismiss" : btn?.dataset.n;
      if (a === "pick" && btn) {
        const id = btn.dataset.id as ProfileId;
        if (picked.has(id)) picked.delete(id);
        else picked.add(id);
        btn.setAttribute("aria-pressed", String(picked.has(id)));
        return;
      }
      if (a === "dismiss") {
        remember("dismissed");
        closeNudge();
        toast(`Quando quiser, é só abrir o botão ${cfg.launcher.label}`);
      }
      if (a === "accept") {
        remember("accepted");
        closeNudge();
        // nada marcado: abre o painel para o estudante escolher
        if (!picked.size) return openPanel();
        let next = prefs;
        for (const id of picked) if (!next.profiles.includes(id)) next = toggleProfile(next, id, cfg.features);
        setPrefs(next);
        const names = [...picked].map((id) => profileInfo(id).nudgeLabel);
        toast(`${names.length === 1 ? names[0] : `${names.length} perfis`}: ativado${names.length === 1 ? "" : "s"}. Ajuste quando quiser no botão ${cfg.launcher.label}.`);
      }
    });
    nudgeEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        remember("dismissed");
        closeNudge();
      }
    });
    rootEl.appendChild(nudgeEl);
    releaseNudgeTrap = trapFocus(nudgeEl.querySelector(".nudge") as HTMLElement, true);
    remember("shown");
    sessionFlag("luumu_a11y_nudged", "1");
  }

  let inviteeStatus: string | null = null;
  async function inAudience(): Promise<boolean> {
    const n = cfg.nudge;
    const m = await inviteeMatch();
    invited = !!m?.m;
    inviteeStatus = m?.m ? m.st : null;
    inviteeProfile = m?.m && m.p && profileAvailable(m.p as ProfileId, cfg.features) ? (m.p as ProfileId) : null;
    if (n.audience === "all" || invited) return true;
    return matchesAnyGroup(n.groups, boot!.identity());
  }

  async function maybeNudge(retry = true) {
    const n = cfg.nudge;
    if (!n.enabled || nudgeEl) return;
    syncOwner();
    if (inScope === null) await decideScope();
    if (!inScope) return;
    // espera a conta: quem já aceitou (ou já tem recursos ligados) em outro aparelho não vê de novo
    await pulling;
    if (nudgeEl) return;
    const memo = nudgeMemo;
    const due = nudgeDue(n.frequency, memo, {
      now: Date.now(),
      shownThisSession: sessionFlag("luumu_a11y_nudged") === "1",
      activeAdjustments: activeCount(effective(prefs)),
    });
    if (!due) return;
    // o produto pode chamar o identify alguns segundos depois do carregamento
    const t = boot!.identity();
    if (n.audience === "targeted" && !t.id && !t.email && retry) {
      timers.push(setTimeout(() => void maybeNudge(false), 6000));
      return;
    }
    if (!(await inAudience())) return;
    // convidado que já aceitou: o painel da Luumu registrou, mesmo sem nada guardado aqui
    if (inviteeStatus === "accepted") return;
    showNudge();
  }

  /* ---------------- ciclo de vida ---------------- */
  function mount() {
    hostEl = document.createElement("div");
    hostEl.setAttribute(UI_ATTR, "a11y");
    const shadow = hostEl.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${WIDGET_CSS}</style>`;
    rootEl = document.createElement("div");
    rootEl.className = "root";
    shadow.appendChild(rootEl);
    launcher = document.createElement("div");
    launcher.setAttribute("role", "region");
    launcher.setAttribute("aria-label", "Recursos de acessibilidade");
    scrim = document.createElement("div");
    scrim.className = "scrim";
    panel = document.createElement("aside");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "lu-a11y-title");
    panel.tabIndex = -1;
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePanel();
    });
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    rootEl.append(launcher, scrim, panel, toastEl);
    rootEl.addEventListener("click", onAction);
    (document.body || document.documentElement).appendChild(hostEl);

    effects = createPageEffects(rootEl, cfg.brand.accent);
    libras = createLibras(cfg, side(), {
      // o estudante fechou pelo próprio VLibras
      onClosed: () => setPrefs({ ...prefs, libras: false }),
      onUnavailable: () => {
        setPrefs({ ...prefs, libras: false });
        toast("Não foi possível abrir o tradutor de Libras agora.");
      },
    });
    face = createFaceNav(rootEl, {
      side: side(),
      toast,
      trapFocus,
      onChange: () => {
        renderLauncher();
        if (panelOpen) renderPanel(true);
      },
    });
    window.addEventListener("pagehide", flushPending);
    document.addEventListener("visibilitychange", onHidden);
    try {
      darkQuery = matchMedia("(prefers-color-scheme: dark)");
      darkQuery.addEventListener?.("change", applyTheme);
    } catch {}
  }

  return {
    boot(c) {
      if (boot) return this.update(c.config);
      boot = c;
      cfg = c.config;
      mount();
      applyTheme();
      loadPrefs();
      // nada aparece nem muda na página antes de saber se o plugin vale para este estudante
      hostEl!.hidden = true;
      applyAll();
      void decideScope();
      timers.push(setTimeout(syncOwner, 1500));
      // o identify pode chegar segundos depois: escopo por grupo/lista é decidido de novo
      timers.push(setTimeout(() => (inScope ? undefined : void decideScope()), 6000));
      const delay = Math.max(0, cfg.nudge.delay) * 1000;
      // prévia: o convite só aparece quando pedido (nunca consulta a API com a key de prévia)
      if (c.preview) {
        if (c.preview.nudge) timers.push(setTimeout(showNudge, Math.max(400, delay)));
      } else timers.push(setTimeout(() => void maybeNudge(), delay));
    },
    update(config) {
      if (!boot) return;
      cfg = config;
      void decideScope();
      applyTheme();
      effects.setAccent(cfg.brand.accent);
      libras.update(cfg, side());
      face.setSide(side());
      if (nudgeEl) {
        closeNudge();
        showNudge();
      }
      applyAll();
    },
    open(view = "panel") {
      if (!boot) return;
      if (view === "panel") openPanel();
      if (view === "nudge") {
        closePanel();
        showNudge();
      }
      if (view === "libras" && enabled("libras")) {
        closePanel();
        closeNudge();
        if (!prefs.libras) setPrefs({ ...prefs, libras: true });
        libras.show();
      }
      if (view === "face" && enabled("faceNav")) {
        closePanel();
        closeNudge();
        face.openIntro();
      }
    },
    close() {
      closePanel();
      closeNudge();
    },
    identify() {
      if (!boot || preview()) return;
      const before = owner;
      syncOwner();
      if (owner === before) return;
      // outro estudante: o convite pendente era do anterior
      closeNudge();
      invited = false;
      inviteeProfile = null;
      if (owner !== "anon") timers.push(setTimeout(() => void maybeNudge(false), Math.max(0, cfg.nudge.delay) * 1000));
    },
    destroy() {
      timers.forEach(clearTimeout);
      flushPending();
      window.removeEventListener("pagehide", flushPending);
      document.removeEventListener("visibilitychange", onHidden);
      closePanel();
      closeNudge();
      face?.destroy();
      libras?.destroy();
      effects?.destroy();
      window.speechSynthesis?.cancel();
      for (const k of Object.keys(memory)) delete memory[k];
      if (pushTimer) clearTimeout(pushTimer);
      prefs = { ...DEFAULT_PREFS };
      prefsAt = 0;
      nudgeMemo = null;
      pulling = Promise.resolve();
      inScope = null;
      remoteBlocked = false;
      invited = false;
      inviteeProfile = null;
      hostEl?.remove();
      hostEl = null;
      boot = null;
    },
  };
}

(window as unknown as { __luumuA11y?: A11yWidget }).__luumuA11y = createWidget();
