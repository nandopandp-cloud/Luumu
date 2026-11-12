/*
  Gera docs/accessibility/integracao-plataforma-externa.pdf — o que a plataforma externa precisa
  enviar ao SDK da Luumu e o que recebe dele (contrato em src/lib/accessibility/integration.ts).

    TSX_TSCONFIG_PATH=scripts/tsconfig.scripts.json node --import tsx scripts/a11y-integration-pdf.mjs [saída.pdf]

  As tabelas de campos e perfis vêm do código, então o PDF não fica desatualizado.
*/
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { PREF_FIELDS, PROFILE_REFERENCE } from "../src/lib/accessibility/integration.ts";

const out = process.argv[2] || "docs/accessibility/integracao-plataforma-externa.pdf";
const SUP = "/System/Library/Fonts/Supplemental";
const has = (f) => fs.existsSync(path.join(SUP, f));
const FONTS = has("Arial.ttf")
  ? { r: path.join(SUP, "Arial.ttf"), b: path.join(SUP, "Arial Bold.ttf"), m: path.join(SUP, "Courier New.ttf"), mb: path.join(SUP, "Courier New Bold.ttf") }
  : { r: "Helvetica", b: "Helvetica-Bold", m: "Courier", mb: "Courier-Bold" };

const C = { brand: "#6B2BD9", ink: "#1F2340", soft: "#4B5068", mut: "#7A7F96", line: "#E3E5EE", tint: "#F3EEFD", code: "#F5F6FA", warn: "#FEF3C7", warnInk: "#92400E" };
const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 56, left: 52, right: 52 }, info: { Title: "Plugin de Acessibilidade Luumu - Integração com plataforma externa", Author: "Luumu" } });
doc.registerFont("r", FONTS.r);
doc.registerFont("b", FONTS.b);
doc.registerFont("m", FONTS.m);
doc.registerFont("mb", FONTS.mb);
doc.pipe(fs.createWriteStream(out));

const L = doc.page.margins.left;
const W = doc.page.width - L - doc.page.margins.right;
const bottom = () => doc.page.height - doc.page.margins.bottom;
const ensure = (h) => {
  if (doc.y + h > bottom()) doc.addPage();
};

function h1(t) {
  ensure(60);
  doc.moveDown(0.6).font("b").fontSize(15).fillColor(C.brand).text(t, L, doc.y, { width: W });
  const y = doc.y + 3;
  doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1).strokeColor(C.line).stroke();
  doc.y = y + 8;
}
function h2(t) {
  ensure(40);
  doc.moveDown(0.4).font("b").fontSize(11.5).fillColor(C.ink).text(t, L, doc.y, { width: W });
  doc.moveDown(0.25);
}
function p(t, o = {}) {
  doc.font(o.bold ? "b" : "r").fontSize(o.size ?? 9.8).fillColor(o.color ?? C.soft).text(t, L, doc.y, { width: W, lineGap: 2.2, ...o.opts });
  doc.moveDown(0.45);
}
/** Texto com trechos `assim` em fonte de código e **assim** em negrito. */
function rich(t, x = L, width = W, size = 9.8) {
  const parts = t.split(/(`[^`]+`|\*\*[^*]+\*\*)/).filter(Boolean);
  doc.x = x;
  parts.forEach((s, i) => {
    const code = s.startsWith("`");
    const bold = s.startsWith("**");
    const txt = code ? s.slice(1, -1) : bold ? s.slice(2, -2) : s;
    doc.font(code ? "mb" : bold ? "b" : "r").fontSize(size).fillColor(code ? C.brand : bold ? C.ink : C.soft);
    // só a primeira parte leva posição e largura; as seguintes continuam a mesma linha
    if (i === 0) doc.text(txt, x, doc.y, { width, lineGap: 2.2, continued: parts.length > 1 });
    else doc.text(txt, { continued: i < parts.length - 1 });
  });
}
function bullets(items, o = {}) {
  items.forEach((t, i) => {
    ensure(24);
    const y = doc.y;
    const mark = o.numbered ? `${i + 1}.` : "•";
    doc.font("b").fontSize(9.8).fillColor(C.brand).text(mark, L + 4, y, { width: 16 });
    doc.y = y;
    rich(t, L + 20, W - 20);
    doc.moveDown(0.3);
  });
  doc.moveDown(0.2);
}
function code(src) {
  doc.font("m").fontSize(8.4);
  const h = doc.heightOfString(src, { width: W - 20, lineGap: 1.6 }) + 16;
  ensure(h + 6);
  const y = doc.y;
  doc.roundedRect(L, y, W, h, 6).fill(C.code);
  doc.fillColor(C.ink).font("m").fontSize(8.4).text(src, L + 10, y + 8, { width: W - 20, lineGap: 1.6 });
  doc.y = y + h + 8;
}
function note(t) {
  doc.font("r").fontSize(9.4);
  const h = doc.heightOfString(t.replace(/[`*]/g, ""), { width: W - 24, lineGap: 2 }) + 16;
  ensure(h + 6);
  const y = doc.y;
  doc.roundedRect(L, y, W, h, 6).fill(C.warn);
  doc.y = y + 8;
  doc.font("r").fontSize(9.4).fillColor(C.warnInk);
  const parts = t.split(/(`[^`]+`|\*\*[^*]+\*\*)/).filter(Boolean);
  parts.forEach((s, i) => {
    const c = s.startsWith("`");
    const b = s.startsWith("**");
    doc.font(c ? "mb" : b ? "b" : "r").fontSize(9.4).fillColor(C.warnInk);
    const txt = c ? s.slice(1, -1) : b ? s.slice(2, -2) : s;
    if (i === 0) doc.text(txt, L + 12, doc.y, { width: W - 24, lineGap: 2, continued: parts.length > 1 });
    else doc.text(txt, { continued: i < parts.length - 1 });
  });
  doc.y = y + h + 8;
}
/** cols: [{ t: título, w: fração, mono?: bool }] */
function table(cols, rows) {
  const ws = cols.map((c) => c.w * W);
  const pad = 5;
  const cellH = (txt, i, head) => {
    doc.font(head ? "b" : cols[i].mono ? "m" : "r").fontSize(head ? 8.6 : cols[i].mono ? 8.2 : 8.8);
    return doc.heightOfString(String(txt), { width: ws[i] - pad * 2, lineGap: 1.4 });
  };
  const drawRow = (cells, head) => {
    const h = Math.max(...cells.map((c, i) => cellH(c, i, head))) + pad * 2;
    if (doc.y + h > bottom()) {
      doc.addPage();
      if (!head) drawRow(cols.map((c) => c.t), true);
    }
    const y = doc.y;
    if (head) doc.rect(L, y, W, h).fill(C.tint);
    let x = L;
    cells.forEach((c, i) => {
      doc
        .font(head ? "b" : cols[i].mono ? "mb" : "r")
        .fontSize(head ? 8.6 : cols[i].mono ? 8.2 : 8.8)
        .fillColor(head ? C.brand : cols[i].mono ? C.ink : C.soft)
        .text(String(c), x + pad, y + pad, { width: ws[i] - pad * 2, lineGap: 1.4 });
      x += ws[i];
    });
    doc.moveTo(L, y + h).lineTo(L + W, y + h).lineWidth(0.6).strokeColor(C.line).stroke();
    doc.y = y + h;
  };
  ensure(60);
  drawRow(cols.map((c) => c.t), true);
  rows.forEach((r) => drawRow(r, false));
  doc.x = L;
  doc.moveDown(0.8);
}

/* ================================================================ capa */
doc.rect(0, 0, doc.page.width, 150).fill(C.brand);
doc.font("b").fontSize(10).fillColor("#E9DDFE").text("LUUMU  ·  PLUGIN DE ACESSIBILIDADE", L, 50, { characterSpacing: 1.2 });
doc.font("b").fontSize(22).fillColor("#FFFFFF").text("Integração com plataforma externa", L, 70, { width: W });
doc.font("r").fontSize(10.5).fillColor("#E9DDFE").text("O que enviar ao SDK para exibir o convite certo e como receber, em tempo real, cada ajuste feito pelo estudante.", L, 102, { width: W });
doc.y = 176;
doc.x = L;

p("Este documento é para o time técnico da plataforma que controla os estudantes (quem é convidado e onde ficam salvas as escolhas de acessibilidade). A Luumu exibe o botão, o painel de recursos e o convite dentro da página; a plataforma externa decide e guarda.");

h1("1. Visão geral");
bullets(
  [
    "O estudante entra na plataforma. A página chama `Luumu.accessibility.setUser({...})` com o que a plataforma sabe dele: se recebe o convite, quais perfis sugerir, o desfecho já registrado e a última configuração salva.",
    "O plugin aplica a configuração salva e, se for o caso, mostra o convite.",
    "Cada ajuste do estudante (ligar um recurso, aceitar ou recusar o convite, restaurar o padrão...) sai **na hora**: como evento no navegador e, se configurado, como webhook assinado para o backend da plataforma.",
    "A plataforma guarda a configuração mais recente. No próximo acesso, em qualquer aparelho ou navegador, ela devolve essa configuração no `setUser` e o estudante encontra tudo como deixou.",
  ],
  { numbered: true }
);
note("Nesse modo a Luumu **não guarda** lista de convidados nem preferências dos estudantes. Vale sempre a última configuração aplicada pelo estudante: guarde a do evento mais recente e envie de volta no `setUser`.");

h1("2. Configuração (uma vez)");
h2("No painel da Luumu (Acessibilidade)");
bullets([
  "**Ativação > Integração**: escolha **Plataforma externa**.",
  "**Ativação > Integração > Webhook** (recomendado): informe a URL https do backend da plataforma e clique em **Testar webhook** (deve responder 2xx).",
  "**Ativação > Verificação de identidade**: copie o **Segredo do projeto** e guarde no backend da plataforma (variável de ambiente). Ele confere a assinatura do webhook e, se a verificação for exigida, gera o `user_hash`.",
  "**Convite > Mostrar o convite**: ligado. Mensagem, ilustração e botões do convite continuam sendo configurados no painel.",
  "Clique em **Publicar**.",
]);
h2("Na página da plataforma");
ensure(70);
p("O SDK da Luumu precisa estar instalado (o mesmo script de sempre, antes do </head>):");
code(`<script src="https://luumu.com.br/sdk.js" data-luumu="SUA_CHAVE_PK" defer></script>`);
ensure(110);
p("Como o script usa defer, espere o SDK antes de chamá-lo:");
code(`function comLuumu(fn) {
  if (window.Luumu) fn(window.Luumu);
  else window.addEventListener("luumu:ready", () => fn(window.Luumu), { once: true });
}`);

h1("3. Entrada: o que a plataforma envia ao SDK");
p("Uma chamada por estudante logado, com todos os campos:");
code(`comLuumu((Luumu) => {
  Luumu.accessibility.setUser({
    id: "123456",                   // ID estável do estudante
    email: "ana@escola.sp.gov.br",  // opcional
    user_hash: "9f2c...",           // só com "Exigir verificação"
    invite: true,                   // mostrar o convite
    profiles: ["leitura", "foco"],  // perfis do convite
    status: "pending",              // desfecho já registrado
    // última configuração salva (seção 4)
    prefs: { textSize: 2, legibleFont: true, spacing: true, profiles: ["leitura"] },
  });
});`);
table(
  [
    { t: "Campo", w: 0.17, mono: true },
    { t: "Tipo", w: 0.15 },
    { t: "Obrigatório", w: 0.13 },
    { t: "O que é", w: 0.55 },
  ],
  [
    ["id", "texto ou número", "sim*", "Identificador estável do estudante. É ele que aparece em user.id nos eventos. *id ou email."],
    ["email", "texto", "sim*", "E-mail do estudante. *id ou email."],
    ["user_hash", "texto (hex)", "se exigido", "HMAC-SHA256 (segredo do projeto, id em minúsculas e sem espaços), em hexadecimal. Gerado no backend, nunca na página."],
    ["invite", "booleano", "sim", "true = este estudante recebe o convite. false = não recebe (o botão de acessibilidade continua disponível)."],
    ["profiles", "lista de ids", "não", "Perfis sugeridos no convite, na ordem (ver seção 5). Até 3 aparecem. Vazio = os perfis configurados no painel."],
    ["status", "texto", "não", '"pending" (não viu) | "shown" (viu e não respondeu) | "accepted" | "dismissed". Com "accepted" ou "dismissed" o convite não aparece de novo. Padrão: "pending".'],
    ["prefs", "objeto | null", "não", "Última configuração salva (formato da seção 4). Omitido ou null = estudante sem nada salvo ainda. Campos ausentes = padrão (desligado)."],
  ]
);
h2("Quando chamar (gatilhos)");
bullets([
  "**A cada carregamento de página com o estudante logado**, o quanto antes. Pode ser antes de o plugin terminar de carregar: o SDK guarda e entrega. O plugin espera até 10 segundos pelo `setUser` antes de desistir do convite naquela página.",
  "**Logo após o login sem recarregar a página** (aplicações de página única).",
  "**Quando algo mudar na plataforma** para esse estudante (por exemplo, passou a ser convidado). Pode chamar de novo a qualquer momento; o último valor vale.",
  "**No logout**: chame `Luumu.reset()`. As escolhas e o convite do estudante anterior saem da tela (importante em computadores compartilhados).",
]);
h2("Regras do convite");
p("O convite aparece somente quando todas as condições abaixo são verdadeiras:");
bullets([
  "`invite: true` e `status` igual a `pending` ou `shown`;",
  "o convite está ligado no painel da Luumu e o plugin está ativo para essa plataforma (domínio);",
  "o estudante ainda não tem nenhum recurso ligado;",
  "ainda não apareceu nesta sessão do navegador (no máximo uma vez por sessão).",
]);
p("Os perfis do convite já aparecem marcados. O estudante só aceita (liga todos) ou recusa. Os dois desfechos voltam para a plataforma na hora (seção 6).");
h2("Como o prefs recebido é aplicado");
bullets([
  "O plugin aplica o `prefs` recebido imediatamente e a página já abre com a configuração do estudante.",
  "Proteção contra cópia antiga: se o estudante mudou algo nesta página depois do último `setUser`, o próximo `setUser` não sobrescreve as escolhas (evita desfazer a mudança com um valor que ainda não incluía o ajuste). Os outros campos valem normalmente.",
]);

h1("4. Formato da configuração (prefs)");
p("O mesmo formato vale para a entrada (setUser) e para a saída (eventos). Guarde o objeto inteiro como veio no evento mais recente.");
table(
  [
    { t: "Campo", w: 0.22, mono: true },
    { t: "Tipo", w: 0.14 },
    { t: "Valores", w: 0.36 },
    { t: "Recurso", w: 0.28 },
  ],
  PREF_FIELDS.map((f) => [f.field, f.type, f.values, f.meaning])
);

h1("5. Perfis (ids)");
rich("Use os ids em `profiles` (setUser) e leia-os em `activeProfiles` e `prefs.profiles` (eventos). O título é o que o estudante vê no convite; o nome é o que aparece no painel lateral.");
doc.moveDown(0.45);
table(
  [
    { t: "id", w: 0.12, mono: true },
    { t: "Título no convite", w: 0.25 },
    { t: "Nome no painel", w: 0.25 },
    { t: "O que liga", w: 0.38 },
  ],
  PROFILE_REFERENCE.map((r) => [r.id, r.nudgeLabel, r.label, r.description])
);

h1("6. Saída: mudanças em tempo real");
p("Toda mudança feita no plugin gera um evento, no mesmo instante, por dois canais com o mesmo conteúdo e o mesmo id:");
h2("6.1 No navegador (front-end da plataforma)");
code(`window.addEventListener("luumu:accessibility", (e) => {
  const evento = e.detail;              // formato da tabela 6.4
  // ex.: enviar ao backend da plataforma
});

// ou, com o SDK carregado:
const parar = Luumu.accessibility.onChange((evento) => { /* ... */ });
// parar();                              // deixa de ouvir

// estado atual: { user, prefs, activeProfiles } (null antes de carregar)
Luumu.accessibility.getState();`);
h2("6.2 Webhook (backend da plataforma)");
p("Com a URL configurada no painel, a Luumu repassa cada evento para ela. Recomendado como fonte principal: chega mesmo se a página da plataforma não tratar o evento do navegador.");
table(
  [
    { t: "Item", w: 0.28, mono: true },
    { t: "Valor", w: 0.72 },
  ],
  [
    ["Método / corpo", "POST, JSON (application/json), formato da tabela 6.4"],
    ["X-Luumu-Event", "tipo do evento (ex.: prefs.updated)"],
    ["X-Luumu-Delivery", "id do evento (o mesmo do campo id do corpo)"],
    ["X-Luumu-Timestamp", "segundos desde 1970 (UTC) do envio"],
    ["X-Luumu-Signature", "sha256=<hex de HMAC-SHA256(segredo do projeto, \"<timestamp>.<corpo bruto>\")>"],
    ["User-Agent", "Luumu-Webhooks/1.0"],
    ["Resposta esperada", "2xx em até 5 segundos. Responda primeiro e processe depois."],
    ["Novas tentativas", "até 3 envios (na hora, +1 s, +4 s) em caso de falha de rede, timeout, 408, 429 ou 5xx. Outros 4xx não são repetidos."],
    ["Quem gera eventos", "só estudantes identificados (id ou email). Com \"Exigir verificação\", só com user_hash válido."],
  ]
);
h2("6.3 Tipos de evento (gatilhos)");
table(
  [
    { t: "event", w: 0.22, mono: true },
    { t: "Quando acontece", w: 0.78 },
  ],
  [
    ["prefs.updated", "Qualquer ajuste: ligar ou desligar um recurso, mudar o tamanho do texto, contraste, saturação ou daltonismo, ligar ou desligar um perfil, Restaurar padrão (tudo desligado), mover o botão de lugar e aceitar o convite (que liga os perfis). O campo changes diz o que mudou."],
    ["invite.shown", "O convite apareceu para o estudante."],
    ["invite.accepted", "O estudante aceitou o convite. Em seguida chega um prefs.updated com os perfis ligados."],
    ["invite.dismissed", "O estudante recusou o convite."],
    ["test", "Enviado pelo botão Testar webhook do painel. Pode ser ignorado."],
  ]
);
h2("6.4 Campos do evento");
table(
  [
    { t: "Campo", w: 0.2, mono: true },
    { t: "Tipo", w: 0.17 },
    { t: "O que é", w: 0.63 },
  ],
  [
    ["event", "texto", "Tipo do evento (tabela 6.3)."],
    ["id", "texto", "Id único do evento. Use para descartar repetidos (novas tentativas mandam o mesmo id)."],
    ["occurredAt", "texto ISO 8601", "Quando aconteceu no aparelho do estudante. Use para ordenar: vale o mais recente."],
    ["user.id", "texto | null", "ID do estudante (como veio no setUser / identify)."],
    ["user.email", "texto | null", "E-mail do estudante, se informado."],
    ["host", "texto", "Domínio da plataforma onde aconteceu (ex.: app.escola.com.br)."],
    ["prefs", "objeto", "Configuração completa do estudante já com a mudança (seção 4). É o que deve ser salvo."],
    ["activeProfiles", "lista de ids", "Perfis ligados no momento (igual a prefs.profiles)."],
    ["changes", "lista", "O que mudou neste evento: [{ field, from, to }]. Vazio nos eventos de convite."],
    ["invite", "objeto | null", "Nos eventos invite.*: { status, profiles } com o desfecho e os perfis mostrados. null nos demais."],
  ]
);
ensure(290);
p("Exemplo (corpo do webhook):", { bold: true, color: C.ink });
code(`{
  "event": "prefs.updated",
  "id": "5b0e8c2a-3f7d-4d55-9a1e-2c41f0b6a9d3",
  "occurredAt": "2026-11-12T14:03:27.512Z",
  "user": { "id": "123456", "email": "ana@escola.sp.gov.br" },
  "host": "app.escola.com.br",
  "prefs": { "readingMask": false, "readingGuide": false, "textReader": false,
             "legibleFont": true, "spacing": true, "textSize": 2, "contrast": "off",
             "saturation": "off", "colorBlind": "off", "highlightLinks": true,
             "highlightHeadings": false, "bigCursor": false, "stopAnimations": false,
             "focusRing": false, "libras": false, "profiles": ["leitura"],
             "launcherPos": null },
  "activeProfiles": ["leitura"],
  "changes": [{ "field": "highlightLinks", "from": false, "to": true }],
  "invite": null
}`);

h1("7. Conferir a assinatura do webhook");
bullets(
  [
    "Leia o corpo **bruto** (antes de converter de JSON).",
    "Calcule HMAC-SHA256 com o segredo do projeto sobre `<X-Luumu-Timestamp>.<corpo bruto>` e compare com `X-Luumu-Signature` (sem o prefixo sha256=), em tempo constante.",
    "Recuse se o timestamp tiver mais de 5 minutos de diferença do relógio do servidor.",
    "Descarte eventos com `id` já processado.",
  ],
  { numbered: true }
);
code(`// Node.js (Express)
import crypto from "node:crypto";
const bruto = express.raw({ type: "application/json" });
app.post("/webhooks/luumu-acessibilidade", bruto, (req, res) => {
  const ts = req.get("X-Luumu-Timestamp");
  const sig = (req.get("X-Luumu-Signature") || "").replace(/^sha256=/, "");
  const esperado = crypto.createHmac("sha256", process.env.LUUMU_A11Y_SECRET)
    .update(\`\${ts}.\${req.body}\`).digest("hex");
  const ok = sig.length === esperado.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado)) &&
    Math.abs(Date.now() / 1000 - Number(ts)) < 300;
  if (!ok) return res.sendStatus(401);
  res.sendStatus(204);                         // responda logo
  const evento = JSON.parse(req.body);
  salvarSeMaisRecente(evento);                 // ver seção 8
});`);
code(`# Python
import hmac, hashlib, time
def assinatura_valida(corpo: bytes, ts: str, assinatura: str, segredo: str) -> bool:
    msg = f"{ts}.".encode() + corpo
    esperado = hmac.new(segredo.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(assinatura.removeprefix("sha256="), esperado) \\
        and abs(time.time() - int(ts)) < 300`);

h1("8. O que a plataforma deve guardar");
table(
  [
    { t: "Ao receber", w: 0.25, mono: true },
    { t: "Faça", w: 0.75 },
  ],
  [
    ["prefs.updated", "Se occurredAt for mais recente que o salvo para esse estudante, substitua a configuração salva por prefs (objeto inteiro). Ela volta no próximo setUser como prefs."],
    ["invite.shown", "Registre status \"shown\" (se ainda for \"pending\")."],
    ["invite.accepted", "Registre status \"accepted\". Não volta atrás."],
    ["invite.dismissed", "Registre status \"dismissed\" (se não for \"accepted\")."],
  ]
);
p("Um estudante pode usar vários aparelhos ao mesmo tempo: comparar occurredAt garante que vale a última necessidade aplicada por ele.");

h1("9. Checklist");
bullets([
  "SDK instalado com a chave do projeto em todas as páginas logadas.",
  "Painel: Integração = Plataforma externa, convite ligado, webhook testado (2xx) e alterações publicadas.",
  "`setUser` chamado a cada página com id, invite, profiles, status e prefs salvos.",
  "`Luumu.reset()` no logout.",
  "Webhook confere assinatura e janela de 5 minutos, responde 2xx em até 5 s e descarta ids repetidos.",
  "Configuração salva só quando occurredAt for mais recente; status do convite atualizado nos eventos invite.*.",
  "Teste ponta a ponta: estudante convidado vê o convite, aceita; em outro navegador ou aparelho, a configuração aparece aplicada e o convite não volta.",
]);

doc.end();
console.log(`✓ ${out}`);
