import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gradeFromTexts,
  matchesSchoolYears,
  normalizeSchoolYears,
  parseGradeLevel,
  parseSchoolYear,
  schoolYearsLabel,
} from "../../lib/school-years";

test("lê o ano escolar nos formatos que o produto pode mandar", () => {
  assert.equal(parseSchoolYear("EF7"), "EF7");
  assert.equal(parseSchoolYear("7"), "EF7");
  assert.equal(parseSchoolYear(7), "EF7");
  assert.equal(parseSchoolYear("7º ano"), "EF7");
  assert.equal(parseSchoolYear("7º Ano do Ensino Fundamental"), "EF7");
  assert.equal(parseSchoolYear("EM1"), "EM1");
  assert.equal(parseSchoolYear("1EM"), "EM1");
  assert.equal(parseSchoolYear("em_2"), "EM2");
  assert.equal(parseSchoolYear("1ª série do Ensino Médio"), "EM1");
  assert.equal(parseSchoolYear("3 medio"), "EM3");
  assert.equal(parseSchoolYear(12), "EM3");
  assert.equal(parseSchoolYear("4º ano EM"), null);
  assert.equal(parseSchoolYear("13"), null);
  assert.equal(parseSchoolYear("sem turma"), null);
  assert.equal(parseSchoolYear(true), null);
});

test("lê o segmento", () => {
  assert.equal(parseGradeLevel("fundamental_1"), "fundamental_1");
  assert.equal(parseGradeLevel("Fundamental I"), "fundamental_1");
  assert.equal(parseGradeLevel("anos iniciais"), "fundamental_1");
  assert.equal(parseGradeLevel("Fundamental II"), "fundamental_2");
  assert.equal(parseGradeLevel("EF2"), "fundamental_2");
  assert.equal(parseGradeLevel("ensino_medio"), "ensino_medio");
  assert.equal(parseGradeLevel("EM"), "ensino_medio");
  assert.equal(parseGradeLevel("infantil"), null);
});

test("sanitiza e resume a seleção", () => {
  assert.deepEqual(normalizeSchoolYears(["em1", "EF7", "EF7", "xx", "EF6"]), ["EF6", "EF7", "EM1"]);
  assert.deepEqual(normalizeSchoolYears("EF7"), []);
  assert.equal(schoolYearsLabel([]), "Todos os anos");
  assert.equal(schoolYearsLabel(["EF6", "EF7", "EF8", "EF9", "EM1"]), "Fundamental II, 1ª série (EM)");
});

test("decide se o usuário está entre os anos escolhidos", () => {
  // sem filtro: todo mundo
  assert.ok(matchesSchoolYears([], {}));
  assert.ok(matchesSchoolYears(undefined, { school_year: "7º ano" }));

  const f2 = ["EF6", "EF7", "EF8", "EF9"];
  assert.ok(matchesSchoolYears(f2, { school_year: "7º ano" }));
  assert.ok(matchesSchoolYears(f2, { schoolYear: 9 }));
  assert.ok(!matchesSchoolYears(f2, { school_year: "1EM" }));
  // vários anos (professor com várias turmas): basta um casar
  assert.ok(matchesSchoolYears(["EM2"], { school_year: ["6º ano", "2EM"] }));
  assert.ok(!matchesSchoolYears(["EM2"], { school_year: ["6º ano", "7º ano"] }));

  // só o segmento: casa quando a pesquisa cobre o segmento inteiro
  assert.ok(matchesSchoolYears(f2, { grade_level: "fundamental_2" }));
  assert.ok(matchesSchoolYears([...f2, "EM1"], { gradeLevel: "Fundamental II" }));
  assert.ok(!matchesSchoolYears(["EF7"], { grade_level: "fundamental_2" }));
  // o ano tem prioridade sobre o segmento
  assert.ok(!matchesSchoolYears(f2, { school_year: "EM1", grade_level: "fundamental_2" }));

  // sem ano nem segmento: fica de fora
  assert.ok(!matchesSchoolYears(f2, { id: "u1", email: "a@b.com" }));
  assert.ok(!matchesSchoolYears(f2, { school_year: "" }));
});

test("lê o GRADE_N mostrado na tela (perfil do Exploradores)", () => {
  assert.equal(gradeFromTexts(["EMEFI ALDA DE SOUZA ARAUJO - 6° ANO B • GRADE_6"]), "EF6");
  assert.equal(gradeFromTexts(["Turma 9A", "grade_9"]), "EF9");
  assert.equal(gradeFromTexts(["GRADE_10"]), "EM1");
  // o mesmo ano repetido na página continua valendo
  assert.equal(gradeFromTexts(["GRADE_6", "6º ano • GRADE_6"]), "EF6");
  // anos diferentes (lista de turmas, ranking): não dá para saber qual é o do usuário
  assert.equal(gradeFromTexts(["GRADE_6", "GRADE_7"]), null);
  assert.equal(gradeFromTexts(["UPGRADE_6", "GRADE_X", "sem ano"]), null);
  assert.equal(gradeFromTexts([]), null);
});
