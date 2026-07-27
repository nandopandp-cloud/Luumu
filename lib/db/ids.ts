import { customAlphabet } from "nanoid";

// alfabeto sem caracteres ambíguos, ids curtos e legíveis
const nano = customAlphabet("23456789abcdefghijkmnpqrstuvwxyz", 10);

export const newId = (prefix: string) => `${prefix}_${nano()}`;
export const surveyId = () => newId("svy");
export const questionId = () => newId("qst");
export const responseId = () => newId("res");
export const answerId = () => newId("ans");
export const eventId = () => newId("evt");
export const projectId = () => newId("prj");
export const scheduledReportId = () => newId("sch");
export const publicReportId = () => newId("pub");

// token secreto e longo para links públicos (não segue o padrão de ids do app)
const nanoToken = customAlphabet("23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", 32);
export const publicReportToken = () => nanoToken();
