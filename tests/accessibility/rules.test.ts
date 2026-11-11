/*
  Regras puras do plugin de acessibilidade (lib/accessibility): perfis rápidos, preferências,
  correção de daltonismo, público do convite, configuração e frequência do convite.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeCount,
  colorBlindMatrix,
  DEFAULT_PREFS,
  normalizePrefs,
  profileAvailable,
  toggleProfile,
  FEATURE_IDS,
} from "@/lib/accessibility/features";
import { matchesAnyGroup, matchesGroup, matchesStudentList, normalizeGroups, parseStudentList, normalizeValue } from "@/lib/accessibility/audience";
import { DEFAULT_A11Y_CONFIG, normalizeA11yConfig, publicA11yConfig, readableOn, safeImageUrl, librasLogoUrl, librasLook, shade } from "@/lib/accessibility/config";
import { nudgeDue, NUDGE_RETRY_MS, parseNudgeMemo } from "@/lib/accessibility/nudge";
import { safePersonalizationUrl, vlibrasPersonalizationJson, vlibrasRequestEmail } from "@/lib/accessibility/vlibras";

const allOn = Object.fromEntries(FEATURE_IDS.map((f) => [f, true]));

/* ---------------- perfis e preferências ---------------- */

test("ligar um perfil aplica o preset e registra o perfil", () => {
  const p = toggleProfile(DEFAULT_PREFS, "foco", allOn);
  assert.equal(p.readingMask, true);
  assert.equal(p.readingGuide, true);
  assert.equal(p.stopAnimations, true);
  assert.deepEqual(p.profiles, ["foco"]);
});

test("desligar um perfil preserva o que outro perfil ligado também define", () => {
  let p = toggleProfile(DEFAULT_PREFS, "foco", allOn); // stopAnimations
  p = toggleProfile(p, "calma", allOn); // stopAnimations + saturation low
  p = toggleProfile(p, "foco", allOn);
  assert.equal(p.readingMask, false);
  assert.equal(p.stopAnimations, true, "Tela mais calma continua pedindo animações pausadas");
  assert.equal(p.saturation, "low");
  assert.deepEqual(p.profiles, ["calma"]);
});

test("tamanho do texto: ligar perfil só aumenta; desligar volta ao maior entre os restantes", () => {
  let p = { ...DEFAULT_PREFS, textSize: 4 };
  p = toggleProfile(p, "leitura", allOn); // preset 2
  assert.equal(p.textSize, 4, "não diminui o que o estudante já tinha escolhido");
  p = toggleProfile({ ...DEFAULT_PREFS }, "leitura", allOn);
  p = toggleProfile(p, "visao", allOn); // preset 3
  assert.equal(p.textSize, 3);
  p = toggleProfile(p, "visao", allOn);
  assert.equal(p.textSize, 2, "sobra o tamanho de Mais conforto na leitura");
});

test("recurso desligado pelo cliente não entra no preset; perfil sem recurso some", () => {
  const enabled = { ...allOn, libras: false };
  assert.equal(profileAvailable("libras", enabled), false);
  const noMask = { ...allOn, readingMask: false };
  const p = toggleProfile(DEFAULT_PREFS, "foco", noMask);
  assert.equal(p.readingMask, false);
  assert.equal(p.readingGuide, true);
});

test("normalizePrefs descarta valores desconhecidos e limita o tamanho", () => {
  const p = normalizePrefs({ textSize: 99, contrast: "neon", libras: "sim", profiles: ["foco", "xyz", "foco"], spacing: true });
  assert.equal(p.textSize, 4);
  assert.equal(p.contrast, "off");
  assert.equal(p.libras, false);
  assert.equal(p.spacing, true);
  assert.deepEqual(p.profiles, ["foco"]);
  assert.deepEqual(normalizePrefs(null), DEFAULT_PREFS);
});

test("activeCount conta ajustes ligados, não perfis", () => {
  assert.equal(activeCount(DEFAULT_PREFS), 0);
  assert.equal(activeCount(toggleProfile(DEFAULT_PREFS, "foco", allOn)), 3);
  assert.equal(activeCount({ ...DEFAULT_PREFS, textSize: 2, contrast: "high" }), 2);
});

test("correção de daltonismo mantém cinzas (cada linha soma 1) e alfa intacto", () => {
  for (const m of ["protan", "deutan", "tritan"] as const) {
    const v = colorBlindMatrix(m);
    assert.equal(v.length, 20);
    for (let row = 0; row < 3; row++) {
      const sum = v[row * 5] + v[row * 5 + 1] + v[row * 5 + 2];
      assert.ok(Math.abs(sum - 1) < 0.01, `${m} linha ${row} soma ${sum}`);
    }
    assert.deepEqual(v.slice(15), [0, 0, 0, 1, 0]);
  }
});

/* ---------------- público do convite ---------------- */

const group = (p: Partial<{ networks: string[]; schools: string[]; classes: string[]; schoolYears: string[] }>) => ({
  id: "g",
  networks: [],
  schools: [],
  classes: [],
  schoolYears: [],
  ...p,
});

test("grupo casa sem acento/caixa, pelos apelidos em português e inglês", () => {
  const g = group({ networks: ["Rede Estadual SP"], schools: ["EE Prof. Ana Rosa"] });
  assert.equal(matchesGroup(g, { rede: "rede estadual sp", escola: "EE PROF. ANA ROSA" }), true);
  assert.equal(matchesGroup(g, { network: "Rede Estadual SP", school: "EE Prof. Ana Rosa" }), true);
  assert.equal(matchesGroup(g, { rede: "Rede Estadual SP" }), false, "escola é exigida pelo grupo");
  assert.equal(normalizeValue("  7º   Á "), "7º a");
});

test("dentro do campo vale qualquer valor; turma pode vir em lista (professor)", () => {
  const g = group({ classes: ["7º A", "7º B"] });
  assert.equal(matchesGroup(g, { turma: "7º b" }), true);
  assert.equal(matchesGroup(g, { classroom: ["8º A", "7º A"] }), true);
  assert.equal(matchesGroup(g, { turma: "8º A" }), false);
});

test("ano escolar usa a mesma leitura das pesquisas", () => {
  const g = group({ schools: ["Escola Aurora"], schoolYears: ["EM1"] });
  assert.equal(matchesGroup(g, { escola: "Escola Aurora", school_year: "1ª série EM" }), true);
  assert.equal(matchesGroup(g, { escola: "Escola Aurora", school_year: "9º ano" }), false);
});

test("grupo vazio nunca casa (e é removido na normalização)", () => {
  assert.equal(matchesGroup(group({}), { rede: "x" }), false);
  assert.deepEqual(normalizeGroups([{ id: "a" }, { id: "b", networks: ["  Rede X ", "rede x"] }]).map((g) => [g.id, g.networks]), [["b", ["Rede X"]]]);
  assert.equal(matchesAnyGroup([], { rede: "x" }), false);
});

test("lista individual: IDs/e-mails normalizados e conferência por id ou e-mail", () => {
  const list = parseStudentList(" 123 \nAna@Escola.br; 123, ,  bia@x.com ");
  assert.deepEqual(list, ["123", "ana@escola.br", "bia@x.com"]);
  assert.equal(matchesStudentList(list, { id: 123 }), true);
  assert.equal(matchesStudentList(list, { email: " ANA@escola.br" }), true);
  assert.equal(matchesStudentList(list, { id: "999", email: "outra@x.com" }), false);
  assert.equal(matchesStudentList(list, {}), false);
});

/* ---------------- configuração ---------------- */

test("normalizeA11yConfig cai no padrão com lixo e corta textos", () => {
  assert.deepEqual(normalizeA11yConfig(null), DEFAULT_A11Y_CONFIG);
  const c = normalizeA11yConfig({
    brand: { accent: "red", title: "x".repeat(100), logoUrl: "javascript:alert(1)" },
    launcher: { position: "top", offset: 9999 },
    libras: { avatar: "nobody", skin: "#abcdef", personalizationUrl: "http://x.com/p.json" },
    nudge: { delay: -5, profile: "xyz", students: "1\n2" },
  });
  assert.equal(c.brand.accent, DEFAULT_A11Y_CONFIG.brand.accent);
  assert.equal(c.brand.title.length, 40);
  assert.equal(c.brand.logoUrl, "");
  assert.equal(c.launcher.position, "bottom-right");
  assert.equal(c.launcher.offset, 200);
  assert.equal(c.libras.avatar, "icaro");
  assert.equal(c.libras.skin, "#ABCDEF");
  assert.equal(c.libras.personalizationUrl, "", "só https");
  assert.equal(c.nudge.delay, 0);
  assert.equal(c.nudge.profile, null);
  assert.deepEqual(c.nudge.students, ["1", "2"]);
});

test("recorte público nunca leva a lista individual", () => {
  const c = normalizeA11yConfig({ nudge: { students: ["ana@escola.br"] } });
  const pub = publicA11yConfig(c);
  assert.equal(pub.nudge.hasList, true);
  assert.equal("students" in pub.nudge, false);
  assert.equal(JSON.stringify(pub).includes("ana@escola.br"), false);
});

test("imagens: só https ou caminho do próprio site", () => {
  assert.equal(safeImageUrl("https://cdn.x.com/logo.png"), "https://cdn.x.com/logo.png");
  assert.equal(safeImageUrl("/mascot/logo.svg"), "/mascot/logo.svg");
  assert.equal(safeImageUrl("http://x.com/a.png"), "");
  assert.equal(safeImageUrl('https://x.com/a.png" onload="x'), "");
  const c = normalizeA11yConfig({ brand: { logoUrl: "https://a.com/l.png" }, libras: { logo: "brand" } });
  assert.equal(librasLogoUrl(c), "https://a.com/l.png");
  assert.equal(librasLogoUrl({ ...c, libras: { ...c.libras, logo: "none" } }), "");
});

test("texto sobre a cor de destaque tem contraste", () => {
  assert.equal(readableOn("#4F46E5"), "#FFFFFF");
  assert.equal(readableOn("#FDE68A"), "#111827");
  assert.equal(shade("#000000", 0.5), "#808080");
});

/* ---------------- frequência do convite ---------------- */

test("convite: aceito nunca volta; quem já usa recurso não é convidado", () => {
  const ctx = { now: 1_000_000_000_000, shownThisSession: false, activeAdjustments: 0 };
  assert.equal(nudgeDue("once", null, ctx), true);
  assert.equal(nudgeDue("once", { s: "dismissed", at: 0 }, ctx), false);
  assert.equal(nudgeDue("until_accepted", { s: "accepted", at: 0 }, ctx), false);
  assert.equal(nudgeDue("until_accepted", null, { ...ctx, activeAdjustments: 2 }), false);
});

test("convite: até aceitar volta depois de uma semana, nunca duas vezes na sessão", () => {
  const now = 1_000_000_000_000;
  const ctx = { now, shownThisSession: false, activeAdjustments: 0 };
  assert.equal(nudgeDue("until_accepted", { s: "dismissed", at: now - 1000 }, ctx), false);
  assert.equal(nudgeDue("until_accepted", { s: "dismissed", at: now - NUDGE_RETRY_MS }, ctx), true);
  assert.equal(nudgeDue("until_accepted", null, { ...ctx, shownThisSession: true }), false);
  assert.equal(nudgeDue("every_session", { s: "dismissed", at: now }, ctx), true);
  assert.equal(parseNudgeMemo({ s: "weird", at: 1 }), null);
});

/* ---------------- Libras (VLibras) ---------------- */

test("personalização do VLibras: mesmas chaves do arquivo oficial, logo só quando há", () => {
  const c = normalizeA11yConfig({ brand: { logoUrl: "https://a.com/l.png" }, libras: { shirt: "#4f46e5", pants: "#111111", skin: "#c18471", hair: "#000000", logo: "brand", logoPosition: "center" } });
  const json = vlibrasPersonalizationJson(librasLook(c));
  assert.deepEqual(Object.keys(json).sort(), ["cabelo", "calca", "camisa", "corpo", "iris", "logo", "olhos", "pos", "sombrancelhas"]);
  assert.equal(json.camisa, "#4F46E5");
  assert.equal(json.corpo, "#C18471");
  assert.equal(json.pos, "center");
  assert.equal(json.logo, "https://a.com/l.png");
  const plain = vlibrasPersonalizationJson(librasLook({ ...c, libras: { ...c.libras, logo: "none" } }));
  assert.equal("logo" in plain, false);
});

test("pedido ao VLibras vai para o e-mail oficial com os sites e as cores", () => {
  const c = normalizeA11yConfig({ libras: { shirt: "#0F766E", logo: "none" } });
  const mail = vlibrasRequestEmail({ institution: "Escola Aurora", sites: ["https://app.aurora.edu.br"], look: librasLook(c) });
  assert.equal(mail.to, "cgpsp@economia.gov.br");
  assert.match(mail.subject, /Escola Aurora/);
  assert.match(mail.body, /https:\/\/app\.aurora\.edu\.br/);
  assert.match(mail.body, /"camisa": "#0F766E"/);
  assert.doesNotMatch(mail.body, /logo para a camisa/);
});

test("endereço de personalização: só https terminado em .json", () => {
  assert.equal(safePersonalizationUrl(" https://vlibras.gov.br/config/escola.json "), "https://vlibras.gov.br/config/escola.json");
  assert.equal(safePersonalizationUrl("https://x.com/p.json?v=2"), "https://x.com/p.json?v=2");
  assert.equal(safePersonalizationUrl("https://x.com/p.js"), "");
  assert.equal(safePersonalizationUrl('https://x.com/a.json" onload="x'), "");
  assert.equal(safePersonalizationUrl("javascript:alert(1)//.json"), "");
});
