/**
 * Luumu SDK, widget embutido de pesquisas (Voice of Customer).
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

  /*
    Content-Type dos POSTs do SDK.

    O SDK roda no site do cliente, então TODA chamada à nossa API é cross-origin. O browser
    só dispensa o preflight OPTIONS quando a request é "simples" — e, para o Content-Type,
    simples significa exatamente um destes três: application/x-www-form-urlencoded,
    multipart/form-data ou text/plain. `application/json` NÃO está na lista: cada POST de
    evento ou resposta virava DUAS requests (OPTIONS + POST), dobrando o Edge Request
    cobrado no caminho mais quente da plataforma.

    `Access-Control-Max-Age: 86400` (lib/api/cors.ts) manda o browser cachear o preflight,
    mas esse cache é por (origem, caminho, método, headers) e não sobrevive de forma
    confiável entre navegações — num site multipágina o preflight reaparecia o tempo todo.

    Mandar text/plain não muda nada no servidor: as rotas leem o corpo com `req.json()`,
    que desserializa o texto independentemente do Content-Type declarado. O corpo continua
    sendo JSON — só paramos de anunciá-lo de um jeito que custa uma request a mais.
  */
  const SIMPLE_CONTENT_TYPE = "text/plain;charset=UTF-8";

  const keyFromAttr = currentScript?.getAttribute("data-luumu") || "";
  let activeKey = ""; // SDK key em uso (setada em start())

  // catálogo de surveys ativas do workspace (carregado uma vez), p/ resolver gatilhos por evento
  type ActiveSurvey = {
    id: string;
    triggerEvent?: string | null; // legado (compat)
    triggerEvents?: string[] | null; // fonte da verdade: dispara se QUALQUER um casar
    audience?: string | null; // "Todos os usuários" | "Usuários específicos"
    audienceMode?: "email" | "id" | null;
    audienceList?: string[] | null;
    frequency?: string | null; // "Uma vez por usuário" | "Recorrente (30 dias)" | "Sempre"
    appearance?: Appearance;
  };
  let activeSurveys: ActiveSurvey[] = [];
  let catalogLoaded = false;

  // estado do catálogo de EVENTOS no servidor (vem junto com /config); decide se vale mandar
  // um nome no POST /events. `null` = ainda não sabemos (catálogo não carregou, ou veio de um
  // cache gravado antes deste campo existir) → manda como antes.
  type EventCatalog = { open: boolean; known: string[] };
  type Catalog = { surveys: ActiveSurvey[]; events: EventCatalog | null };
  let eventsOpen: boolean | null = null;
  let serverKnown: Record<string, 1> = {};

  // identidade do usuário atual (informada pelo cliente via Luumu.identify)
  let identity: { id?: string; email?: string } = {};
  try {
    const saved = localStorage.getItem("luumu_identity");
    if (saved) identity = JSON.parse(saved);
  } catch {}

  const markSeen = (id: string) => {
    try {
      localStorage.setItem(`luumu_seen_${id}`, String(Date.now()));
    } catch {}
  };
  // decide se a survey já foi vista "o suficiente" pra este usuário, respeitando a frequência escolhida.
  // "Sempre" nunca bloqueia; "Recorrente (30 dias)" expira; qualquer outro valor = uma vez só.
  function blockedByFrequency(s: ActiveSurvey): boolean {
    if (s.frequency === "Sempre") return false;
    let lastSeenAt: number | null = null;
    try {
      const raw = localStorage.getItem(`luumu_seen_${s.id}`);
      lastSeenAt = raw ? Number(raw) : null;
    } catch {
      lastSeenAt = null;
    }
    if (lastSeenAt == null || isNaN(lastSeenAt)) return false;
    if (s.frequency === "Recorrente (30 dias)") {
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      return Date.now() - lastSeenAt < THIRTY_DAYS_MS;
    }
    return true; // "Uma vez por usuário" (padrão)
  }

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
    const bg = dark ? "#181B33" : "#FFFFFF";
    const fg = dark ? "#FAFAFB" : "#0D0F1A";
    const mut = dark ? "#B4B9D1" : "#6B7280";
    const line = dark ? "#3A3F63" : "#E7E5F0";
    const sunken = dark ? "#11132A" : "#F3F4F6";
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
    textarea, input[type=text] { width: 100%; border: 1px solid ${dark ? "#3A3F63" : line}; background: ${sunken}; color: ${fg};
      border-radius: 12px; padding: 10px 12px; font-size: 14px; resize: vertical; outline: none; }
    textarea::placeholder, input[type=text]::placeholder { color: ${mut}; opacity: 1; }
    textarea:focus, input:focus { border-color: ${accent}; background: ${bg}; }
    .emoji { display: flex; gap: 8px; }
    .em { width: 46px; height: 46px; font-size: 22px; border: 1px solid ${line}; background: ${bg};
      border-radius: 12px; cursor: pointer; }
    .em.on { border-color: ${accent}; background: ${accent}14; }
    .foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; }
    .prog { display: flex; gap: 4px; flex: 1; }
    .prog i { height: 4px; flex: 1; border-radius: 4px; background: ${line}; }
    .prog i.on { background: ${accent}; }
    .btn { display: inline-flex; align-items: center; gap: 6px; background: ${accent}; color: #fff; border: 0;
      border-radius: 999px; padding: 9px 18px; font-size: 14px; font-weight: 700; cursor: pointer; }
    .btn:hover { filter: brightness(1.08); }
    .thanks { text-align: center; padding: 8px 16px 20px; }
    .thanks .t { font-size: 16px; font-weight: 800; margin-top: 8px; }
    .thanks .s { font-size: 12px; color: ${mut}; margin-top: 2px; }
    .thanks img { width: 96px; height: auto; }
    `;
  }

  // mascote oficial da Luumu (mesmo path SVG de components/ui/LuumuLogo.tsx), recortado para o header do widget
  const LOGO_SVG =
    '<svg viewBox="183 -4 381 397" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M334.536 68.1626C334.688 69.3641 334.814 71.2221 335.231 72.2691C368.669 67.5926 402.069 77.4241 428.909 97.6691C461.709 122.537 483.194 159.497 488.574 200.306C496.464 257.008 478.094 316.772 427.934 347.149C426.169 348.219 423.209 350.267 421.314 350.827L418.269 352.914C427.019 354.046 468.174 359.186 468.329 368.883C464.184 377.054 425.019 383.819 415.584 384.963C365.969 390.963 313.816 389.813 264.552 381.254C256.595 379.872 232.644 374.797 228.501 368.737C226.762 358.724 268.328 353.286 276.77 352.014C247.997 336.22 225.204 311.418 211.89 281.417C194.597 242.143 193.506 197.631 208.855 157.557C222.569 122.507 251.72 97.5856 285.595 82.8801C286.821 82.7641 294.296 80.6636 295.639 80.2156C303.687 77.5326 311.608 76.9521 319.724 75.2806C320.407 74.1576 320.225 72.1066 320.276 70.5801C321.102 71.6781 320.782 72.4821 320.869 74.2201C329.618 74.6206 330.098 75.5316 334.536 68.1626Z" fill="#803EBC"/>' +
    '<path d="M321.809 83.0662C321.898 81.5542 320.386 78.2497 321.326 76.3837C325.308 73.8912 331.738 78.1837 333.945 72.1912C334.257 73.2132 334.622 73.4142 335.308 74.2462C344.139 83.9177 328.315 91.5362 321.809 83.0662Z" fill="#2F2465"/>' +
    '<path d="M347.994 209.21C348.383 209.273 348.123 209.193 348.573 209.786C347.699 216.069 345.623 222.24 341.268 226.995C336.44 232.286 329.685 235.412 322.526 235.667C304.247 236.485 290.188 220.393 289.84 202.792C289.511 186.163 300.413 171.164 318.114 170.922C326.137 170.805 333.86 173.973 339.491 179.689C343.037 183.238 347.621 190.533 347.099 195.67C343.918 189.15 340.867 183.31 333.543 180.826C321.924 176.884 312.206 182.948 308.613 194.017C306.388 201.103 307.128 208.787 310.664 215.318C313.6 220.728 318.646 225.383 324.702 226.938C329.246 228.145 334.087 227.407 338.064 224.9C343.795 221.268 346.362 215.461 347.994 209.21Z" fill="#FBFAFA"/>' +
    '<path d="M414.47 160.195C447.1 158.229 458.095 217.438 421.41 221.377C416.065 221.928 410.435 219.743 406.11 216.732C385.495 202.397 385.56 164.833 414.47 160.195Z" fill="#F7F6F8"/>' +
    '<path d="M419.319 167.648C422.854 167.655 426.329 168.542 429.434 170.229C445.064 178.858 446.769 209.517 426.404 214.659C400.309 215.176 393.809 172.82 419.319 167.648Z" fill="#191526"/>' +
    '<path d="M399.025 219.608C403.245 219.288 405.92 220.384 407.345 224.487C414.68 245.629 398.145 267.76 375.91 267.671C368.56 267.642 365.08 266.682 358.47 264.161C357.905 263.899 357.345 263.619 356.795 263.323C347.484 258.246 341.391 242.38 345.869 231.997C347.942 227.19 357.66 226.984 362.42 227.309C376.075 228.241 386.415 222.807 399.025 219.608Z" fill="#191526"/>' +
    '<path d="M374.6 242.262C405.685 243.513 398 264.797 374.07 265.118C348.805 264.342 343.891 244.905 374.6 242.262Z" fill="#DF2A66"/>' +
    '<path d="M191.254 10.7881C241.542 -10.0674 296.549 -2.96243 319.078 52.2796C319.242 52.6816 319.404 53.0851 319.564 53.4891C319.398 58.4021 319.547 62.5416 319.739 67.4281L320.276 70.5801C320.225 72.1066 320.407 74.1576 319.724 75.2806C311.608 76.9521 303.687 77.5326 295.639 80.2156C294.296 80.6636 286.821 82.7641 285.595 82.8801C282.232 82.4391 278.14 82.3411 274.662 82.0346C233.679 78.4276 200.246 51.4516 184.637 13.5156C186.76 12.5821 189.093 11.6766 191.254 10.7881Z" fill="#4E9E2D"/>' +
    '<path d="M191.255 10.7881C241.543 -10.0674 296.55 -2.96243 319.079 52.2796C319.243 52.6816 319.405 53.0851 319.564 53.4891C319.398 58.4021 319.547 62.5416 319.739 67.4281C319.879 67.4556 303.423 52.1716 301.107 50.4161C270.808 27.4546 236.279 17.4806 198.868 13.7086C196.206 13.4401 192.959 13.0671 191.255 10.7881Z" fill="#88D029"/>' +
    '<path d="M490.665 2.83118C505.305 2.03918 534.99 4.29618 546.735 13.3967C555.65 20.3032 559.62 30.4377 561.005 41.4552C563.165 58.6442 563.315 83.1377 552.67 97.6717C541.765 112.555 521.89 111.414 505.05 113.634C502.64 116.064 500.935 117.517 498.29 119.697C496.01 121.608 489.885 127.149 487.245 127.932C481.785 129.554 483.15 116.198 479.12 114.026C470.19 109.212 460.03 109.649 451.81 102.209C441.36 92.7552 438.525 74.8907 437.525 61.6277C436.37 46.3152 437.185 27.7292 447.83 15.6392C457.01 5.21368 477.49 3.28618 490.665 2.83118Z" fill="#88D029"/>' +
    '<path d="M513.275 34.1446C514.12 34.0826 514.965 34.0416 515.81 34.0206C531.84 33.7201 537.575 51.9506 529.41 63.0711C521.645 73.6441 509.265 83.2626 499.77 92.4916C495.35 88.5156 489.92 84.2406 485.26 80.4231C476.225 73.0011 463.79 64.1216 463.86 51.2581C463.875 46.4951 465.925 41.9651 469.495 38.8126C473.035 35.6031 477.765 34.0331 482.525 34.4886C490.115 35.1866 494.075 39.5156 498.58 44.8221C503.085 38.6456 505.72 35.9111 513.275 34.1446Z" fill="#FBFAFA"/>' +
    "</svg>";
  // mascote "Comemorando" do design system oficial da Luumu, servido pelo mesmo host do sdk.js
  const plumHappy = () => `<img src="${ORIGIN}/mascot/Comemorando.svg" alt="" width="104" height="114" />`;

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
      let scoreBlockId: string | null = null;
      let scoreMin: number | null = null;
      let scoreMax: number | null = null;
      for (const q of vis) {
        if (SCORE_BLOCKS.indexOf(q.blockId) >= 0 && typeof answers[q.uid] === "number") {
          score = answers[q.uid] as number;
          scoreBlockId = q.blockId;
          scoreMin = q.config?.min ?? null;
          scoreMax = q.config?.max ?? null;
          break;
        }
      }
      try {
        await fetch(`${API}/responses`, {
          method: "POST",
          headers: { "Content-Type": SIMPLE_CONTENT_TYPE },
          body: JSON.stringify({
            key: activeKey,
            surveyId: survey.id,
            channel: "SDK",
            answers: vis.map((q) => ({ questionId: q.uid, value: normalize(q, answers[q.uid]) })),
            score,
            scoreBlockId,
            scoreMin,
            scoreMax,
            respondent: identity.id || null,
            respondentEmail: identity.email || null,
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
        t.innerHTML = plumHappy() + '<div class="t">Obrigado! 💜</div><div class="s">Sua resposta ajuda a melhorar.</div>';
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
      }, onChangeSilent));

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

    // grava a resposta sem disparar render(), usado nos campos de texto p/ não perder o foco a cada tecla
    function onChangeSilent(uid: string, v: unknown) {
      answers[uid] = v;
    }

    function field(
      q: Question,
      value: unknown,
      onChange: (v: unknown) => void,
      onChangeSilent: (uid: string, v: unknown) => void
    ): Node {
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
        // grava direto em answers, sem re-renderizar a cada tecla (evita perder o foco)
        i.oninput = () => onChangeSilent(q.uid, i.value);
        return i;
      }

      // long (default)
      const ta = el("textarea", { rows: "3", placeholder: cfg.placeholder || "" }) as HTMLTextAreaElement;
      if (typeof value === "string") ta.value = value;
      ta.oninput = () => onChangeSilent(q.uid, ta.value);
      return ta;
    }

    render();
  }

  /*
    Cache do conteúdo da pesquisa (perguntas + aparência).

    Sem isto, toda EXIBIÇÃO de pesquisa era um GET /surveys/[id] — e numa pesquisa que
    dispara bem isso é uma request por visitante que a vê, todas devolvendo o mesmo JSON.
    Como a Vercel cobra Edge Request mesmo quando a CDN responde, o `s-maxage` da rota
    sozinho não tira esse custo: é preciso não fazer a request.

    TTL curto (5 min) porque este payload carrega também o estado da pesquisa. Servir um
    conteúdo de alguns minutos atrás é seguro: quem responde ainda é validado na gravação
    (POST /responses relê status e vigência no banco, sem cache), então uma pesquisa
    encerrada não recebe resposta mesmo montada a partir do cache.
  */
  const SURVEY_TTL_MS = 5 * 60 * 1000;
  const surveyKey = (id: string, key: string) => `luumu_survey_${key}_${id}`;

  async function fetchSurvey(id: string, key: string): Promise<SurveyData | null> {
    try {
      const raw = localStorage.getItem(surveyKey(id, key));
      if (raw) {
        const parsed = JSON.parse(raw) as { t: number; survey: SurveyData };
        if (parsed && typeof parsed.t === "number" && parsed.survey && Date.now() - parsed.t <= SURVEY_TTL_MS) {
          return parsed.survey;
        }
      }
    } catch {}

    let survey: SurveyData;
    try {
      const r = await fetch(`${API}/surveys/${id}?key=${encodeURIComponent(key)}`);
      if (!r.ok) return null;
      survey = (await r.json()) as SurveyData;
    } catch {
      return null;
    }

    try {
      localStorage.setItem(surveyKey(id, key), JSON.stringify({ t: Date.now(), survey }));
    } catch {}
    return survey;
  }

  /*
    Cache do catálogo entre navegações.

    `catalogLoaded` é uma flag em memória: ela morre a cada troca de página. Num produto
    multipágina isso significava um GET /config por PAGEVIEW, para sempre — e essa é a rota
    que todo visitante de todo site cliente chama, o maior volume da plataforma.

    O `s-maxage=60` da rota (app/api/v1/config/route.ts) já evita acordar a função, mas a
    Vercel cobra Edge Request mesmo quando quem responde é a CDN: só deixar de FAZER a
    request tira o custo.

    localStorage e não sessionStorage: com sessionStorage o catálogo morria junto com a aba,
    então CADA nova visita — e cada aba — recomeçava com um GET /config. Numa base de
    visitantes recorrentes isso é a maior fatia das Edge Requests que sobra depois do cache
    de borda, porque a cobrança acontece mesmo quando quem responde é a CDN.

    O TTL abaixo é o que limita o quanto um catálogo velho pode ser usado, e ele vale igual
    nos dois storages: trocar de sessionStorage para localStorage não deixa uma pesquisa
    despublicada pendurada por mais tempo, só evita refazer a request a cada visita dentro
    da janela.

    A chave inclui a SDK key — um mesmo navegador pode ter abas de workspaces diferentes,
    e devolver o catálogo errado mostraria a pesquisa de outro workspace.

    TTL de 30 min é o atraso máximo para uma pesquisa publicada começar a aparecer para quem
    já tem catálogo em cache. Publicação de pesquisa não é operação de tempo real, e quem
    chega sem cache (visitante novo) pega na hora.
  */
  const CATALOG_TTL_MS = 30 * 60 * 1000;
  const catalogKey = (key: string) => `luumu_catalog_${key}`;

  // aceita só o formato esperado; qualquer outra coisa vira "não sabemos" (null)
  function parseEventCatalog(v: unknown): EventCatalog | null {
    const e = v as EventCatalog | null | undefined;
    if (!e || typeof e.open !== "boolean" || !Array.isArray(e.known)) return null;
    return { open: e.open, known: e.known.filter((n) => typeof n === "string") };
  }

  function readCachedCatalog(key: string): Catalog | null {
    try {
      const raw = localStorage.getItem(catalogKey(key));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { t: number; surveys: ActiveSurvey[]; events?: unknown };
      if (!parsed || typeof parsed.t !== "number" || !Array.isArray(parsed.surveys)) return null;
      if (Date.now() - parsed.t > CATALOG_TTL_MS) return null;
      return { surveys: parsed.surveys, events: parseEventCatalog(parsed.events) };
    } catch {
      // localStorage indisponível (modo privado, storage bloqueado) ou JSON corrompido:
      // segue pelo caminho de rede, que é o comportamento anterior.
      return null;
    }
  }

  function writeCachedCatalog(key: string, catalog: Catalog) {
    try {
      localStorage.setItem(
        catalogKey(key),
        JSON.stringify({ t: Date.now(), surveys: catalog.surveys, events: catalog.events })
      );
    } catch {}
  }

  /**
   * Busca o catálogo na rede. `null` = a request falhou (rede caída, 4xx/5xx) e é diferente
   * de `surveys: []` = o workspace realmente não tem pesquisa ativa. A distinção importa porque
   * só o segundo caso pode ir para o cache: gravar `[]` de uma falha silenciaria as pesquisas
   * do cliente pelo TTL inteiro a cada soluço de rede.
   */
  async function fetchActive(key: string): Promise<Catalog | null> {
    try {
      const r = await fetch(`${API}/config?key=${encodeURIComponent(key)}`);
      if (!r.ok) return null;
      const d = await r.json();
      return { surveys: (d.surveys || []) as ActiveSurvey[], events: parseEventCatalog(d.events) };
    } catch {
      return null;
    }
  }

  function applyCatalog(catalog: Catalog) {
    activeSurveys = catalog.surveys;
    if (catalog.events) {
      eventsOpen = catalog.events.open;
      serverKnown = {};
      for (const n of catalog.events.known) serverKnown[n] = 1;
    }
    catalogLoaded = true;
  }

  /*
    Uma busca por vez, e sem insistir quando ela falha.

    `track()` chama ensureCatalog a cada evento automático (page view, clique, engaged_30s,
    page_leave...). Sem estes dois controles:
     - os eventos disparados juntos no load faziam, cada um, o seu GET /config em paralelo;
     - quando o /config falhava (key revogada, origem fora da allowlist, rede), CADA evento
       seguinte refazia a request — e resposta de erro não é cacheada na borda, então cada uma
       virava invocação de função. Um site mal configurado geraria uma invocação por clique.
    Depois de uma falha, a próxima tentativa só acontece passado CATALOG_RETRY_MS.
  */
  const CATALOG_RETRY_MS = 60 * 1000;
  let catalogInFlight: Promise<void> | null = null;
  let catalogRetryAt = 0;

  async function loadCatalog(key: string) {
    const cached = readCachedCatalog(key);
    if (cached) {
      applyCatalog(cached);
      return;
    }
    if (Date.now() < catalogRetryAt) return;

    const fetched = await fetchActive(key);
    if (fetched === null) {
      // falha: não marca como carregado nem grava cache; tenta de novo depois da espera
      activeSurveys = [];
      catalogRetryAt = Date.now() + CATALOG_RETRY_MS;
      return;
    }

    applyCatalog(fetched);
    writeCachedCatalog(key, fetched);
  }

  // garante que o catálogo de surveys ativas esteja carregado (uma vez por sessão)
  function ensureCatalog(key: string): Promise<void> {
    if (catalogLoaded) return Promise.resolve();
    if (!catalogInFlight) {
      catalogInFlight = loadCatalog(key).finally(() => {
        catalogInFlight = null;
      });
    }
    return catalogInFlight;
  }

  // slug de evento, DEVE casar com normalizeEventName() do servidor (lib/db/events.ts)
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

  // consolida os gatilhos por evento da survey (array novo + campo legado)
  function surveyTriggers(s: ActiveSurvey): string[] {
    const list = Array.isArray(s.triggerEvents) ? s.triggerEvents.slice() : [];
    if (s.triggerEvent) list.push(s.triggerEvent);
    return list.map(slug).filter(Boolean);
  }

  // decide se o usuário atual está no público-alvo da survey
  function inAudience(s: ActiveSurvey): boolean {
    if (s.audience !== "Usuários específicos") return true; // "Todos os usuários" (ou não definido)
    const list = (s.audienceList || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    if (list.length === 0) return false; // específico sem lista = ninguém
    if (s.audienceMode === "email") {
      const email = (identity.email || "").trim().toLowerCase();
      return !!email && list.indexOf(email) >= 0;
    }
    if (s.audienceMode === "id") {
      const id = (identity.id || "").trim().toLowerCase();
      return !!id && list.indexOf(id) >= 0;
    }
    return false;
  }

  // dispara a survey (respeitando frequência e público-alvo, salvo force) buscando os detalhes sob demanda
  async function trigger(catalogEntry: ActiveSurvey, key: string, force = false, audienceOk = true) {
    if (!force && !audienceOk) return;
    if (!force && blockedByFrequency(catalogEntry)) return;
    const survey = await fetchSurvey(catalogEntry.id, key);
    if (!survey) return;
    if (!force && blockedByFrequency(catalogEntry)) return;
    const delay = Math.max(0, (survey.appearance.triggerDelay || 0) * 1000);
    setTimeout(() => mount(survey), delay);
  }

  /* ---------- Ingestão de eventos: catálogo, dedupe persistente e batch ----------
   *
   * O servidor mantém um CATÁLOGO de nomes distintos ("que eventos existem neste produto?"),
   * não um contador de ocorrências: reenviar um nome já catalogado não muda nada no banco.
   *
   * Antes cada evento virava um POST próprio, e o dedupe vivia num Set em memória — que
   * morre a cada navegação. Num site multipágina isso significava recatalogar "page_view_home",
   * "click_entrar" etc. a cada página, para sempre. Duas mudanças cortam isso:
   *
   *  1. o conjunto de nomes já enviados passa a viver no localStorage, então sobrevive à
   *     navegação: um nome conhecido nunca mais gera request;
   *  2. o que sobra (nomes realmente inéditos) é acumulado num buffer e enviado em UMA
   *     request com vários nomes.
   *
   * Nada de amostragem: todo nome inédito continua sendo enviado. O que desaparece é só a
   * repetição, que o servidor já descartava com onConflictDoNothing.
   */
  const SENT_KEY = "luumu_sent_events";
  let sentNames: Record<string, 1> = {};
  try {
    const raw = localStorage.getItem(SENT_KEY);
    if (raw) sentNames = JSON.parse(raw) || {};
  } catch {}

  // teto defensivo: se o produto do cliente gerar nomes demais, o dedupe reinicia em vez de
  // crescer sem limite no localStorage (o servidor também tem seu próprio teto de catálogo).
  const SENT_MAX = 500;

  function rememberSent(names: string[]) {
    let changed = false;
    for (const n of names) {
      if (!sentNames[n]) {
        sentNames[n] = 1;
        changed = true;
      }
    }
    if (!changed) return;
    try {
      if (Object.keys(sentNames).length > SENT_MAX) sentNames = {};
      localStorage.setItem(SENT_KEY, JSON.stringify(sentNames));
    } catch {}
  }

  // buffer de nomes inéditos aguardando envio
  let pending: string[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  const FLUSH_MS = 2000; // janela de agrupamento
  const FLUSH_MAX = 20; // envia na hora ao acumular este tanto

  /**
   * Envia o buffer. `beacon` é usado quando a página está sendo descarregada: fetch normal
   * é cancelado nesse momento, sendBeacon não — é isso que evita perder o último evento.
   */
  function flush(beacon = false) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    const key = activeKey || keyFromAttr;
    // o catálogo pode ter carregado depois que o nome entrou na fila: filtra de novo aqui
    pending = pending.filter(worthSending);
    if (!key || pending.length === 0) return;
    const names = pending;
    pending = [];

    const body = JSON.stringify({ key, events: names });
    // só marca como enviado depois de despachar; se a request falhar, o nome volta ao buffer
    // para tentar de novo (o catálogo é idempotente, reenviar não duplica nada).
    if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      const ok = navigator.sendBeacon(`${API}/events`, new Blob([body], { type: SIMPLE_CONTENT_TYPE }));
      if (ok) rememberSent(names);
      return;
    }
    fetch(`${API}/events`, {
      method: "POST",
      headers: { "Content-Type": SIMPLE_CONTENT_TYPE },
      body,
      keepalive: true,
    })
      .then((r) => {
        if (r.ok) rememberSent(names);
        else for (const n of names) if (pending.indexOf(n) < 0) pending.push(n);
      })
      .catch(() => {
        // rede indisponível: devolve ao buffer para a próxima janela de flush
        for (const n of names) if (pending.indexOf(n) < 0) pending.push(n);
      });
  }

  /*
    Só vale mandar o que o SERVIDOR ainda não tem. `sentNames` sozinho não resolve: ele é por
    navegador, então cada visitante novo reenviava o catálogo inteiro que o projeto já conhecia
    — e num projeto com o catálogo cheio o servidor descarta tudo, então cada POST era uma
    invocação sem efeito. O estado do servidor vem no /config (ver lib/db/events.ts,
    eventCatalogForSdk); enquanto ele não chegou, `eventsOpen` é null e vale o comportamento
    anterior.
  */
  function worthSending(name: string): boolean {
    if (eventsOpen === false) return false;
    return !serverKnown[name] && !sentNames[name];
  }

  /** Coloca um nome inédito na fila de catalogação (ignora o que já foi enviado). */
  function enqueueEvent(name: string) {
    if (!worthSending(name) || pending.indexOf(name) >= 0) return;
    pending.push(name);
    if (pending.length >= FLUSH_MAX) {
      flush();
      return;
    }
    if (!flushTimer) flushTimer = setTimeout(() => flush(), FLUSH_MS);
  }

  /**
   * Envia um evento do produto do cliente. Faz duas coisas:
   *  1. ingere o evento (para aparecer no painel como gatilho disponível);
   *  2. dispara qualquer survey ativa cujo gatilho case com o nome (respeitando público-alvo).
   *
   * O disparo de pesquisa NÃO espera a ingestão: quem decide é o catálogo já carregado,
   * então agrupar o envio do nome não atrasa nenhuma pesquisa.
   */
  async function track(rawEvent: string) {
    const key = activeKey || keyFromAttr;
    if (!key || !rawEvent) return;
    const name = slug(rawEvent);
    if (!name) return;
    // ingestão (agrupada, best-effort, não bloqueia o disparo)
    enqueueEvent(name);
    // disparo por gatilho (qualquer evento da lista que case)
    await ensureCatalog(key);
    for (const s of activeSurveys) {
      if (surveyTriggers(s).indexOf(name) >= 0) trigger(s, key, false, inAudience(s));
    }
  }

  // ---------- Auto-tracking (zero-config) ----------
  // Sem o cliente escrever nenhum código: captura page views e cliques em
  // elementos interativos, gerando nomes de evento legíveis automaticamente.
  // `data-luumu-track="nome"` (ou `data-luumu-ignore`) permite ao cliente
  // ajustar/silenciar pontualmente, sem exigir instrumentação manual.
  /*
    Dedupe dos eventos AUTOMÁTICOS dentro deste carregamento de página. Vale para o caminho
    inteiro de autoTrack (ingestão + avaliação de gatilho), então um botão clicado dez vezes
    não reavalia dez vezes as pesquisas. A ingestão tem seu próprio dedupe, persistente e
    entre páginas (sentNames); este aqui é o de curto prazo, em memória.
  */
  const autoSeen = new Set<string>();

  function textLabel(node: Element): string {
    const aria = node.getAttribute("aria-label");
    if (aria) return aria;
    const txt = (node.textContent || "").trim().replace(/\s+/g, " ");
    if (txt) return txt.slice(0, 40);
    const alt = node.querySelector("img[alt]")?.getAttribute("alt");
    if (alt) return alt;
    return "";
  }

  // sobe até 3 níveis a partir do alvo do clique procurando um elemento "trackável"
  function closestTrackable(start: Element): Element | null {
    let node: Element | null = start;
    for (let i = 0; i < 4 && node; i++) {
      if (node.hasAttribute("data-luumu-ignore")) return null;
      if (node.hasAttribute("data-luumu-track")) return node;
      const tag = node.tagName.toLowerCase();
      if (tag === "button" || tag === "a" || node.getAttribute("role") === "button") return node;
      if (tag === "input") {
        const type = (node as HTMLInputElement).type;
        if (type === "submit" || type === "button") return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  /**
   * Generaliza o rótulo de um elemento para o TIPO de ação, não a instância clicada.
   * "unidade 6 - introdução a biologia" e "unidade 7 - citologia" são o mesmo botão da
   * interface; mantê-los separados encheria o catálogo com um evento por item de lista.
   */
  function labelPattern(label: string): string {
    return label
      .replace(/\d+/g, ":n") // "unidade 6" -> "unidade :n"
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 48); // rótulos longos são texto de conteúdo, não nome de ação
  }

  /*
    Um rótulo é NOME DE AÇÃO ("Entrar", "Salvar alterações", "Criar nova batalha") ou é
    CONTEÚDO — o enunciado de uma questão, a alternativa de um quiz, o título de um card.

    A diferença importa porque conteúdo é um espaço de nomes infinito: cada questão nova do
    produto do cliente inventa um nome de evento que nunca existiu, o dedupe local (sentNames)
    nunca reconhece, e cada clique vira um POST /api/v1/events. Foi assim que um único projeto
    chegou a 7.273 eventos distintos, quase todos com count=1 — e a rota de ingestão virou o
    maior custo da plataforma, catalogando texto de prova.

    `labelPattern` já normaliza números ("unidade 6" → "unidade :n"), mas isso só resolve
    listas; não tem defesa contra frase. Aqui a pergunta é outra: isto PARECE ação?

    Quem precisa do nome exato de um clique específico continua tendo `data-luumu-track`,
    que é verificado antes e passa direto — a intenção explícita do cliente nunca é descartada.
  */
  const ACTION_MAX_WORDS = 4;
  const ACTION_MAX_CHARS = 28;

  function looksLikeContent(label: string): boolean {
    const text = label.trim();
    if (!text) return false;
    // pontuação de frase: rótulo de botão não termina em ponto final, vírgula ou interrogação
    if (/[.,;:!?]$/.test(text)) return true;
    if (text.length > ACTION_MAX_CHARS) return true;
    if (text.split(/\s+/).length > ACTION_MAX_WORDS) return true;
    return false;
  }

  function autoEventName(node: Element): string | null {
    const explicit = node.getAttribute("data-luumu-track");
    if (explicit) return `click_${slug(explicit)}`;
    const tag = node.tagName.toLowerCase();
    const kind = tag === "a" ? "link" : "click";
    const raw = textLabel(node) || node.getAttribute("name") || node.id || tag;

    /*
      Conteúdo vira um nome genérico pelo TIPO do elemento: o painel continua mostrando que
      houve clique em link/botão (o sinal de engajamento se mantém, e serve de gatilho), mas
      com um punhado de nomes estáveis em vez de um nome por texto clicado. O catálogo volta
      a ser o que ele deveria ser: a lista de ações do produto.
    */
    if (looksLikeContent(raw)) return `${kind}_${tag === "a" ? "link" : "button"}`;

    return `${kind}_${slug(labelPattern(raw))}`;
  }

  function autoTrack(name: string) {
    if (!name) return;
    // dedupe por nome: cada evento automático só é processado uma vez por carregamento de página.
    // (eventos diferentes disparados no mesmo instante, ex: form_submit + form_submit_x, passam ambos)
    if (autoSeen.has(name)) return;
    autoSeen.add(name);
    track(name);
  }

  /**
   * Reduz um path à ROTA que ele representa: "/quiz/01a06e5c-.../result" e
   * "/quiz/9f2b.../result" são a mesma tela do produto, não dois eventos.
   *
   * Sem isto cada id na URL virava um evento "inédito" para sempre — o catálogo, que deveria
   * listar as telas do produto, crescia sem limite (e cada nome novo é uma escrita no banco).
   * A query string sai fora pelo mesmo motivo (?page=2, ?tab=..., utm_*).
   */
  function routePattern(pathname: string): string {
    const parts = pathname.split("/").filter(Boolean).map((seg) => {
      if (/^\d+$/.test(seg)) return ":id"; // 2, 37
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ":id"; // uuid
      if (/^[0-9a-f]{16,}$/i.test(seg)) return ":id"; // hash hex
      if (/^[a-z]{2,5}_[A-Za-z0-9]{8,}$/.test(seg)) return ":id"; // ids tipo usr_ab12cd34

      /*
        Abaixo, os casos que vazavam. Produtos que passam estado no CAMINHO (e não na query)
        põem data, termo de busca e valor de filtro como segmento — e cada valor distinto
        virava um nome de evento eterno: `cronograma/selectedDate/2026-08-08T00:00:00.000Z`
        é a MESMA tela que `.../2026-08-19T...`, mas contava como duas rotas.
      */
      // data ISO ou timestamp, em qualquer variação (2026-08-30, 2026-08-30T00:00:00.000Z)
      if (/^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(seg)) return ":date";
      // JWT: três blocos base64url separados por ponto. Precede a regra de tamanho para
      // não depender do comprimento do token.
      if (/^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+$/.test(seg)) return ":token";
      // qualquer coisa com escape de URL é valor, não nome de rota (institutions%2Fassign)
      if (/%[0-9a-f]{2}/i.test(seg)) return ":value";
      // segmento longo sem número também é valor (termo de busca digitado pelo usuário);
      // a regra antiga exigia dígito e deixava passar busca por texto puro
      if (seg.length > 24) return ":value";
      if (seg.length > 24 && /\d/.test(seg)) return ":id"; // slug longo com número
      return seg;
    });
    /*
      Teto de profundidade: a rota é a TELA, e nenhum produto tem tela identificada pelo 8º
      segmento. Sem o corte, caminhos que empilham pares chave/valor
      (`/instituicao/type/summative/periodFrom/.../periodTo/...`) continuariam gerando um nome
      novo por combinação, mesmo com cada valor já normalizado.
    */
    const MAX_DEPTH = 6;
    const capped = parts.length > MAX_DEPTH ? parts.slice(0, MAX_DEPTH) : parts;
    return capped.length ? capped.join("/") : "home";
  }

  function trackPageView() {
    autoTrack(`page_view_${slug(routePattern(location.pathname))}`);
  }

  // --- Eventos padrão semânticos (reconhecidos em qualquer produto) ---
  // Rage click: 3+ cliques no mesmo ponto em < 1s = sinal de frustração.
  let clickBurst: { x: number; y: number; t: number; n: number } | null = null;
  function detectRageClick(e: MouseEvent) {
    const now = Date.now();
    if (clickBurst && now - clickBurst.t < 1000 && Math.abs(e.clientX - clickBurst.x) < 30 && Math.abs(e.clientY - clickBurst.y) < 30) {
      clickBurst.n++;
      clickBurst.t = now;
      if (clickBurst.n === 3) autoTrack("rage_click");
    } else {
      clickBurst = { x: e.clientX, y: e.clientY, t: now, n: 1 };
    }
  }

  function installAutoTracking() {
    document.addEventListener(
      "click",
      (e) => {
        detectRageClick(e as MouseEvent);
        const target = e.target as Element | null;
        if (!target) return;
        const node = closestTrackable(target);
        if (!node) return;
        const name = autoEventName(node);
        if (name) autoTrack(name);
      },
      { capture: true, passive: true }
    );

    // Formulário enviado: qualquer <form> submetido no produto.
    // Dispara sempre o evento canônico "form_submit" e, se houver id/name, também o específico.
    document.addEventListener(
      "submit",
      (e) => {
        const form = e.target as HTMLFormElement | null;
        if (!form || form.hasAttribute("data-luumu-ignore")) return;
        autoTrack("form_submit");
        const label = form.getAttribute("data-luumu-track") || form.getAttribute("name") || form.id || "";
        if (label) autoTrack(`form_submit_${slug(label)}`);
      },
      { capture: true, passive: true }
    );

    // Saída da página / intenção de abandono (mouse deixando o topo da viewport).
    document.addEventListener("mouseout", (e) => {
      const me = e as MouseEvent;
      if (me.clientY <= 0 && !me.relatedTarget) autoTrack("exit_intent");
    });
    // Saída real (fechando/navegando para fora).
    // Enfileira o último evento e descarrega o buffer por sendBeacon no mesmo passo: é a
    // única forma de o que foi capturado nos últimos segundos não morrer com a página.
    window.addEventListener("pagehide", () => {
      autoTrack("page_leave");
      flush(true);
    });
    // Aba indo para segundo plano (no mobile, muitas vezes o último callback antes de morrer).
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) flush(true);
    });

    // Engajamento por tempo ativo na página (30s e 60s de permanência com aba visível).
    let activeMs = 0;
    let lastTick = Date.now();
    const fired = new Set<number>();
    setInterval(() => {
      const now = Date.now();
      if (!document.hidden) activeMs += now - lastTick;
      lastTick = now;
      for (const mark of [30000, 60000]) {
        if (activeMs >= mark && !fired.has(mark)) {
          fired.add(mark);
          autoTrack(`engaged_${mark / 1000}s`);
        }
      }
    }, 5000);

    // navegação: load inicial + trocas de rota em SPA (pushState/replaceState/popstate)
    const notifyRouteChange = () => trackPageView();
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function (...args: Parameters<History["pushState"]>) {
      origPush.apply(history, args);
      notifyRouteChange();
    };
    history.replaceState = function (...args: Parameters<History["replaceState"]>) {
      origReplace.apply(history, args);
      notifyRouteChange();
    };
    window.addEventListener("popstate", notifyRouteChange);

    if (document.readyState === "complete") trackPageView();
    else window.addEventListener("load", trackPageView, { once: true });
  }

  let autoTrackingInstalled = false;

  async function start(opts: { key?: string; surveyId?: string; force?: boolean }) {
    const key = opts.key || keyFromAttr;
    if (!key) return;
    activeKey = key;
    if (!autoTrackingInstalled && currentScript?.getAttribute("data-luumu-autotrack") !== "false") {
      autoTrackingInstalled = true;
      installAutoTracking();
    }
    if (opts.surveyId) {
      // pedido explícito: ignora catálogo/gatilho, mas ainda respeita a frequência configurada
      await ensureCatalog(key);
      const catalogEntry = activeSurveys.find((s) => s.id === opts.surveyId) || { id: opts.surveyId };
      if (!opts.force && blockedByFrequency(catalogEntry)) return;
      const survey = await fetchSurvey(opts.surveyId, key);
      if (!survey) return;
      if (!opts.force && blockedByFrequency(catalogEntry)) return;
      const delay = Math.max(0, (survey.appearance.triggerDelay || 0) * 1000);
      setTimeout(() => mount(survey), delay);
      return;
    }
    // auto-init: só surveys SEM gatilho por evento aparecem no load (respeitando público-alvo);
    // as que têm gatilho por evento aguardam o evento correspondente (auto ou via track).
    await ensureCatalog(key);
    const target = activeSurveys.find(
      (s) =>
        surveyTriggers(s).length === 0 &&
        (opts.force || !blockedByFrequency(s)) &&
        (opts.force || inAudience(s))
    );
    if (target) trigger(target, key, opts.force);
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
    // informa quem é o usuário logado (habilita público-alvo por email/ID)
    identify(user: { id?: string; email?: string } = {}) {
      identity = { id: user.id, email: user.email };
      try {
        localStorage.setItem("luumu_identity", JSON.stringify(identity));
      } catch {}
    },
    // limpa a identidade (ex.: logout)
    reset() {
      identity = {};
      try {
        localStorage.removeItem("luumu_identity");
      } catch {}
    },
  };

  w.Luumu = Luumu;

  // auto-init se houver data-luumu (a menos que data-luumu-auto="false")
  const autoAttr = currentScript?.getAttribute("data-luumu-auto");
  if (keyFromAttr && autoAttr !== "false") Luumu.init({ key: keyFromAttr });
})();
