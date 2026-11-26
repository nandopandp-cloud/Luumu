/*
  Gera docs/notifications/integracao-avisos-automaticos.pdf — o guia de integração dos avisos
  automáticos (webhook por turma) para a engenharia do GenieX. O texto acompanha
  docs/notifications/INTEGRACAO.md; limites e janelas vêm do código, então o PDF não fica
  desatualizado quando eles mudarem.

    TSX_TSCONFIG_PATH=scripts/tsconfig.scripts.json node --import tsx scripts/notifications-integration-pdf.mjs [saída.pdf]

  Como funciona: monta um HTML com a identidade da Luumu (Plus Jakarta Sans, Inter, roxo #6B2BD9,
  logo e mascote de public/mascot) e imprime com o Google Chrome headless. A capa usa uma captura
  real do sino (public/sdk-notifications.js) com avisos automáticos: rode `node scripts/build-sdk.mjs`
  antes se o sino mudou.

  Precisa do Google Chrome instalado (ou CHROME_PATH apontando para ele) e de internet para as
  fontes do Google Fonts (sem internet, cai nas fontes do sistema).
*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ACTIVITY_LIMITS, DUE_HOURS_OPTIONS, FIRST_SYNC_FRESH_MS, MAX_STUDENT_CLASSES, NEW_WINDOW_MS } from "../src/lib/notifications/activities.ts";
import { MAX_BODY_BYTES, MAX_EVENTS_PER_REQUEST } from "../src/lib/notifications/webhook.ts";
import { SIGNATURE_TOLERANCE_S } from "../src/lib/notifications/signature.ts";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.resolve(process.argv[2] || path.join(ROOT, "docs/notifications/integracao-avisos-automaticos.pdf"));
const CHROME =
  process.env.CHROME_PATH ||
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => fs.existsSync(p));
if (!CHROME) throw new Error("Google Chrome não encontrado. Defina CHROME_PATH.");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "luumu-ntf-pdf-"));

const chrome = (args) => execFileSync(CHROME, ["--headless", "--disable-gpu", "--allow-file-access-from-files", "--hide-scrollbars", "--no-first-run", ...args], { stdio: "ignore" });
const dataUri = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString("base64")}`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const MIN = SIGNATURE_TOLERANCE_S / 60;
const NEW_DAYS = NEW_WINDOW_MS / 86_400_000;
const FRESH_H = FIRST_SYNC_FRESH_MS / 3_600_000;
const DUE_OPTS = DUE_HOURS_OPTIONS.filter((h) => h > 0).map((h) => `${h}h`).join(", ");

/* ---------------------------------------------------------------- captura real do sino */

function captureBell() {
  const html = path.join(tmp, "bell.html");
  const png = path.join(tmp, "bell.png");
  const now = Date.now();
  const H = 3_600_000;
  // prazo dentro das próximas 24h: aparecem "Nova tarefa" e "Falta 1 dia"
  const due = new Date(now + 20 * H);
  due.setMinutes(0, 0, 0);
  const feed = {
    "6A": [
      { id: "t123", k: "tarefa", t: "Frações e decimais", s: "Matemática", u: "/instituicao/assignments/t123", a: now - 12 * 60_000, d: due.getTime() },
      { id: "p45", k: "prova_genial", t: "Prova Genial 3", s: "Ciências", u: "/instituicao/avaliacoes/p45", a: now - 3 * H },
    ],
  };
  const data = { salt: "prj_capa", cfg: { m: "slot", sel: "", cor: "bottom-right", ac: "#6B2BD9", em: "" }, items: [], auto: { n: 1, d: 24 } };
  fs.writeFileSync(
    html,
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&display=block" rel="stylesheet">
<style>
  body{margin:0;background:#F4F1FB;font:500 14px/1.4 Inter,system-ui,sans-serif;color:#2A2E45}
  header{height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:#fff;border-bottom:1px solid #E6E3F0;color:#3A3F5C}
  header b{font:800 16px/1 "Plus Jakarta Sans",sans-serif;color:#1B0B4A}
  header .r{display:flex;align-items:center;gap:12px}
  header .av{width:32px;height:32px;border-radius:50%;background:#E7DCFD;display:grid;place-items:center;font:700 12px/1 "Plus Jakarta Sans";color:#6B2BD9}
  main{padding:22px 18px}
  .sk{height:14px;border-radius:7px;background:#E6E3F0;margin-bottom:12px}
</style></head><body>
<header><b>Ambiente do estudante</b><div class="r"><div id="luumu-bell"></div><div class="av">AS</div></div></header>
<main><div class="sk" style="width:60%"></div><div class="sk" style="width:85%"></div><div class="sk" style="width:40%"></div></main>
<script>
  const FEED = ${JSON.stringify(feed)};
  window.fetch = async (url) => {
    const u = new URL(String(url));
    const items = u.pathname.endsWith("/notifications/feed") ? FEED[u.searchParams.get("c")] || [] : [];
    return new Response(JSON.stringify({ items }), { status: 200, headers: { "content-type": "application/json" } });
  };
</script>
<script src="file://${path.join(ROOT, "public/sdk-notifications.js")}"></script>
<script>
  const b = window.__luumuBell;
  b.boot({ api: "https://luumu.com.br/api/v1", key: "pk_capa", data: ${JSON.stringify(data)}, identity: () => ({ id: "aluno-capa", class_ids: ["6A"] }) });
  setTimeout(() => {
    b.open();
    // sem o anel de foco do botão fechar na captura
    setTimeout(() => document.querySelector("[data-luumu-notifications]")?.shadowRoot?.activeElement?.blur(), 50);
  }, 400);
</script></body></html>`
  );
  chrome(["--force-device-scale-factor=2", "--virtual-time-budget=6000", "--window-size=600,580", `--screenshot=${png}`, `file://${html}`]);
  return dataUri(png, "image/png");
}
const shotBell = captureBell();

/* ---------------------------------------------------------------- ícones (lucide) */

async function icon(name, size = 18) {
  const mod = await import(path.join(ROOT, "node_modules/lucide-react/dist/esm/icons", `${name}.mjs`));
  const inner = mod.__iconNode.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
const I = Object.fromEntries(
  await Promise.all(
    [
      ["tarefa", "clipboard-list"],
      ["prova", "graduation-cap"],
      ["prazo", "hourglass"],
      ["webhook", "webhook"],
      ["key", "key-round"],
      ["school", "school"],
      ["bell", "bell-ring"],
      ["database", "database"],
      ["shield", "shield-check"],
      ["arrow", "arrow-right"],
      ["code", "code-xml"],
      ["check", "check"],
      ["server", "server"],
      ["monitor", "monitor-smartphone"],
      ["refresh", "refresh-cw"],
      ["logout", "log-out"],
      ["users", "users-round"],
      ["done", "circle-check-big"],
      ["timer", "timer"],
      ["search", "search"],
      ["plug", "plug-zap"],
      ["layers", "layers"],
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
      const m = line.search(/\s(\/\/|#)\s/);
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
const checks = (items, todo = true) =>
  `<ul class="checks${todo ? " todo" : ""}">${items.map((t) => `<li><span class="b">${I.check}</span><span>${md(t)}</span></li>`).join("")}</ul>`;

/* ---------------------------------------------------------------- conteúdo */

const logoWhite = dataUri(path.join(ROOT, "public/mascot/logo-horizontal-white.png"), "image/png");
const mascotDone = dataUri(path.join(ROOT, "public/mascot/Aprovando.svg"), "image/svg+xml");
const today = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

const REQUEST = `POST https://luumu.com.br/api/v1/notifications/webhook?key=pk_...
Content-Type: application/json
X-Luumu-Timestamp: 1764162000          # segundos desde 1970 (UTC)
X-Luumu-Signature: sha256=9f2c...      # HMAC-SHA256(segredo, "timestamp." + corpo)`;

const PAYLOAD = `{
  "id": "evt_01JDX8K4R2",                  // único por evento
  "event": "activity.assigned",
  "occurredAt": "2026-11-26T10:00:00-03:00",
  "activity": {
    "id": "t123",
    "type": "tarefa",                      // ou "prova_genial"
    "title": "Frações e decimais",
    "subject": "Matemática",
    "url": "/instituicao/assignments/t123",
    "assignedAt": "2026-11-26T10:00:00-03:00",
    "dueAt": "2026-12-03T23:59:00-03:00"
  },
  "classIds": ["6A-2026", "6B-2026"]
}`;

const NODE = `import crypto from "node:crypto";

const URL = process.env.LUUMU_WEBHOOK_URL;       // ...webhook?key=pk_...
const SECRET = process.env.LUUMU_WEBHOOK_SECRET; // whsec_...

export async function sendToLuumu(payload) {
  const body = JSON.stringify(payload);          // assine e envie ESTA string
  const ts = Math.floor(Date.now() / 1000);
  const signature = "sha256=" + crypto
    .createHmac("sha256", SECRET).update(\`\${ts}.\${body}\`).digest("hex");
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json",
               "X-Luumu-Timestamp": String(ts), "X-Luumu-Signature": signature },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}`;

const PYTHON = `import hashlib, hmac, json, os, time, requests

def send_to_luumu(payload: dict):
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    ts = str(int(time.time()))
    sig = hmac.new(os.environ["LUUMU_WEBHOOK_SECRET"].encode(),
                   f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()
    r = requests.post(os.environ["LUUMU_WEBHOOK_URL"], data=body.encode(), timeout=10,
                      headers={"Content-Type": "application/json",
                               "X-Luumu-Timestamp": ts, "X-Luumu-Signature": f"sha256={sig}"})
    return r.status_code, (r.json() if r.content else None)`;

const PHP = `$body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$ts = (string) time();
$sig = 'sha256=' . hash_hmac('sha256', $ts . '.' . $body, getenv('LUUMU_WEBHOOK_SECRET'));
// POST $body para getenv('LUUMU_WEBHOOK_URL') com os cabeçalhos
// Content-Type, X-Luumu-Timestamp: $ts e X-Luumu-Signature: $sig`;

const IDENTIFY = `// depois do login E ao reabrir o app com a sessão já ativa
Luumu.identify({
  id: String(estudante.id),                       // obrigatório
  email: estudante.email,                         // opcional
  school_year: estudante.anoEscolar,              // opcional (recados)
  class_ids: estudante.turmas.map((t) => String(t.id)), // NOVO: as turmas
});

// no logout
Luumu.reset();`;

const RESPONSE = `{ "ok": false, "results": [
  { "id": "evt_1", "status": "applied" },
  { "id": "evt_2", "status": "invalid", "error": "\\"activity.title\\" é obrigatório." }
] }`;

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Luumu — Avisos automáticos no GenieX: guia de integração</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=block" rel="stylesheet">
<style>
:root{
  --brand:#6B2BD9; --deep:#1B0B4A; --deep-2:#2F2465; --lilac:#F3EDFF;
  --green:#88D029; --green-d:#4E9E2D;
  --ink:#1F2340; --soft:#4B5068; --mut:#7A7F96; --line:#E6E3F0; --paper:#FFFFFF; --sunken:#F7F6FB;
  --display:"Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif; --body:"Inter",ui-sans-serif,system-ui,sans-serif; --mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
}
@page{ size:A4; margin:18mm 17mm 20mm;
  @bottom-left{ content:"Luumu · Avisos automáticos no GenieX · Guia de integração"; font:500 7.5pt/1 "Inter",sans-serif; color:#9A9EB3 }
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
.cover .title{ position:absolute; top:48mm; left:18mm; width:122mm }
.eyebrow{ display:inline-flex; align-items:center; gap:2mm; font:700 8.5pt/1 var(--display); letter-spacing:.12em; text-transform:uppercase; color:var(--green) }
.cover h1{ margin:5mm 0 0; font:800 33pt/1.04 var(--display); letter-spacing:-.02em }
.cover h1 em{ font-style:normal; color:#C9A8FF }
.cover p.lead{ margin:6mm 0 0; font:400 11.5pt/1.5 var(--body); color:rgba(255,255,255,.78); width:108mm }
.stage{ position:absolute; left:0; right:0; top:126mm; height:134mm }
.shot{ position:absolute; right:16mm; top:4mm; width:84mm; aspect-ratio:600/580; border-radius:5mm; overflow:hidden; background:#fff; border:1px solid rgba(255,255,255,.35); transform:rotate(2deg) }
.shot img{ width:100%; display:block }
.plate{ position:absolute; right:12mm; top:9mm; width:84mm; aspect-ratio:600/580; border-radius:5mm; background:#0E0628; opacity:.55; transform:rotate(2deg) }
.json{ position:absolute; left:14mm; top:22mm; width:88mm; white-space:pre; border-radius:4mm; background:rgba(14,6,40,.72); border:1px solid rgba(255,255,255,.14); padding:4mm 4.6mm; font:400 7.6pt/1.6 var(--mono); color:#E9E6F7; transform:rotate(-2deg) }
.json .s{ color:#B9F27C } .json .k{ color:#C9A8FF } .json .h{ display:block; font:700 7pt/1 var(--display); letter-spacing:.12em; text-transform:uppercase; color:var(--green); margin-bottom:2.6mm }
.tag{ position:absolute; display:flex; align-items:center; gap:2mm; padding:2.4mm 3.6mm; border-radius:99px; background:#fff; color:var(--deep); font:700 8pt/1 var(--display); border:1.5px solid #C9A8FF }
.tag svg{ color:var(--brand); width:14px; height:14px }
.tag.t1{ left:20mm; top:96mm } .tag.t2{ left:52mm; top:108mm } .tag.t3{ left:30mm; top:120mm }
.cover footer{ position:absolute; left:18mm; right:18mm; bottom:14mm; display:flex; justify-content:space-between; align-items:flex-end; font:500 8pt/1.4 var(--body); color:rgba(255,255,255,.6) }
.cover footer b{ display:block; font:700 9pt/1.3 var(--display); color:#fff }

/* ---------- páginas ---------- */
.chapter{ margin-top:12mm }
.chapter-head{ break-inside:avoid; break-after:avoid }
.keep{ break-inside:avoid }
.page-break{ break-before:page }
.kicker{ display:flex; align-items:center; gap:2.4mm; font:700 8pt/1 var(--display); letter-spacing:.14em; text-transform:uppercase; color:var(--brand) }
.kicker i{ display:inline-grid; place-items:center; width:6.5mm; height:6.5mm; border-radius:2mm; background:var(--brand); color:#fff; font:800 9pt/1 var(--display); font-style:normal; letter-spacing:0 }
h2{ margin:2.5mm 0 1.5mm; font:800 20pt/1.15 var(--display); color:var(--ink); letter-spacing:-.015em }
h2 + .sub{ margin:0 0 5mm; font-size:10.2pt; color:var(--mut); max-width:155mm }
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
.grid2{ display:grid; grid-template-columns:1fr 1fr; gap:4mm } .grid3{ display:grid; grid-template-columns:repeat(3,1fr); gap:3mm } .grid4{ display:grid; grid-template-columns:repeat(4,1fr); gap:3mm }
.notice .ic{ width:8mm; height:8mm } .notice b{ font-size:9.8pt } .notice p{ font-size:8.4pt; line-height:1.45 }
.notice.t .ic{ background:#D5F2EE; color:#0F766E } .notice.p .ic{ background:#E3E1FB; color:#5B50E6 } .notice.d .ic{ background:#FDE6D8; color:#C2410C }
.steps{ counter-reset:s; display:grid; grid-template-columns:1fr 1fr; gap:3mm; margin-bottom:2mm }
.steps .card{ position:relative; padding:3.4mm 4mm 3.4mm 14mm }
.steps .card b{ font-size:10pt; margin-bottom:.8mm }
.steps .card::before{ counter-increment:s; content:counter(s); position:absolute; left:4mm; top:3.6mm; width:7mm; height:7mm; border-radius:50%; background:var(--brand); color:#fff; font:800 9pt/7mm var(--display); text-align:center }
.side{ border:1px solid var(--line); border-radius:4mm; overflow:hidden; break-inside:avoid }
.side > header{ display:flex; align-items:center; gap:2.6mm; padding:3.2mm 4mm; background:var(--lilac); color:var(--deep); font:800 11pt/1.2 var(--display) }
.side > header svg{ color:var(--brand) } .side > header span{ margin-left:auto; font:600 7.8pt/1 var(--body); color:var(--brand) }
.side.l > header{ background:linear-gradient(150deg,#2A1270,#1B0B4A); color:#fff } .side.l > header svg{ color:var(--green) } .side.l > header span{ color:#C9A8FF }
.side .body{ padding:3.4mm 4mm 1mm }
.side h4{ margin:0 0 2mm; font:700 7.4pt/1 var(--display); letter-spacing:.12em; text-transform:uppercase; color:var(--mut) }
.checks{ list-style:none; margin:0 0 3mm; padding:0 } .checks li{ display:flex; gap:2.6mm; align-items:flex-start; margin-bottom:2mm; break-inside:avoid; font-size:8.9pt; line-height:1.45 }
.checks li span.b{ flex:none; display:grid; place-items:center; width:5mm; height:5mm; border-radius:1.4mm; background:var(--green); color:#fff; margin-top:.2mm }
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
.pill{ display:inline-block; font:600 7.8pt/1 var(--mono); padding:1.3mm 2.2mm; border-radius:99px; background:var(--lilac); color:var(--brand); white-space:nowrap }
.pill.g{ background:#EEF8E1; color:#3F7F1E } .pill.p{ background:#FDE7EF; color:#B3184F } .pill.n{ background:#EEF0F5; color:#5B6075 } .pill.o{ background:#FDE6D8; color:#B4501C }
.note{ font-size:8pt; color:var(--mut); margin-top:-3mm }
.faq b{ display:block; color:var(--ink); font:700 9.6pt/1.35 var(--display); margin-bottom:1mm }
.faq > div{ break-inside:avoid; margin-bottom:3.4mm }
.end{ display:flex; gap:6mm; align-items:center; margin-top:4mm }
.end img{ width:38mm; flex:none }
</style></head>
<body>

<!-- ============================== CAPA ============================== -->
<section class="cover">
  <div class="dots"></div>
  <div class="ring" style="width:150mm;height:150mm;right:-60mm;top:-50mm"></div>
  <div class="ring" style="width:220mm;height:220mm;right:-95mm;top:-85mm"></div>
  <header><img src="${logoWhite}" alt="Luumu"><span>Guia de integração · v1</span></header>
  <div class="title">
    <div class="eyebrow">${I.bell} Notificações no GenieX</div>
    <h1>Avisos automáticos de <em>tarefas e provas</em></h1>
    <p class="lead">Quando o GenieX libera uma Tarefa ou uma Prova Genial, o sino de cada estudante da turma avisa, lembra do prazo e sai do caminho quando ele conclui.</p>
  </div>
  <div class="stage">
    <div class="json"><span class="h">Back-end do GenieX → Luumu</span>{
  <span class="k">"event"</span>: <span class="s">"activity.assigned"</span>,
  <span class="k">"activity"</span>: {
    <span class="k">"id"</span>: <span class="s">"t123"</span>, <span class="k">"type"</span>: <span class="s">"tarefa"</span>,
    <span class="k">"title"</span>: <span class="s">"Frações e decimais"</span>,
    <span class="k">"dueAt"</span>: <span class="s">"2026-12-03T23:59-03:00"</span> },
  <span class="k">"classIds"</span>: [<span class="s">"6A-2026"</span>, <span class="s">"6B-2026"</span>]
}</div>
    <div class="plate"></div>
    <div class="shot"><img src="${shotBell}" alt="Sino com avisos automáticos"></div>
    <div class="tag t1">${I.webhook} Webhook assinado</div>
    <div class="tag t2">${I.users} Uma lista por turma, na CDN</div>
    <div class="tag t3">${I.done} Some quando o estudante conclui</div>
  </div>
  <footer>
    <div><b>Para a engenharia da Jovens Gênios</b>O que cada lado faz, a especificação do webhook e como testar.</div>
    <div style="text-align:right"><b>luumu.com.br</b>${esc(today)}</div>
  </footer>
</section>

<!-- ============================== VISÃO GERAL ============================== -->
<section>
  <div class="chapter-head">
  <div class="kicker"><i>0</i> Visão geral</div>
  <h2>O que o estudante vê</h2>
  <p class="sub">Avisos dentro do produto, no sino do header, só com o estudante logado. Sem push no celular e sem e-mail.</p>
  </div>
  <div class="grid3">
    <div class="card notice t"><div class="ic">${I.tarefa}</div><b>Nova tarefa</b><p>Assim que a tarefa é liberada para uma turma dele. Fica por ${NEW_DAYS} dias, até ele concluir ou até o prazo vencer.</p></div>
    <div class="card notice p"><div class="ic">${I.prova}</div><b>Nova Prova Genial</b><p>A mesma regra, com ícone e texto próprios.</p></div>
    <div class="card notice d"><div class="ic">${I.prazo}</div><b>Falta 1 dia</b><p>24h antes do prazo (configurável: ${DUE_OPTS}). Some quando ele conclui ou quando o prazo vence.</p></div>
  </div>
  <p style="margin-top:3mm">Clicar no aviso abre a atividade no próprio GenieX. Os <strong>recados</strong> escritos pela equipe no painel da Luumu continuam no mesmo sino.</p>

  <h3>Como funciona</h3>
  <div class="flow">
    <div class="card"><div class="ic">${I.server}</div><small>GenieX → Luumu</small><b>O GenieX avisa</b><p>A cada atividade liberada, alterada ou cancelada, o back-end manda um POST assinado com as <strong>turmas</strong> que a recebem. Nenhum dado de estudante.</p></div>
    <div class="arrow">${I.arrow}</div>
    <div class="card"><div class="ic">${I.database}</div><small>Luumu</small><b>A Luumu guarda</b><p>Confere a assinatura, descarta envios repetidos e grava uma linha por atividade, com as turmas.</p></div>
    <div class="arrow">${I.arrow}</div>
    <div class="card dark"><div class="ic">${I.bell}</div><small>Navegador</small><b>O sino decide</b><p>Pelo <code>class_ids</code> do identify, busca a lista da turma e calcula, para aquele estudante, o que é novo e o que está perto do prazo.</p></div>
  </div>
  <div class="callout green">${I.done}<p><strong>A conclusão é detectada sozinha.</strong> Quando o estudante chega à tela de resultado (<code>…/assignments/&lt;id&gt;/complete</code> ou <code>…/avaliacoes/&lt;id&gt;/results</code>), o aviso sai do sino dele. São as mesmas telas que o Analytics da Luumu já reconhece como "Concluiu".</p></div>

  <div class="keep"><h3>Quanto tempo leva</h3>
  ${table(
    [
      { t: "Situação", w: 64 },
      { t: "Atraso até o aviso aparecer", w: 36 },
    ],
    [
      ["Estudante que abre o GenieX depois da liberação", "até ~2 minutos (cache da CDN)"],
      ["Estudante que já está com o GenieX aberto", "até ~7 minutos (cache + nova busca a cada 5 min)"],
      ["Lembrete de prazo", "na hora (calculado no navegador a cada minuto)"],
      ["Ligar ou desligar os avisos no painel da Luumu", "até ~20 minutos (configuração do SDK)"],
    ]
  )}</div>
</section>

<!-- ============================== RESPONSABILIDADES ============================== -->
<section class="chapter page-break">
  <div class="chapter-head">
  <div class="kicker"><i>1</i> Responsabilidades</div>
  <h2>Quem faz o quê</h2>
  <p class="sub">A Luumu cuida do sino, das regras, dos textos e do painel. A Jovens Gênios avisa as atividades e diz quais são as turmas de cada estudante.</p>
  </div>
  <div class="grid2">
    <div class="side">
      <header>${I.school} Jovens Gênios <span>~1 a 2 dias</span></header>
      <div class="body">
        <h4>Back-end</h4>
        ${checks([
          "Guardar o **segredo do webhook** no cofre de segredos do back-end, nunca no front-end.",
          "Enviar `activity.assigned` quando uma Tarefa ou Prova Genial for liberada para turmas.",
          "Enviar `activity.updated` quando mudar título, prazo, link ou turmas.",
          "Enviar `activity.canceled` quando a atividade for cancelada ou excluída.",
          "Assinar cada envio e gerar um `id` único por evento.",
          "Tentar de novo em 5xx, 429 ou falha de rede, com **assinatura nova** a cada tentativa.",
          "Fazer a **carga inicial** das atividades em aberto no lançamento.",
        ])}
        <h4>Front-end</h4>
        ${checks([
          "Incluir `class_ids` (todas as turmas do estudante) no `Luumu.identify`.",
          "Chamar `Luumu.reset()` no logout.",
          'Colocar `<div id="luumu-bell"></div>` no header do ambiente logado.',
          "(Opcional) `Luumu.notifications.complete(id)` se houver entrega fora das telas de resultado.",
          "(Se usarem CSP) liberar `https://luumu.com.br` em `script-src` e `connect-src`.",
        ])}
      </div>
    </div>
    <div class="side l">
      <header>${I.bell} Luumu <span>pronto</span></header>
      <div class="body">
        <h4>Recebimento e dados</h4>
        ${checks(
          [
            `Webhook com assinatura e janela de ${MIN} minutos.`,
            "Descarte de repetidos pelo `id` e ordem pelo `occurredAt`.",
            "Recusa de dados inválidos, com o motivo na resposta e no painel.",
            "Uma linha por atividade e limpeza automática do que encerrou.",
          ],
          false
        )}
        <h4>Sino</h4>
        ${checks(
          [
            "Lista de cada turma com cache na CDN.",
            "Regras de nova, prazo e conclusão; textos e ícones.",
            "Métricas por atividade: recebido, visto, clicado.",
          ],
          false
        )}
        <h4>Painel e operação</h4>
        ${checks(
          [
            "Aba **Avisos automáticos**: liga/desliga, antecedência, URL, segredo, últimos envios, atividades.",
            "Gerar o segredo e entregar à engenharia (canal seguro).",
            "Acompanhar a homologação e o piloto, e ligar em produção.",
          ],
          false
        )}
      </div>
    </div>
  </div>
</section>

<!-- ============================== WEBHOOK ============================== -->
<section class="chapter page-break">
  <div class="chapter-head">
  <div class="kicker"><i>2</i> Webhook</div>
  <h2>O que o back-end envia</h2>
  <p class="sub">Um POST por mudança. Cada evento é a <strong>fotografia completa</strong> da atividade naquele momento, não uma lista de diferenças.</p>
  </div>
  ${code(REQUEST, "Requisição")}
  <p><code>key</code> é a mesma chave pública (<code>pk_...</code>) que o SDK já usa no GenieX. A URL completa, já com a chave, está no painel da Luumu, em Notificações → Avisos automáticos. Homologação e produção usam projetos e segredos diferentes.</p>
  ${code(PAYLOAD, "Corpo (application/json)")}
  <p class="note">Também vale um lote: <code>{ "events": [ … ] }</code>, com 1 a ${MAX_EVENTS_PER_REQUEST} eventos e até ${MAX_BODY_BYTES / 1024} KB.</p>

  <div style="margin-top:5mm">
  ${table(
    [
      { t: "Campo", w: 20, mono: true },
      { t: "Obrigatório", w: 13 },
      { t: "O que é", w: 67 },
    ],
    [
      ["id", "sim", `Único por evento (até ${ACTIVITY_LIMITS.id} caracteres). **Nova tentativa usa o mesmo id**: a Luumu ignora o repetido.`],
      ["event", "sim", "`activity.assigned`, `activity.updated` ou `activity.canceled`."],
      ["occurredAt", "sim", "Hora da mudança no GenieX, em ISO 8601 **com fuso** (`-03:00` ou `Z`). Define a ordem."],
      ["activity.id", "sim", "Id estável da atividade: o mesmo que aparece na URL dela."],
      ["activity.type", "sim*", "`tarefa` ou `prova_genial`: define o ícone e o texto."],
      ["activity.title", "sim*", `Mostrado ao estudante (até ${ACTIVITY_LIMITS.title} caracteres). **Sem dados pessoais.**`],
      ["activity.subject", "não", `Matéria (até ${ACTIVITY_LIMITS.subject} caracteres): "Matemática · Frações…".`],
      ["activity.url", "sim*", "Página da atividade, começando com `/` (ex.: `/instituicao/assignments/t123`). É por ela que a conclusão é reconhecida."],
      ["activity.assignedAt", "não", "Quando a atividade fica disponível. Sem ele, vale o `occurredAt`. Se for no futuro, o aviso aparece só nessa hora."],
      ["activity.dueAt", "não", "Prazo (ISO 8601 com fuso) ou `null`. Sem prazo, não há lembrete."],
      ["classIds", "sim*", `Turmas que recebem a atividade (até ${ACTIVITY_LIMITS.classes}, ${ACTIVITY_LIMITS.classId} caracteres cada). **Os mesmos ids do \`class_ids\` do front-end**, caractere por caractere.`],
    ]
  )}
  <p class="note">* Em <code>activity.canceled</code> bastam <code>id</code>, <code>event</code>, <code>occurredAt</code> e <code>activity.id</code>.</p>
  </div>

  <div class="keep"><h3>Assinatura</h3>
  <div class="callout">${I.key}<p><strong>X-Luumu-Signature = "sha256=" + hex(HMAC-SHA256(segredo, timestamp + "." + corpo))</strong>. O corpo entra exatamente como vai na requisição: serialize uma vez, assine e envie essa mesma string. O timestamp vale por ${MIN} minutos (mantenham o NTP ativo). É o mesmo formato que a Luumu usa nos webhooks que ela envia.</p></div></div>
  ${code(NODE, "Node.js")}
  ${code(PYTHON, "Python")}
  ${code(PHP, "PHP")}
</section>

<!-- ============================== EVENTOS ============================== -->
<section class="chapter">
  <div class="chapter-head">
  <div class="kicker"><i>3</i> Eventos</div>
  <h2>Quando mandar cada evento</h2>
  <p class="sub">Três eventos cobrem o ciclo da atividade. A ordem vale pelo <code>occurredAt</code>, e não pela ordem de chegada.</p>
  </div>
  ${table(
    [
      { t: "Evento", w: 24, raw: true },
      { t: "Quando mandar", w: 38 },
      { t: "O que a Luumu faz", w: 38 },
    ],
    [
      [pill("activity.assigned", "g"), "Liberada para uma ou mais turmas. `classIds` não pode ser vazio.", "Grava. Os estudantes das turmas passam a ver **Nova tarefa** ou **Nova Prova Genial**."],
      [pill("activity.updated"), "Mudou título, prazo, link ou turmas. Mande a fotografia completa, com a lista **inteira** de turmas.", "Substitui tudo. Turma que saiu deixa de ver; turma nova vê como nova; prazo novo reprograma o lembrete."],
      [pill("activity.canceled", "p"), "Cancelada, excluída ou despublicada.", "Some do sino de todos."],
    ]
  )}
  <div class="grid2">
    <div class="card"><b>Liberar para mais uma turma</b><p><code>activity.updated</code> com a lista completa (<code>["6A","6B","6C"]</code>). Só a 6C recebe "Nova tarefa".</p></div>
    <div class="card"><b>Adiar o prazo</b><p><code>activity.updated</code> com o <code>dueAt</code> novo. O lembrete passa a seguir o prazo novo.</p></div>
    <div class="card"><b>Reabrir uma cancelada</b><p><code>activity.updated</code> com <code>occurredAt</code> mais recente que o do cancelamento.</p></div>
    <div class="card"><b>Não sabe se a Luumu já conhece</b><p>Pode mandar <code>activity.updated</code>: a Luumu cria a atividade se ela não existir.</p></div>
  </div>

  <div class="keep"><h3>Repetição e ordem</h3>
  ${checks(
    [
      "O mesmo `id` de evento enviado de novo responde `duplicate` e não muda nada. Por isso a nova tentativa usa o **mesmo** `id`.",
      "Um evento com `occurredAt` **mais antigo** que o último aplicado responde `stale` e é ignorado. Um `assigned` atrasado não desfaz um cancelamento.",
      "Cada mudança precisa de um `id` novo, por exemplo `<id da atividade>-<versão>` ou um UUID gravado com o evento na fila.",
    ],
    false
  )}</div>

  <div class="keep"><h3>Respostas e novas tentativas</h3>
  ${table(
    [
      { t: "Resposta", w: 13, mono: true },
      { t: "Significado", w: 50 },
      { t: "O que fazer", w: 37 },
    ],
    [
      ["200", "Todos aceitos. Em `results`, cada evento vem como `applied`, `stale` ou `duplicate`.", "Nada."],
      ["422", "Algum evento recusado; `results` diz qual e por quê. **Os outros do lote foram aplicados.**", "Corrigir e mandar só o recusado, com `id` novo."],
      ["400", "JSON inválido.", "Corrigir a serialização."],
      ["401", "Chave inválida, segredo não gerado, assinatura errada ou timestamp fora da janela. A mensagem diz qual.", "Conferir chave, segredo, corpo assinado e relógio."],
      ["413", `Corpo acima de ${MAX_BODY_BYTES / 1024} KB.`, "Lotes menores."],
      ["429", "Mais de 600 requisições por minuto no projeto.", "Tentar de novo depois."],
      ["5xx / rede", "Problema do lado da Luumu ou da rede.", "**Tentar de novo.**"],
    ]
  )}</div>
  ${code(RESPONSE, "Exemplo de resposta 422")}
  <div class="callout">${I.refresh}<p><strong>Novas tentativas só para 5xx, 429 e falha de rede</strong>, numa fila e sem segurar a requisição do professor. Sugestão: 5 tentativas em ~2h (1, 5, 15, 30 e 60 min), sempre com o mesmo <code>id</code> e com <strong>timestamp e assinatura novos</strong>. 4xx não se resolve tentando de novo: é erro de integração e aparece no painel da Luumu.</p></div>

  <div class="keep"><h3>Carga inicial</h3>
  <p>No lançamento, mandem um <code>activity.assigned</code> para cada atividade ainda em aberto, isto é, liberada e com prazo no futuro (ou sem prazo, liberada nos últimos 30 dias):</p>
  ${checks(
    [
      `Com o \`assignedAt\` **real**. A Luumu só trata como nova o que foi liberado nos últimos ${NEW_DAYS} dias, e no primeiro acesso de cada estudante só acende o sino com o liberado nas últimas ${FRESH_H}h. Assim ninguém recebe uma enxurrada de novidades.`,
      `Em lotes de até ${MAX_EVENTS_PER_REQUEST} eventos, abaixo de 600 requisições por minuto (um lote a cada ~200 ms já basta).`,
      "Com `id` estável, por exemplo `backfill-<id da atividade>`: rodar a carga duas vezes não duplica nada.",
    ],
    false
  )}</div>
</section>

<!-- ============================== FRONT-END ============================== -->
<section class="chapter page-break">
  <div class="chapter-head">
  <div class="kicker"><i>4</i> Front-end</div>
  <h2>O que muda nas telas do GenieX</h2>
  <p class="sub">O SDK já está instalado. Ele passa a receber as turmas no identify, e o header ganha o lugar do sino.</p>
  </div>
  ${code(IDENTIFY, "Luumu.identify com as turmas")}
  ${checks(
    [
      "`class_ids` usa **os mesmos ids** que o back-end manda em `classIds`: `6A-2026` e `6a-2026` são turmas diferentes.",
      `Use ids opacos, como o id da turma no banco, e não nomes de pessoas. A Luumu usa até ${MAX_STUDENT_CLASSES} turmas por estudante.`,
      "Mudou de turma no meio da sessão? Chame o `identify` de novo; o sino troca na hora.",
      "Computador compartilhado: depois do `Luumu.reset()`, o próximo estudante vê só as atividades e as conclusões dele.",
    ],
    false
  )}

  <div><h3>Lugar do sino</h3>
  ${code(`<!-- no header do ambiente logado, junto dos ícones à direita -->
<div id="luumu-bell"></div>

<!-- com SSR/hidratação (Next.js e similares) -->
<div id="luumu-bell" suppressHydrationWarning />`, "HTML")}
  <p>O elemento entra só nas telas logadas e fica vazio. O sino tem 38×38 px, usa a cor do texto do header e fica num Shadow DOM: o CSS do GenieX não afeta o sino e vice-versa. Se o header for remontado numa troca de rota, o sino volta sozinho.</p></div>

  <div><h3>Conclusão</h3>
  ${table(
    [
      { t: "Tipo", w: 18 },
      { t: "Link enviado (activity.url)", w: 41, mono: true },
      { t: "Tela que conta como concluída", w: 41, mono: true },
    ],
    [
      ["Tarefa", "/instituicao/assignments/t123", "/instituicao/assignments/t123/complete"],
      ["Prova Genial", "/instituicao/avaliacoes/p45", "/instituicao/avaliacoes/p45/results"],
    ]
  )}
  <p class="note">As variantes em inglês (<code>/institutions/assignments/…</code> e <code>/institutions/summative-assessments/…</code>) também contam.</p>
  ${code(`// entrega por outro caminho (app, outra tela): avise do lado do navegador
window.Luumu?.notifications?.complete?.("t123"); // o mesmo id do webhook`, "Opcional")}
  </div>
  <div class="callout">${I.monitor}<p><strong>Limitação desta versão:</strong> a conclusão é guardada no navegador. Se o estudante concluir no celular, o computador da escola ainda mostra o aviso até o prazo vencer ou ele abrir a tela de resultado ali.</p></div>
</section>

<!-- ============================== PAINEL E TESTES ============================== -->
<section class="chapter">
  <div class="chapter-head">
  <div class="kicker"><i>5</i> Painel e testes</div>
  <h2>Acompanhar, testar e colocar no ar</h2>
  <p class="sub">Tudo fica em Notificações → <strong>Avisos automáticos</strong>, no painel da Luumu. O sino precisa estar ligado na aba Sino e instalação, na plataforma certa.</p>
  </div>
  ${table(
    [
      { t: "No painel", w: 26 },
      { t: "Para que serve", w: 56 },
      { t: "Quem", w: 18 },
    ],
    [
      ["Avisos automáticos", `Ligar e desligar, avisar novas e escolher a antecedência do prazo (${DUE_OPTS} ou não avisar).`, "Editores e admins"],
      ["Conexão com o produto", "URL do webhook com a chave; atividades em aberto; eventos aceitos e recusados nas últimas 24h.", "Todos"],
      ["Segredo de assinatura", "Gerar, mostrar e copiar. **Trocar** mantém o anterior válido por 24h, sem perder envios.", "Donos e admins"],
      ["Ver como uma turma", "Digite o id de uma turma e veja o que o sino dos estudantes dela recebe agora.", "Todos"],
      ["Últimos envios", "Os 30 eventos mais recentes, com o resultado e o motivo de cada recusa.", "Todos"],
      ["Atividades recebidas", "As 50 mais recentes, com turmas, prazo, situação e métricas de cada aviso.", "Todos"],
    ]
  )}

  <h3>Roteiro em homologação</h3>
  <div class="steps">
    <div class="card"><b>Preparar (Luumu)</b><p>Domínio de homologação na chave do SDK, segredo gerado e entregue, sino e avisos ligados.</p></div>
    <div class="card"><b>Liberar uma tarefa</b><p>Para uma turma de teste, com prazo em menos de 24h. Em <em>Últimos envios</em>: <strong>Aplicado</strong>.</p></div>
    <div class="card"><b>Entrar como estudante</b><p>O sino mostra Nova tarefa e Falta 1 dia em até ~2 min. No console: <code>Luumu.notifications.debug()</code>.</p></div>
    <div class="card"><b>Concluir</b><p>Fazer a tarefa até <code>/complete</code>: os dois avisos saem do sino.</p></div>
    <div class="card"><b>Alterar e cancelar</b><p>Mudar o prazo (o lembrete segue o novo) e cancelar (some do sino; "cancelada" no painel).</p></div>
    <div class="card"><b>Simular falhas</b><p>Assinatura errada responde 401 ("Assinatura inválida" no painel); o mesmo evento duas vezes responde <code>duplicate</code>.</p></div>
  </div>

  <div class="keep"><h3>Checklist de aceite</h3>
  ${checks([
    "Liberar, alterar e cancelar geram eventos **Aplicados** em *Últimos envios*.",
    "Os ids de `classIds` (back-end) e de `class_ids` (front-end) batem, conforme `Luumu.notifications.debug()`.",
    "Estudante de outra turma não vê a atividade.",
    "Concluir tira o aviso; prazo vencido tira o aviso.",
    "Logout e login de outro estudante no mesmo computador mostram só as atividades dele.",
    "Nova tentativa depois de uma falha simulada não duplica (`duplicate`).",
    "Carga inicial feita: *Ver como uma turma* mostra as atividades em aberto.",
  ])}</div>

  <div class="keep"><h3>Implantação</h3>
  <div class="grid4">
    <div class="card"><small>Etapa 1</small><b>Homologação</b><p>Roteiro e checklist acima.</p></div>
    <div class="card"><small>Etapa 2</small><b>Produção desligada</b><p>Carga inicial; conferir no painel que as atividades chegaram.</p></div>
    <div class="card"><small>Etapa 3</small><b>Piloto</b><p>Uma escola por ~1 semana: <code>class_ids</code> só para os estudantes dela.</p></div>
    <div class="card dark"><small>Etapa 4</small><b>Todas as escolas</b><p><code>class_ids</code> para todos os estudantes.</p></div>
  </div></div>
</section>

<!-- ============================== DADOS E FAQ ============================== -->
<section class="chapter">
  <div class="chapter-head">
  <div class="kicker"><i>6</i> Dados e dúvidas</div>
  <h2>Privacidade, limites e perguntas frequentes</h2>
  </div>
  <div class="grid2">
    <div class="card"><div class="ic">${I.shield}</div><b>Dados e privacidade</b><p><strong>Nenhum dado de estudante vai pelo webhook</strong>: só a atividade e os ids das turmas. A lista da turma é lida por quem tem a chave pública do SDK e o id da turma, por isso títulos sem dados pessoais e ids de turma opacos. Do uso, a Luumu recebe só contadores por atividade e dia (recebido, visto, clicado), sem linha por estudante.</p></div>
    <div class="card"><div class="ic">${I.timer}</div><b>Retenção (limpeza diária)</b><p>Atividade com prazo vencido ou cancelada: apagada 30 dias depois, com as métricas. Sem prazo: 60 dias depois da liberação (sai do sino com 30). Registro de envios: 30 dias. No navegador ficam só as lidas e as concluídas de cada estudante.</p></div>
    <div class="card"><div class="ic">${I.users}</div><b>Fora desta versão</b><p>Atividade para <strong>alunos específicos</strong>, e não para a turma toda. Se for comum, dá para adicionar uma lista de alunos só para esses casos.</p></div>
    <div class="card"><div class="ic">${I.monitor}</div><b>Também fora</b><p>Conclusão sincronizada entre aparelhos (próximo passo: um evento <code>activity.completed</code> por estudante). Push no celular e e-mail, por decisão de produto.</p></div>
  </div>

  <h3>Perguntas frequentes</h3>
  <div class="faq">
    <div><b>E se a Luumu ficar fora do ar?</b>O webhook falha com 5xx ou por rede, e a fila de vocês tenta de novo. O GenieX segue normal; só o sino deixa de aparecer.</div>
    <div><b>E se mandarmos eventos antes de os avisos serem ligados?</b>A Luumu aceita e guarda. Quando ligar, o sino já mostra as atividades.</div>
    <div><b>Uma turma de 40 estudantes faz 40 requisições ao servidor?</b>Não. A lista da turma fica na CDN, e a função da Luumu roda no máximo uma vez a cada 2 minutos por turma.</div>
    <div><b>Posso mandar sempre <code>activity.updated</code>?</b>Pode. A diferença é que <code>assigned</code> exige pelo menos uma turma; os dois gravam a fotografia completa.</div>
    <div><b>O <code>id</code> do evento pode ser o id da atividade?</b>Não: cada mudança precisa de um <code>id</code> novo, senão a segunda é tomada por repetição.</div>
  </div>

  <div class="end">
    <div class="callout" style="flex:1;margin:0">${I.plug}<p><strong>Próximo passo:</strong> a Luumu gera o segredo e entrega a URL e o segredo à engenharia do GenieX por um canal seguro. A integração começa em homologação, com os avisos desligados em produção até o checklist de aceite estar completo.</p></div>
    <img src="${mascotDone}" alt="">
  </div>
</section>
</body></html>`;

const htmlFile = path.join(tmp, "doc.html");
fs.writeFileSync(htmlFile, html);
if (process.env.KEEP_HTML) fs.copyFileSync(htmlFile, process.env.KEEP_HTML);
chrome(["--no-pdf-header-footer", "--virtual-time-budget=15000", "--run-all-compositor-stages-before-draw", `--print-to-pdf=${out}`, `file://${htmlFile}`]);
if (process.env.KEEP_SHOT) fs.copyFileSync(path.join(tmp, "bell.png"), process.env.KEEP_SHOT);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`✓ ${path.relative(process.cwd(), out)}`);
