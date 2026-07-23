/**
 * Luumu SDK — widget embutido de pesquisas (Voice of Customer).
 * Vanilla TS, sem dependências, isolado via Shadow DOM.
 * Compilado para /public/sdk.js (IIFE). Fonte da verdade dos blocos: lib/builder.ts.
 *
 * Uso:
 *   <script src="https://luumu-five.vercel.app/sdk.js" data-luumu="pk_..."></script>
 * ou programático:
 *   Luumu.init({ key: "pk_...", surveyId?: "svy_..." })
 */

type Format = "popup" | "slider" | "modal" | "bar";
type Position = "bottom-right" | "bottom-left" | "top" | "bottom" | "center";
type Theme = "auto" | "light" | "dark";

interface Appearance {
  format: Format;
  position: Position;
  theme: Theme;
  triggerDelay: number;
  accent: string;
}
interface Question {
  uid: string;
  blockId: string;
  title: string;
  required: boolean;
  config: {
    options?: string[];
    min?: number;
    max?: number;
    minLabel?: string;
    maxLabel?: string;
    placeholder?: string;
  };
  logic: { showIf?: { questionUid: string; op: "lte" | "gte" | "eq"; value: number | string } };
}
interface SurveyData {
  id: string;
  name: string;
  type: string;
  appearance: Appearance;
  questions: Question[];
}

const SCORE_BLOCKS = ["rating", "stars", "scale", "nps", "csat", "ces"];

(function () {
  const w = window as unknown as { Luumu?: unknown; __luumuLoaded?: boolean };
  if (w.__luumuLoaded) return;
  w.__luumuLoaded = true;

  // origem: de onde o script foi servido (para chamar a API certa)
  const currentScript = document.currentScript as HTMLScriptElement | null;
  const scriptSrc = currentScript?.src || "";
  const ORIGIN = scriptSrc ? new URL(scriptSrc).origin : location.origin;
  const API = `${ORIGIN}/api/v1`;
  const keyFromAttr = currentScript?.getAttribute("data-luumu") || "";
  let activeKey = ""; // SDK key em uso (setada em start())

  // catálogo de surveys ativas do workspace (carregado uma vez), p/ resolver gatilhos por evento
  type ActiveSurvey = { id: string; triggerEvent?: string | null; appearance?: Appearance };
  let activeSurveys: ActiveSurvey[] = [];
  let catalogLoaded = false;

  const seen = (id: string) => {
    try {
      return localStorage.getItem(`luumu_seen_${id}`) === "1";
    } catch {
      return false;
    }
  };
  const markSeen = (id: string) => {
    try {
      localStorage.setItem(`luumu_seen_${id}`, "1");
    } catch {}
  };

  function isVisible(q: Question, answers: Record<string, unknown>): boolean {
    const rule = q.logic?.showIf;
    if (!rule) return true;
    const dep = answers[rule.questionUid];
    if (dep == null) return false;
    const depNum = typeof dep === "number" ? dep : Number(dep);
    const val = typeof rule.value === "number" ? rule.value : Number(rule.value);
    if (isNaN(depNum) || isNaN(val)) return String(dep) === String(rule.value) && rule.op === "eq";
    if (rule.op === "lte") return depNum <= val;
    if (rule.op === "gte") return depNum >= val;
    return depNum === val;
  }

  function normalize(q: Question, value: unknown) {
    if (SCORE_BLOCKS.indexOf(q.blockId) >= 0) return { score: value };
    if (q.blockId === "long" || q.blockId === "short") return { text: value };
    return { value };
  }

  const el = (tag: string, attrs?: Record<string, string>, ...kids: (Node | string)[]) => {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    for (const c of kids) n.append(c);
    return n;
  };

  function styles(accent: string, dark: boolean): string {
    const bg = dark ? "#14162A" : "#FFFFFF";
    const fg = dark ? "#FAFAFB" : "#0D0F1A";
    const mut = dark ? "#9AA0B4" : "#6B7280";
    const line = dark ? "#262A45" : "#E7E5F0";
    const sunken = dark ? "#0D0F1A" : "#F3F4F6";
    return `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: 'Plus Jakarta Sans','Inter',system-ui,-apple-system,sans-serif; }
    .wrap { position: fixed; z-index: 2147483000; pointer-events: none; inset: 0; }
    .stage { position: absolute; display: flex; padding: 20px; inset: 0; }
    .card { pointer-events: auto; background: ${bg}; color: ${fg}; border: 1px solid ${line};
      border-radius: 18px; box-shadow: 0 12px 40px rgba(0,0,0,.22); width: 360px; max-width: calc(100vw - 32px);
      overflow: hidden; animation: luumuIn .4s cubic-bezier(.16,1,.3,1); }
    .card.bar { width: 100%; max-width: 720px; border-radius: 14px; }
    @keyframes luumuIn { from { opacity: 0; transform: translateY(16px) scale(.98); } to { opacity: 1; transform: none; } }
    .hd { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 0; }
    .brand { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: ${mut}; }
    .brand svg { width: 16px; height: 16px; }
    .x { background: none; border: 0; cursor: pointer; color: ${mut}; padding: 4px; border-radius: 8px; line-height: 0; }
    .x:hover { background: ${sunken}; }
    .bd { padding: 6px 16px 16px; }
    .q { font-size: 15px; font-weight: 700; line-height: 1.35; margin: 4px 0 12px; }
    .req { color: #EF4444; }
    .opts { display: flex; flex-direction: column; gap: 8px; }
    .opt { text-align: left; border: 1px solid ${line}; background: ${bg}; color: ${fg}; border-radius: 12px;
      padding: 11px 14px; font-size: 14px; font-weight: 500; cursor: pointer; transition: .15s; }
    .opt:hover { border-color: ${accent}; }
    .opt.on { border-color: ${accent}; background: ${accent}18; color: ${accent}; }
    .scale { display: flex; flex-wrap: wrap; gap: 8px; }
    .num { width: 42px; height: 42px; border: 1px solid ${line}; background: ${bg}; color: ${fg}; border-radius: 12px;
      font-size: 14px; font-weight: 700; cursor: pointer; transition: .15s; }
    .num:hover { border-color: ${accent}; }
    .num.on { border-color: transparent; background: ${accent}; color: #fff; }
    .labels { display: flex; justify-content: space-between; font-size: 11px; color: ${mut}; margin-top: 6px; }
    .stars { display: flex; gap: 6px; }
    .star { width: 34px; height: 34px; cursor: pointer; }
    textarea, input[type=text] { width: 100%; border: 1px solid ${line}; background: ${bg}; color: ${fg};
      border-radius: 12px; padding: 10px 12px; font-size: 14px; resize: vertical; outline: none; }
    textarea:focus, input:focus { border-color: ${accent}; }
    .emoji { display: flex; gap: 8px; }
    .em { width: 46px; height: 46px; font-size: 22px; border: 1px solid ${line}; background: ${bg};
      border-radius: 12px; cursor: pointer; }
    .em.on { border-color: ${accent}; background: ${accent}14; }
    .foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; }
    .prog { display: flex; gap: 4px; flex: 1; }
    .prog i { height: 4px; flex: 1; border-radius: 4px; background: ${sunken}; }
    .prog i.on { background: ${accent}; }
    .btn { display: inline-flex; align-items: center; gap: 6px; background: ${accent}; color: #fff; border: 0;
      border-radius: 999px; padding: 9px 18px; font-size: 14px; font-weight: 700; cursor: pointer; }
    .btn:hover { filter: brightness(1.08); }
    .thanks { text-align: center; padding: 8px 16px 20px; }
    .thanks .t { font-size: 16px; font-weight: 800; margin-top: 8px; }
    .thanks .s { font-size: 12px; color: ${mut}; margin-top: 2px; }
    .thanks svg { width: 84px; height: 84px; }
    `;
  }

  const LOGO_SVG =
    '<svg viewBox="0 0 104 104"><circle cx="52" cy="54" r="34" fill="#6B2BD9"/><ellipse cx="42" cy="42" rx="8" ry="10" fill="#fff" opacity=".2"/><path d="M40 14C30 6 16 8 12 20c12 4 26 2 32-8Z" fill="#7ED957"/></svg>';
  const PLUM_HAPPY =
    '<svg viewBox="0 0 104 104"><path d="M40 14C30 6 16 8 12 20c12 4 26 2 32-8Z" fill="#7ED957"/><circle cx="52" cy="54" r="34" fill="#6B2BD9"/><circle cx="42" cy="50" r="6.5" fill="#0D0F1A"/><circle cx="62" cy="50" r="6.5" fill="#0D0F1A"/><path d="M42 63q10 9 20 0" stroke="#0D0F1A" stroke-width="3" fill="#FF6B8A" stroke-linecap="round"/></svg>';

  function mount(survey: SurveyData) {
    const ap = survey.appearance;
    const dark = ap.theme === "dark" || (ap.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);

    const host = el("div", { id: "luumu-root" });
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    root.append(el("style", {}, styles(ap.accent, dark)));

    const answers: Record<string, unknown> = {};
    let step = 0;
    let done = false;

    const wrap = el("div", { class: "wrap" });
    const stage = el("div", { class: "stage" });
    wrap.append(stage);
    root.append(wrap);

    // posicionamento do stage
    const isBar = ap.format === "bar";
    if (ap.format === "modal") {
      stage.style.alignItems = "center";
      stage.style.justifyContent = "center";
      const back = el("div");
      back.style.cssText = "position:absolute;inset:0;background:rgba(0,0,0,.3);pointer-events:auto";
      stage.append(back);
    } else if (isBar) {
      stage.style.alignItems = ap.position === "top" ? "flex-start" : "flex-end";
      stage.style.justifyContent = "center";
    } else {
      stage.style.alignItems = "flex-end";
      stage.style.justifyContent = ap.position === "bottom-left" ? "flex-start" : "flex-end";
    }

    const card = el("div", { class: isBar ? "card bar" : "card" });
    stage.append(card);

    function visibleQs() {
      return survey.questions.filter((q) => isVisible(q, answers));
    }

    async function submit() {
      const vis = visibleQs();
      let score: number | null = null;
      for (const q of vis) {
        if (SCORE_BLOCKS.indexOf(q.blockId) >= 0 && typeof answers[q.uid] === "number") {
          score = answers[q.uid] as number;
          break;
        }
      }
      try {
        await fetch(`${API}/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: activeKey,
            surveyId: survey.id,
            channel: "SDK",
            answers: vis.map((q) => ({ questionId: q.uid, value: normalize(q, answers[q.uid]) })),
            score,
          }),
        });
      } catch {}
      markSeen(survey.id);
    }

    function close() {
      markSeen(survey.id);
      host.remove();
    }

    function render() {
      card.innerHTML = "";
      // header
      const hd = el("div", { class: "hd" });
      const brand = el("div", { class: "brand" });
      brand.innerHTML = LOGO_SVG + "<span>Luumu</span>";
      const x = el("button", { class: "x", "aria-label": "Fechar" }, "✕");
      x.onclick = close;
      hd.append(brand, x);
      card.append(hd);

      const bd = el("div", { class: "bd" });
      card.append(bd);

      if (done) {
        const t = el("div", { class: "thanks" });
        t.innerHTML = PLUM_HAPPY + '<div class="t">Obrigado! 💜</div><div class="s">Sua resposta ajuda a melhorar.</div>';
        bd.append(t);
        setTimeout(close, 2600);
        return;
      }

      const vis = visibleQs();
      const q = vis[step];
      if (!q) {
        done = true;
        render();
        return;
      }
      const isLast = step >= vis.length - 1;

      const qEl = el("div", { class: "q" });
      qEl.innerHTML = q.title + (q.required ? ' <span class="req">*</span>' : "");
      bd.append(qEl);

      bd.append(field(q, answers[q.uid], (v) => {
        answers[q.uid] = v;
        render();
      }));

      const foot = el("div", { class: "foot" });
      const prog = el("div", { class: "prog" });
      if (vis.length > 1) {
        for (let i = 0; i < vis.length; i++) prog.append(el("i", { class: i <= step ? "on" : "" }));
      }
      const btn = el("button", { class: "btn" }, isLast ? "Enviar" : "Próxima");
      btn.onclick = () => {
        if (q.required && (answers[q.uid] == null || answers[q.uid] === "")) return;
        if (isLast) {
          submit();
          done = true;
        } else {
          step++;
        }
        render();
      };
      foot.append(prog, btn);
      bd.append(foot);
    }

    function field(q: Question, value: unknown, onChange: (v: unknown) => void): Node {
      const cfg = q.config || {};
      const b = q.blockId;

      if (["nps", "ces", "scale", "rating", "csat"].indexOf(b) >= 0) {
        const min = cfg.min ?? (b === "nps" ? 0 : 1);
        const max = cfg.max ?? (b === "nps" ? 10 : 5);
        const box = el("div");
        const row = el("div", { class: "scale" });
        for (let n = min; n <= max; n++) {
          const btn = el("button", { class: value === n ? "num on" : "num" }, String(n));
          btn.onclick = () => onChange(n);
          row.append(btn);
        }
        box.append(row);
        if (cfg.minLabel || cfg.maxLabel) {
          const l = el("div", { class: "labels" });
          l.append(el("span", {}, cfg.minLabel || ""), el("span", {}, cfg.maxLabel || ""));
          box.append(l);
        }
        return box;
      }

      if (b === "stars") {
        const max = cfg.max ?? 5;
        const cur = typeof value === "number" ? value : 0;
        const row = el("div", { class: "stars" });
        for (let n = 1; n <= max; n++) {
          const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          s.setAttribute("viewBox", "0 0 24 24");
          s.setAttribute("class", "star");
          s.innerHTML = `<path d="M12 2l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18l-5.8 3 1.1-6.5L2.6 9.8l6.5-.9z" fill="${n <= cur ? "#FFC83D" : "#D1D5DB"}"/>`;
          s.addEventListener("click", () => onChange(n));
          row.append(s);
        }
        return row;
      }

      if (b === "emoji") {
        const ems = ["😡", "🙁", "😐", "🙂", "😍"];
        const row = el("div", { class: "emoji" });
        ems.forEach((e, i) => {
          const btn = el("button", { class: value === i + 1 ? "em on" : "em" }, e);
          btn.onclick = () => onChange(i + 1);
          row.append(btn);
        });
        return row;
      }

      if (b === "choice") {
        const box = el("div", { class: "opts" });
        (cfg.options || []).forEach((o) => {
          const btn = el("button", { class: value === o ? "opt on" : "opt" }, o);
          btn.onclick = () => onChange(o);
          box.append(btn);
        });
        return box;
      }

      if (b === "checkbox") {
        const arr = Array.isArray(value) ? (value as string[]) : [];
        const box = el("div", { class: "opts" });
        (cfg.options || []).forEach((o) => {
          const on = arr.indexOf(o) >= 0;
          const btn = el("button", { class: on ? "opt on" : "opt" }, (on ? "☑ " : "☐ ") + o);
          btn.onclick = () => onChange(on ? arr.filter((x) => x !== o) : arr.concat(o));
          box.append(btn);
        });
        return box;
      }

      if (b === "dropdown") {
        const sel = el("select") as HTMLSelectElement;
        sel.className = "opt";
        sel.append(el("option", { value: "", disabled: "", selected: "" }, "Selecione…"));
        (cfg.options || []).forEach((o) => sel.append(el("option", {}, o)));
        sel.onchange = () => onChange(sel.value);
        return sel;
      }

      if (b === "short") {
        const i = el("input", { type: "text", placeholder: cfg.placeholder || "" }) as HTMLInputElement;
        if (typeof value === "string") i.value = value;
        i.oninput = () => onChange(i.value);
        return i;
      }

      // long (default)
      const ta = el("textarea", { rows: "3", placeholder: cfg.placeholder || "" }) as HTMLTextAreaElement;
      if (typeof value === "string") ta.value = value;
      ta.oninput = () => onChange(ta.value);
      return ta;
    }

    render();
  }

  async function fetchSurvey(id: string, key: string): Promise<SurveyData | null> {
    try {
      const r = await fetch(`${API}/surveys/${id}?key=${encodeURIComponent(key)}`);
      if (!r.ok) return null;
      return (await r.json()) as SurveyData;
    } catch {
      return null;
    }
  }

  async function fetchActive(key: string): Promise<ActiveSurvey[]> {
    try {
      const r = await fetch(`${API}/config?key=${encodeURIComponent(key)}`);
      if (!r.ok) return [];
      const d = await r.json();
      return (d.surveys || []) as ActiveSurvey[];
    } catch {
      return [];
    }
  }

  // garante que o catálogo de surveys ativas esteja carregado (uma vez por sessão)
  async function ensureCatalog(key: string) {
    if (catalogLoaded) return;
    activeSurveys = await fetchActive(key);
    catalogLoaded = true;
  }

  // slug de evento — DEVE casar com normalizeEventName() do servidor (lib/db/events.ts)
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 64);

  // dispara a survey (respeitando "já visto", salvo force) buscando os detalhes sob demanda
  async function trigger(surveyId: string, key: string, force = false) {
    if (!force && seen(surveyId)) return;
    const survey = await fetchSurvey(surveyId, key);
    if (!survey) return;
    if (!force && seen(survey.id)) return;
    const delay = Math.max(0, (survey.appearance.triggerDelay || 0) * 1000);
    setTimeout(() => mount(survey), delay);
  }

  /**
   * Envia um evento do produto do cliente. Faz duas coisas:
   *  1. ingere o evento (para aparecer no painel como gatilho disponível);
   *  2. dispara qualquer survey ativa cujo triggerEvent case com o nome.
   */
  async function track(rawEvent: string) {
    const key = activeKey || keyFromAttr;
    if (!key || !rawEvent) return;
    const name = slug(rawEvent);
    if (!name) return;
    // ingestão (best-effort, não bloqueia o disparo)
    fetch(`${API}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, event: name }),
    }).catch(() => {});
    // disparo por gatilho
    await ensureCatalog(key);
    for (const s of activeSurveys) {
      if (s.triggerEvent && slug(s.triggerEvent) === name) trigger(s.id, key);
    }
  }

  async function start(opts: { key?: string; surveyId?: string; force?: boolean }) {
    const key = opts.key || keyFromAttr;
    if (!key) return;
    activeKey = key;
    if (opts.surveyId) {
      // pedido explícito: ignora catálogo/gatilho
      const survey = await fetchSurvey(opts.surveyId, key);
      if (!survey) return;
      if (!opts.force && seen(survey.id)) return;
      const delay = Math.max(0, (survey.appearance.triggerDelay || 0) * 1000);
      setTimeout(() => mount(survey), delay);
      return;
    }
    // auto-init: só surveys SEM gatilho por evento aparecem no load;
    // as que têm triggerEvent aguardam Luumu.track(...).
    await ensureCatalog(key);
    const target = activeSurveys.find((s) => !s.triggerEvent && (opts.force || !seen(s.id)));
    if (target) trigger(target.id, key, opts.force);
  }

  const Luumu = {
    init(opts: { key?: string; surveyId?: string; force?: boolean } = {}) {
      start({ key: opts.key || keyFromAttr, surveyId: opts.surveyId, force: opts.force });
    },
    // exibe uma pesquisa específica ignorando "já visto" (útil para testes/preview)
    show(surveyId: string) {
      start({ surveyId, force: true });
    },
    // registra um evento do produto e dispara surveys cujo gatilho case
    track(event: string) {
      track(event);
    },
  };

  w.Luumu = Luumu;

  // auto-init se houver data-luumu (a menos que data-luumu-auto="false")
  const autoAttr = currentScript?.getAttribute("data-luumu-auto");
  if (keyFromAttr && autoAttr !== "false") Luumu.init({ key: keyFromAttr });
})();
