/*
  Gera docs/accessibility/integracao-plataforma-externa.pdf — o que a plataforma externa precisa
  enviar ao SDK da Luumu e o que recebe dele (contrato em src/lib/accessibility/integration.ts).

    TSX_TSCONFIG_PATH=scripts/tsconfig.scripts.json node --import tsx scripts/a11y-integration-pdf.mjs [saída.pdf]

  Como funciona: monta um HTML com a identidade da Luumu (Plus Jakarta Sans, Inter, roxo
  #6B2BD9, logo e mascote de public/mascot) e imprime com o Google Chrome headless. A capa usa
  capturas reais do plugin (public/sdk-a11y.js) — rode `node scripts/build-sdk.mjs` antes se o
  widget mudou. Tabelas de campos e perfis vêm do código, então o PDF não fica desatualizado.

  Precisa do Google Chrome instalado (ou CHROME_PATH apontando para ele) e de internet para as
  fontes do Google Fonts (sem internet, cai nas fontes do sistema).
*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PREF_FIELDS, PROFILE_REFERENCE } from "../src/lib/accessibility/integration.ts";
import { normalizeA11yConfig, publicA11yConfig } from "../src/lib/accessibility/config.ts";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.resolve(process.argv[2] || path.join(ROOT, "docs/accessibility/integracao-plataforma-externa.pdf"));
const CHROME =
  process.env.CHROME_PATH ||
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => fs.existsSync(p));
if (!CHROME) throw new Error("Google Chrome não encontrado. Defina CHROME_PATH.");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "luumu-a11y-pdf-"));

const chrome = (args) => execFileSync(CHROME, ["--headless", "--disable-gpu", "--allow-file-access-from-files", "--hide-scrollbars", "--no-first-run", ...args], { stdio: "ignore" });
const dataUri = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString("base64")}`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ---------------------------------------------------------------- capturas reais do plugin */

const pluginConfig = publicA11yConfig(normalizeA11yConfig({ brand: { accent: "#6B2BD9" }, nudge: { enabled: true, audience: "all", delay: 0 } }));
function capture(view) {
  const html = path.join(tmp, `cap-${view}.html`);
  const png = path.join(tmp, `cap-${view}.png`);
  fs.writeFileSync(
    html,
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>body{margin:0;background:#F4F1FB}</style></head><body>
<script src="file://${path.join(ROOT, "public/sdk-a11y.js")}"></script>
<script>
  const w = window.__luumuA11y;
  w.boot({ api: "https://luumu.com.br/api/v1", key: "pk_capa", host: "capa.luumu.com.br", config: ${JSON.stringify(pluginConfig)},
           identity: () => ({}), preview: ${view === "nudge" ? "{ nudge: true }" : "{}"} });
  w.open("${view}");
</script></body></html>`
  );
  chrome(["--force-device-scale-factor=2", "--virtual-time-budget=5000", "--window-size=900,860", `--screenshot=${png}`, `file://${html}`]);
  return dataUri(png, "image/png");
}
const shotPanel = capture("panel");
const shotInvite = capture("nudge");

/* ---------------------------------------------------------------- ícones (lucide) */

async function icon(name, size = 18) {
  const mod = await import(path.join(ROOT, "node_modules/lucide-react/dist/esm/icons", `${name}.mjs`));
  const inner = mod.__iconNode.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
const I = Object.fromEntries(
  await Promise.all(
    [
      ["user", "user-round-check"],
      ["plugin", "accessibility"],
      ["zap", "zap"],
      ["refresh", "refresh-cw"],
      ["login", "log-in"],
      ["bell", "bell-ring"],
      ["logout", "log-out"],
      ["check", "check"],
      ["plug", "plug"],
      ["webhook", "webhook"],
      ["key", "key-round"],
      ["send", "send"],
      ["monitor", "monitor-smartphone"],
      ["server", "server"],
      ["shield", "shield-check"],
      ["arrow", "arrow-right"],
      ["database", "database"],
      ["code", "code-xml"],
    ].map(async ([k, n]) => [k, await icon(n)])
  )
);

/* ---------------------------------------------------------------- blocos */

/** Código com destaque leve: strings e comentários. */
function code(src, label) {
  const lines = src.split("\n").map((line) => {
    let cut = -1;
    const t = line.trimStart();
    if (t.startsWith("//") || t.startsWith("#")) cut = line.length - t.length;
    else {
      const m = line.search(/\s\/\/\s/);
      if (m >= 0) cut = m;
    }
    const body = cut >= 0 ? line.slice(0, cut) : line;
    const comment = cut >= 0 ? line.slice(cut) : "";
    const hl = esc(body).replace(/("[^"\n]*")/g, '<span class="s">$1</span>');
    return hl + (comment ? `<span class="c">${esc(comment)}</span>` : "");
  });
  return `<figure class="code">${label ? `<figcaption>${I.code}${esc(label)}</figcaption>` : ""}<pre>${lines.join("\n")}</pre></figure>`;
}
/** `código` e **negrito** em texto corrido. */
const md = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
function table(cols, rows, cls = "") {
  return `<table class="${cls}"><colgroup>${cols.map((c) => `<col style="width:${c.w}%">`).join("")}</colgroup>
<thead><tr>${cols.map((c) => `<th>${esc(c.t)}</th>`).join("")}</tr></thead>
<tbody>${rows.map((r) => `<tr>${r.map((v, i) => `<td${cols[i].mono ? ' class="mono"' : ""}>${cols[i].raw ? v : md(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
const pill = (t, tone = "") => `<span class="pill ${tone}">${esc(t)}</span>`;

/* ---------------------------------------------------------------- conteúdo */

const logoWhite = dataUri(path.join(ROOT, "public/mascot/logo-horizontal-white.png"), "image/png");
const mascotDone = dataUri(path.join(ROOT, "public/mascot/Aprovando.svg"), "image/svg+xml");
const today = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

const SET_USER = `comLuumu((Luumu) => {
  Luumu.accessibility.setUser({
    id: "123456",                   // ID estável do estudante
    email: "ana@escola.sp.gov.br",  // opcional
    user_hash: "9f2c...",           // só com "Exigir verificação"
    invite: true,                   // mostrar o convite
    profiles: ["leitura", "foco"],  // perfis do convite
    status: "pending",              // desfecho já registrado
    prefs: { textSize: 2, legibleFont: true, profiles: ["leitura"] },
  });
});`;

const PAYLOAD = `{
  "event": "prefs.updated",
  "id": "5b0e8c2a-3f7d-4d55-9a1e-2c41f0b6a9d3",
  "occurredAt": "2026-11-12T14:03:27.512Z",
  "user": { "id": "123456", "email": "ana@escola.sp.gov.br" },
  "host": "app.escola.com.br",
  "prefs": { "legibleFont": true, "spacing": true, "textSize": 2,
             "highlightLinks": true, "profiles": ["leitura"], ... },
  "activeProfiles": ["leitura"],
  "changes": [{ "field": "highlightLinks", "from": false, "to": true }],
  "invite": null
}`;

const NODE = `import crypto from "node:crypto";

const bruto = express.raw({ type: "application/json" });
app.post("/webhooks/luumu-acessibilidade", bruto, (req, res) => {
  const ts = req.get("X-Luumu-Timestamp");
  const sig = (req.get("X-Luumu-Signature") || "").replace("sha256=", "");
  const esperado = crypto
    .createHmac("sha256", process.env.LUUMU_A11Y_SECRET)
    .update(ts + "." + req.body)
    .digest("hex");
  const ok = sig.length === esperado.length
    && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))
    && Math.abs(Date.now() / 1000 - Number(ts)) < 300;
  if (!ok) return res.sendStatus(401);
  res.sendStatus(204);                        // responda logo
  salvarSeMaisRecente(JSON.parse(req.body));  // ver "O que guardar"
});`;

const PYTHON = `import hmac, hashlib, time

def assinatura_valida(corpo: bytes, ts: str, assinatura: str, segredo: str) -> bool:
    msg = f"{ts}.".encode() + corpo
    esperado = hmac.new(segredo.encode(), msg, hashlib.sha256).hexdigest()
    recente = abs(time.time() - int(ts)) < 300
    return recente and hmac.compare_digest(assinatura.removeprefix("sha256="), esperado)`;

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Plugin de Acessibilidade Luumu — Integração com plataforma externa</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=block" rel="stylesheet">
<style>
:root{
  --brand:#6B2BD9; --brand-2:#803EBC; --deep:#1B0B4A; --deep-2:#2F2465; --lilac:#F3EDFF; --lilac-2:#E7DCFD;
  --green:#88D029; --green-d:#4E9E2D; --pink:#DF2A66;
  --ink:#1F2340; --soft:#4B5068; --mut:#7A7F96; --line:#E6E3F0; --paper:#FFFFFF; --sunken:#F7F6FB;
  --display:"Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif; --body:"Inter",ui-sans-serif,system-ui,sans-serif; --mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
}
@page{ size:A4; margin:18mm 17mm 20mm;
  @bottom-left{ content:"Luumu · Plugin de Acessibilidade · Integração com plataforma externa"; font:500 7.5pt/1 "Inter",sans-serif; color:#9A9EB3 }
  @bottom-right{ content:counter(page); font:700 8pt/1 "Plus Jakarta Sans",sans-serif; color:#6B2BD9 } }
@page cover{ margin:0; @bottom-left{content:none} @bottom-right{content:none} }
*{ box-sizing:border-box }
html{ -webkit-print-color-adjust:exact; print-color-adjust:exact }
body{ margin:0; font:400 9.6pt/1.55 var(--body); color:var(--soft); background:var(--paper) }
strong{ color:var(--ink); font-weight:600 }
code{ font:600 .9em var(--mono); color:var(--brand); background:var(--lilac); padding:.05em .35em; border-radius:4px; white-space:nowrap }

/* ---------- capa ---------- */
.cover{ page:cover; position:relative; width:210mm; height:297mm; overflow:hidden; color:#fff;
  background:radial-gradient(120% 70% at 100% 0%, #7B3AE6 0%, rgba(123,58,230,0) 60%), radial-gradient(90% 60% at 0% 100%, #3A1690 0%, rgba(58,22,144,0) 70%), linear-gradient(160deg,#24105E 0%,#1B0B4A 55%,#140838 100%) }
.cover .ring{ position:absolute; border-radius:50%; border:1.5px solid rgba(255,255,255,.08) }
.cover .dots{ position:absolute; left:0; right:0; top:0; height:120mm; background-image:radial-gradient(rgba(255,255,255,.06) 1px, transparent 1.2px); background-size:16px 16px }
.cover header{ position:absolute; top:18mm; left:18mm; right:18mm; display:flex; align-items:center; justify-content:space-between }
.cover header img{ height:12mm }
.cover header span{ font:600 8pt/1 var(--body); letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.7); border:1px solid rgba(255,255,255,.22); padding:2.2mm 3.4mm; border-radius:99px }
.cover .title{ position:absolute; top:48mm; left:18mm; width:120mm }
.eyebrow{ display:inline-flex; align-items:center; gap:2mm; font:700 8.5pt/1 var(--display); letter-spacing:.12em; text-transform:uppercase; color:var(--green) }
.cover h1{ margin:5mm 0 0; font:800 33pt/1.04 var(--display); letter-spacing:-.02em }
.cover h1 em{ font-style:normal; color:#C9A8FF }
.cover p.lead{ margin:6mm 0 0; font:400 11.5pt/1.5 var(--body); color:rgba(255,255,255,.78); width:104mm }
.stage{ position:absolute; left:0; right:0; top:128mm; height:128mm }
.shot{ position:absolute; overflow:hidden; background:#fff; border:1px solid rgba(255,255,255,.35) }
.plate{ position:absolute; background:#0E0628; opacity:.55 }
.shot img{ position:absolute; display:block }
/* painel lateral real: recorte x 880–1800 / y 0–1720 da captura 1800×1720 */
.shot.panel{ right:16mm; top:-14mm; width:74mm; aspect-ratio:920/1720; border-radius:5mm; transform:rotate(2.5deg) }
.shot.panel img{ width:195.652%; left:-95.652%; top:0 }
/* convite real: recorte x 32–1768 / y 332–1388 */
.shot.invite{ left:16mm; top:30mm; width:100mm; aspect-ratio:1736/1056; border-radius:4.2mm; transform:rotate(-2deg) }
.shot.invite img{ width:103.687%; left:-1.843%; top:-31.439% }
.tag{ position:absolute; display:flex; align-items:center; gap:2mm; padding:2.4mm 3.6mm; border-radius:99px; background:#fff; color:var(--deep); font:700 8pt/1 var(--display); border:1.5px solid #C9A8FF }
.tag svg{ color:var(--brand); width:14px; height:14px }
.tag.t1{ left:16mm; top:14mm } .tag.t2{ left:30mm; top:100mm } .tag.t3{ right:20mm; top:118mm }
.cover footer{ position:absolute; left:18mm; right:18mm; bottom:14mm; display:flex; justify-content:space-between; align-items:flex-end; font:500 8pt/1.4 var(--body); color:rgba(255,255,255,.6) }
.cover footer b{ display:block; font:700 9pt/1.3 var(--display); color:#fff }

/* ---------- páginas ---------- */
.chapter{ margin-top:12mm }
.chapter-head{ break-inside:avoid; break-after:avoid }
.keep{ break-inside:avoid }
.kicker{ display:flex; align-items:center; gap:2.4mm; font:700 8pt/1 var(--display); letter-spacing:.14em; text-transform:uppercase; color:var(--brand) }
.kicker i{ display:inline-grid; place-items:center; width:6.5mm; height:6.5mm; border-radius:2mm; background:var(--brand); color:#fff; font:800 9pt/1 var(--display); font-style:normal; letter-spacing:0 }
h2{ margin:2.5mm 0 1.5mm; font:800 20pt/1.15 var(--display); color:var(--ink); letter-spacing:-.015em }
h2 + .sub{ margin:0 0 5mm; font-size:10.2pt; color:var(--mut); max-width:150mm }
h3{ margin:6mm 0 2.5mm; font:700 11.5pt/1.3 var(--display); color:var(--ink); break-after:avoid }
p{ margin:0 0 3mm }
.flow{ display:grid; grid-template-columns:1fr 7mm 1fr 7mm 1fr; align-items:stretch; margin:1mm 0 4mm }
.flow .arrow{ display:grid; place-items:center; color:var(--brand) }
.card{ border:1px solid var(--line); border-radius:4mm; padding:4mm; background:var(--paper); break-inside:avoid }
.card .ic{ display:inline-grid; place-items:center; width:8.5mm; height:8.5mm; border-radius:2.6mm; background:var(--lilac); color:var(--brand); margin-bottom:2.4mm }
.card b{ display:block; font:700 10.5pt/1.25 var(--display); color:var(--ink); margin-bottom:1.2mm }
.card small{ display:block; font:700 7pt/1 var(--display); letter-spacing:.12em; text-transform:uppercase; color:var(--mut); margin-bottom:1.6mm }
.card p{ margin:0; font-size:8.8pt; line-height:1.5 }
.card.dark{ background:linear-gradient(150deg,#2A1270,#1B0B4A); border-color:transparent; color:rgba(255,255,255,.75) }
.card.dark b{ color:#fff } .card.dark small{ color:var(--green) } .card.dark .ic{ background:rgba(255,255,255,.12); color:#fff }
.card.dark code{ background:rgba(255,255,255,.12); color:#fff }
.callout{ display:flex; gap:4mm; align-items:flex-start; padding:4mm 5mm; border-radius:4mm; background:var(--lilac); color:var(--deep-2); break-inside:avoid; margin:4mm 0 }
.callout svg{ flex:none; color:var(--brand); margin-top:.5mm }
.callout p{ margin:0 } .callout strong{ color:var(--deep) }
.callout.green{ background:#EEF8E1; color:#2F5A12 } .callout.green svg{ color:var(--green-d) }
.grid2{ display:grid; grid-template-columns:1fr 1fr; gap:4mm } .grid4{ display:grid; grid-template-columns:repeat(4,1fr); gap:3mm }
.steps{ counter-reset:s; display:grid; grid-template-columns:1fr 1fr; gap:3mm; margin-bottom:2mm }
.steps .card{ position:relative; padding:3.4mm 4mm 3.4mm 14mm }
.steps .card b{ font-size:10pt; margin-bottom:.8mm }
.steps .card::before{ counter-increment:s; content:counter(s); position:absolute; left:4mm; top:3.6mm; width:7mm; height:7mm; border-radius:50%; background:var(--brand); color:#fff; font:800 9pt/7mm var(--display); text-align:center }
.trigger .ic{ width:8mm; height:8mm; margin-bottom:2.4mm } .trigger b{ font-size:9.6pt } .trigger p{ font-size:8.4pt; line-height:1.45 }
.checks{ list-style:none; margin:0 0 3mm; padding:0 } .checks li{ display:flex; gap:2.6mm; align-items:flex-start; margin-bottom:2mm; break-inside:avoid }
.checks li span.b{ flex:none; display:grid; place-items:center; width:5mm; height:5mm; border-radius:1.4mm; background:var(--green); color:#fff; margin-top:.3mm }
.checks li span.b svg{ width:11px; height:11px; stroke-width:3 }
.checks.todo li span.b{ background:#fff; border:1.6px solid var(--brand); color:transparent }
figure.code{ margin:2mm 0 4mm; border-radius:3.5mm; overflow:hidden; background:#16102E; break-inside:avoid }
figure.code figcaption{ display:flex; align-items:center; gap:2mm; padding:2.2mm 4mm; font:600 7.6pt/1 var(--body); color:#B9B3D9; background:#1F1740; letter-spacing:.02em }
figure.code figcaption svg{ width:12px; height:12px; color:#A78BFA }
pre{ margin:0; padding:3.6mm 4.4mm; font:400 7.9pt/1.6 var(--mono); color:#E9E6F7; white-space:pre-wrap }
pre .s{ color:#B9F27C } pre .c{ color:#8C86B3 }
table{ width:100%; border-collapse:separate; border-spacing:0; margin:1mm 0 5mm; font-size:8.6pt; border:1px solid var(--line); border-radius:3.5mm; overflow:hidden }
thead{ display:table-header-group } tr{ break-inside:avoid }
th{ text-align:left; font:700 7.4pt/1.2 var(--display); letter-spacing:.08em; text-transform:uppercase; color:var(--brand); background:var(--lilac); padding:2.6mm 3mm }
td{ padding:2.4mm 3mm; border-top:1px solid var(--line); vertical-align:top; line-height:1.45 }
tbody tr:nth-child(even) td{ background:var(--sunken) }
td.mono{ font:600 8pt/1.45 var(--mono); color:var(--ink) }
td code{ white-space:normal }
.pill{ display:inline-block; font:600 7.8pt/1 var(--mono); padding:1.3mm 2.2mm; border-radius:99px; background:var(--lilac); color:var(--brand) }
.pill.g{ background:#EEF8E1; color:#3F7F1E } .pill.p{ background:#FDE7EF; color:#B3184F } .pill.n{ background:#EEF0F5; color:#5B6075 }
.channels .card ul{ margin:1mm 0 0; padding-left:4mm; font-size:8.8pt } .channels .card li{ margin-bottom:1mm }
.end{ display:flex; gap:6mm; align-items:center; margin-top:4mm }
.end img{ width:40mm; flex:none }
</style></head>
<body>

<!-- ============================== CAPA ============================== -->
<section class="cover">
  <div class="dots"></div>
  <div class="ring" style="width:150mm;height:150mm;right:-60mm;top:-50mm"></div>
  <div class="ring" style="width:220mm;height:220mm;right:-95mm;top:-85mm"></div>
  <header><img src="${logoWhite}" alt="Luumu"><span>Guia de integração · v1</span></header>
  <div class="title">
    <div class="eyebrow">${I.plugin} Plugin de Acessibilidade</div>
    <h1>Integração com <em>plataforma externa</em></h1>
    <p class="lead">O que enviar ao SDK para mostrar o convite certo a cada estudante e como receber, em tempo real, cada ajuste que ele faz no plugin.</p>
  </div>
  <div class="stage">
    <div class="plate" style="left:19mm;top:34mm;width:100mm;aspect-ratio:1736/1056;border-radius:4.2mm;transform:rotate(-2deg)"></div>
    <div class="plate" style="right:13mm;top:-10mm;width:74mm;aspect-ratio:920/1720;border-radius:5mm;transform:rotate(2.5deg)"></div>
    <div class="shot panel"><img src="${shotPanel}" alt="Painel do plugin"></div>
    <div class="shot invite"><img src="${shotInvite}" alt="Convite de acessibilidade"></div>
    <div class="tag t1">${I.user} setUser: quem é convidado</div>
    <div class="tag t2">${I.zap} Eventos em tempo real</div>
    <div class="tag t3">${I.webhook} Webhook assinado</div>
  </div>
  <footer>
    <div><b>Para o time técnico da plataforma externa</b>Quem decide os convidados e guarda as escolhas de cada estudante.</div>
    <div style="text-align:right"><b>luumu.com.br</b>${esc(today)}</div>
  </footer>
</section>

<!-- ============================== VISÃO GERAL ============================== -->
<section>
  <div class="chapter-head">
  <div class="kicker"><i>0</i> Visão geral</div>
  <h2>Como funciona</h2>
  <p class="sub">A plataforma externa decide e guarda. A Luumu exibe o botão, o painel de recursos e o convite dentro da página, e avisa cada mudança.</p>
  </div>
  <div class="flow">
    <div class="card"><div class="ic">${I.user}</div><small>Plataforma → SDK</small><b>Informe o estudante</b><p>A cada página, <code>setUser</code> diz se ele recebe o convite e qual a última configuração salva.</p></div>
    <div class="arrow">${I.arrow}</div>
    <div class="card"><div class="ic">${I.plugin}</div><small>Plugin</small><b>Aplica e convida</b><p>A página já abre com as escolhas do estudante. O convite aparece quando for o caso.</p></div>
    <div class="arrow">${I.arrow}</div>
    <div class="card dark"><div class="ic">${I.zap}</div><small>SDK → Plataforma</small><b>Avisa na hora</b><p>Cada ajuste vira um evento no navegador e um webhook assinado para o servidor da plataforma.</p></div>
  </div>
  <div class="callout">${I.shield}<p><strong>Vale sempre a última configuração aplicada pelo estudante</strong>, em qualquer aparelho. Guarde a do evento mais recente e devolva no próximo <code>setUser</code>. Neste modo a Luumu não guarda convidados nem preferências.</p></div>

  <h3>Configuração em 4 passos</h3>
  <div class="steps">
    <div class="card"><b>Escolha o modo</b><p>Painel da Luumu → Acessibilidade → <strong>Ativação → Integração</strong> → <strong>Plataforma externa</strong>.</p></div>
    <div class="card"><b>Cadastre o webhook</b><p>Informe a URL https do servidor da plataforma e clique em <strong>Testar webhook</strong>. Ele precisa responder 2xx.</p></div>
    <div class="card"><b>Guarde o segredo</b><p><strong>Ativação → Verificação de identidade</strong>: copie o segredo do projeto para uma variável de ambiente do servidor.</p></div>
    <div class="card"><b>Ligue o convite e publique</b><p>Aba <strong>Convite → Mostrar o convite</strong>. Texto e ilustração continuam no painel. Clique em <strong>Publicar</strong>.</p></div>
  </div>

  <div class="keep"><h3>Instale o SDK</h3>
  <p>O mesmo script de sempre, antes do <code>&lt;/head&gt;</code>, em todas as páginas com estudante logado. Como ele usa <code>defer</code>, espere o evento <code>luumu:ready</code> antes de chamá-lo:</p>
  ${code(`<script src="https://luumu.com.br/sdk.js" data-luumu="SUA_CHAVE_PK" defer></script>

<script>
  function comLuumu(fn) {
    if (window.Luumu) fn(window.Luumu);
    else window.addEventListener("luumu:ready", () => fn(window.Luumu), { once: true });
  }
</script>`, "HTML da plataforma")}</div>
</section>

<!-- ============================== ENTRADA ============================== -->
<section class="chapter">
  <div class="chapter-head">
  <div class="kicker"><i>1</i> Entrada</div>
  <h2>O que enviar ao SDK</h2>
  <p class="sub">Uma chamada por estudante logado. É ela que decide se o convite aparece e qual configuração a página aplica.</p>
  </div>
  ${code(SET_USER, "Luumu.accessibility.setUser")}
  ${table(
    [
      { t: "Campo", w: 16, mono: true },
      { t: "Tipo", w: 15 },
      { t: "Obrigatório", w: 13 },
      { t: "O que é", w: 56 },
    ],
    [
      ["id", "texto ou número", "sim¹", "Identificador estável do estudante (o mesmo em todos os aparelhos). Volta em `user.id` nos eventos."],
      ["email", "texto", "sim¹", "E-mail do estudante."],
      ["user_hash", "texto (hexadecimal)", "se exigido", "HMAC-SHA256 do segredo do projeto sobre o `id` em minúsculas e sem espaços. Gere no servidor, nunca na página."],
      ["invite", "booleano", "sim", "`true` = recebe o convite. `false` = não recebe (o botão de acessibilidade continua lá)."],
      ["profiles", "lista de ids", "não", "Perfis sugeridos no convite, na ordem (até 3 aparecem). Vazio = os perfis escolhidos no painel."],
      ["status", "texto", "não", "`pending` · `shown` · `accepted` · `dismissed`. Com `accepted` ou `dismissed` o convite não volta. Padrão: `pending`."],
      ["prefs", "objeto ou null", "não", "Última configuração salva (formato no capítulo 2). Ausente ou `null` = nada salvo ainda."],
    ]
  )}
  <p style="font-size:8pt;color:var(--mut);margin-top:-3mm">¹ Informe <code>id</code> ou <code>email</code> (de preferência os dois).</p>

  <div class="keep"><h3>Quando chamar</h3>
  <div class="grid4">
    <div class="card trigger"><div class="ic">${I.refresh}</div><b>A cada página</b><p>Com o estudante logado, o quanto antes. Pode ser antes de o plugin carregar.</p></div>
    <div class="card trigger"><div class="ic">${I.login}</div><b>Após o login</b><p>Em aplicações de página única, logo depois de entrar, sem recarregar.</p></div>
    <div class="card trigger"><div class="ic">${I.bell}</div><b>Quando mudar</b><p>Ex.: o estudante passou a ser convidado. Chame de novo; o último valor vale.</p></div>
    <div class="card trigger"><div class="ic">${I.logout}</div><b>No logout</b><p>Chame <code>Luumu.reset()</code>. Tudo do estudante anterior sai da tela.</p></div>
  </div></div>

  <div class="keep"><h3>O convite aparece quando</h3>
  <ul class="checks">
    <li><span class="b">${I.check}</span><span><code>invite: true</code> e <code>status</code> igual a <code>pending</code> ou <code>shown</code>;</span></li>
    <li><span class="b">${I.check}</span><span>o convite está ligado no painel e o plugin está ativo nesse domínio;</span></li>
    <li><span class="b">${I.check}</span><span>o estudante ainda não tem nenhum recurso ligado;</span></li>
    <li><span class="b">${I.check}</span><span>ainda não apareceu nesta sessão do navegador. O plugin espera até 10 s pelo <code>setUser</code>.</span></li>
  </ul>
  <div class="callout green">${I.check}<p><strong>prefs é aplicado na hora.</strong> Se o estudante mudou algo nesta página depois do último <code>setUser</code>, o próximo não sobrescreve as escolhas dele, para uma cópia antiga não desfazer o ajuste.</p></div></div>
</section>

<!-- ============================== FORMATO ============================== -->
<section class="chapter">
  <div class="chapter-head">
  <div class="kicker"><i>2</i> Formato</div>
  <h2>Configuração do estudante (prefs)</h2>
  <p class="sub">O mesmo objeto na entrada (<code>setUser</code>) e na saída (eventos). Guarde-o inteiro, como veio no evento mais recente.</p>
  </div>
  ${table(
    [
      { t: "Campo", w: 24, mono: true },
      { t: "Tipo", w: 14 },
      { t: "Valores", w: 34 },
      { t: "Recurso", w: 28 },
    ],
    PREF_FIELDS.map((f) => [f.field, f.type, f.values, f.meaning])
  )}
  <h3>Perfis</h3>
  <p>Ids usados em <code>profiles</code> (setUser) e em <code>activeProfiles</code> / <code>prefs.profiles</code> (eventos).</p>
  ${table(
    [
      { t: "id", w: 13, mono: true },
      { t: "No convite", w: 25 },
      { t: "No painel", w: 24 },
      { t: "O que liga", w: 38 },
    ],
    PROFILE_REFERENCE.map((r) => [r.id, r.nudgeLabel, r.label, r.description])
  )}
</section>

<!-- ============================== SAÍDA ============================== -->
<section class="chapter">
  <div class="chapter-head">
  <div class="kicker"><i>3</i> Saída</div>
  <h2>Mudanças em tempo real</h2>
  <p class="sub">Todo ajuste no plugin gera um evento no mesmo instante, por dois canais, com o mesmo conteúdo e o mesmo <code>id</code>.</p>
  </div>
  <div class="grid2 channels">
    <div class="card"><div class="ic">${I.monitor}</div><small>Na página</small><b>Evento no navegador</b>
      <ul><li><code>window</code> → <code>"luumu:accessibility"</code> (<code>e.detail</code>)</li><li><code>Luumu.accessibility.onChange(fn)</code> devolve a função para parar de ouvir</li><li><code>Luumu.accessibility.getState()</code> mostra o estado atual</li></ul></div>
    <div class="card dark"><div class="ic">${I.server}</div><small>No servidor · recomendado</small><b>Webhook assinado</b>
      <ul><li><code>POST</code> JSON para a URL do painel</li><li>Chega mesmo se a página não tratar o evento</li><li>Até 3 tentativas: na hora, +1 s e +4 s</li></ul></div>
  </div>
  ${code(`window.addEventListener("luumu:accessibility", (e) => {
  enviarParaOServidor(e.detail);  // mesmo formato do webhook
});`, "Navegador")}

  <h3>Tipos de evento</h3>
  ${table(
    [
      { t: "event", w: 24, raw: true },
      { t: "Quando acontece", w: 76 },
    ],
    [
      [pill("prefs.updated"), "Qualquer ajuste: recurso ligado ou desligado, tamanho do texto, contraste, cores, perfis, **Restaurar padrão**, mover o botão e aceitar o convite. `changes` diz o que mudou."],
      [pill("invite.shown", "n"), "O convite apareceu para o estudante."],
      [pill("invite.accepted", "g"), "O estudante aceitou. Logo depois chega um `prefs.updated` com os perfis ligados."],
      [pill("invite.dismissed", "p"), "O estudante recusou o convite."],
      [pill("test", "n"), "Enviado pelo botão **Testar webhook** do painel. Pode ser ignorado."],
    ]
  )}

  <h3>Campos do evento</h3>
  ${table(
    [
      { t: "Campo", w: 19, mono: true },
      { t: "Tipo", w: 16 },
      { t: "O que é", w: 65 },
    ],
    [
      ["event", "texto", "Tipo do evento (tabela acima)."],
      ["id", "texto", "Id único. Novas tentativas repetem o mesmo id: use-o para descartar duplicados."],
      ["occurredAt", "ISO 8601", "Quando aconteceu no aparelho do estudante. **Vale o mais recente.**"],
      ["user", "objeto", "`{ id, email }` do estudante, como veio no `setUser`."],
      ["host", "texto", "Domínio onde aconteceu (ex.: app.escola.com.br)."],
      ["prefs", "objeto", "Configuração completa já com a mudança (capítulo 2). **É o que deve ser salvo.**"],
      ["activeProfiles", "lista de ids", "Perfis ligados agora (igual a `prefs.profiles`)."],
      ["changes", "lista", "`[{ field, from, to }]` do que mudou. Vazio nos eventos de convite."],
      ["invite", "objeto ou null", "Nos eventos `invite.*`: `{ status, profiles }`. `null` nos demais."],
    ]
  )}
  ${code(PAYLOAD, "Exemplo de corpo")}
</section>

<!-- ============================== WEBHOOK ============================== -->
<section class="chapter">
  <div class="chapter-head">
  <div class="kicker"><i>4</i> Webhook</div>
  <h2>Receber e conferir</h2>
  <p class="sub">Responda rápido, confira a assinatura e descarte repetidos. Só estudantes identificados geram eventos; com “Exigir verificação”, só com <code>user_hash</code> válido.</p>
  </div>
  ${table(
    [
      { t: "Cabeçalho", w: 27, mono: true },
      { t: "Conteúdo", w: 73 },
    ],
    [
      ["X-Luumu-Event", "Tipo do evento (ex.: `prefs.updated`)."],
      ["X-Luumu-Delivery", "Id do evento (igual ao `id` do corpo)."],
      ["X-Luumu-Timestamp", "Segundos desde 1970 (UTC) no momento do envio."],
      ["X-Luumu-Signature", "`sha256=` + HMAC-SHA256 (segredo do projeto, `timestamp.corpo`) em hexadecimal."],
      ["Content-Type", "`application/json` · User-Agent `Luumu-Webhooks/1.0`"],
    ]
  )}
  <div class="grid4" style="margin-bottom:5mm">
    <div class="card trigger"><div class="ic">${I.send}</div><b>Responda 2xx</b><p>Em até 5 s. Processe depois de responder.</p></div>
    <div class="card trigger"><div class="ic">${I.key}</div><b>Confira a assinatura</b><p>HMAC sobre o corpo <strong>bruto</strong>, em tempo constante.</p></div>
    <div class="card trigger"><div class="ic">${I.shield}</div><b>Janela de 5 min</b><p>Recuse envios com horário (X-Luumu-Timestamp) mais antigo que isso.</p></div>
    <div class="card trigger"><div class="ic">${I.database}</div><b>Sem duplicados</b><p>Ignore um <code>id</code> já processado.</p></div>
  </div>
  ${code(NODE, "Node.js (Express)")}
  ${code(PYTHON, "Python")}
  <p style="font-size:8.6pt;color:var(--mut)">Falha de rede, timeout, 408, 429 e 5xx geram nova tentativa. Os outros 4xx são tratados como recusa e não se repetem.</p>
</section>

<!-- ============================== GUARDAR + CHECKLIST ============================== -->
<section class="chapter">
  <div class="chapter-head">
  <div class="kicker"><i>5</i> Fechamento</div>
  <h2>O que guardar</h2>
  <p class="sub">Um estudante pode usar vários aparelhos ao mesmo tempo. Comparar <code>occurredAt</code> garante que vale a última necessidade aplicada por ele.</p>
  </div>
  ${table(
    [
      { t: "Ao receber", w: 26, raw: true },
      { t: "Faça", w: 74 },
    ],
    [
      [pill("prefs.updated"), "Se `occurredAt` for mais recente que o salvo, troque a configuração salva por `prefs` (objeto inteiro). Ela volta no próximo `setUser`."],
      [pill("invite.shown", "n"), "Registre `shown` (se ainda estiver `pending`)."],
      [pill("invite.accepted", "g"), "Registre `accepted`. Não volta atrás."],
      [pill("invite.dismissed", "p"), "Registre `dismissed` (se não estiver `accepted`)."],
    ]
  )}

  <div class="keep"><h3>Lista de verificação</h3>
  <div class="end">
    <ul class="checks todo" style="flex:1">
      <li><span class="b">${I.check}</span><span>SDK instalado com a chave do projeto em todas as páginas logadas.</span></li>
      <li><span class="b">${I.check}</span><span>Painel: <strong>Plataforma externa</strong>, convite ligado, webhook testado (2xx) e alterações publicadas.</span></li>
      <li><span class="b">${I.check}</span><span><code>setUser</code> a cada página com <code>id</code>, <code>invite</code>, <code>profiles</code>, <code>status</code> e <code>prefs</code>.</span></li>
      <li><span class="b">${I.check}</span><span><code>Luumu.reset()</code> no logout.</span></li>
      <li><span class="b">${I.check}</span><span>Webhook confere assinatura e janela de 5 min, responde 2xx em até 5 s e ignora ids repetidos.</span></li>
      <li><span class="b">${I.check}</span><span>Configuração salva só quando <code>occurredAt</code> é mais recente; status do convite atualizado nos eventos <code>invite.*</code>.</span></li>
      <li><span class="b">${I.check}</span><span>Teste ponta a ponta: convidado vê o convite e aceita; em outro navegador ou aparelho, a configuração já aparece aplicada e o convite não volta.</span></li>
    </ul>
    <img src="${mascotDone}" alt="">
  </div></div>
</section>
</body></html>`;

const htmlFile = path.join(tmp, "doc.html");
fs.writeFileSync(htmlFile, html);
if (process.env.KEEP_HTML) fs.copyFileSync(htmlFile, process.env.KEEP_HTML);
chrome(["--no-pdf-header-footer", "--virtual-time-budget=15000", "--run-all-compositor-stages-before-draw", `--print-to-pdf=${out}`, `file://${htmlFile}`]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`✓ ${path.relative(process.cwd(), out)}`);
