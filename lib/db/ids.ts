import { customAlphabet } from "nanoid";

// alfabeto sem caracteres ambíguos, ids curtos e legíveis
const nano = customAlphabet("23456789abcdefghijkmnpqrstuvwxyz", 10);

export const newId = (prefix: string) => `${prefix}_${nano()}`;
export const surveyId = () => newId("svy");
export const questionId = () => newId("qst");
export const responseId = () => newId("res");
export const answerId = () => newId("ans");
export const eventId = () => newId("evt");
