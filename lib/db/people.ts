import "server-only";
import { db } from "./client";
import { sql } from "drizzle-orm";

/*
  Quem é quem: nome, e-mail e foto dos usuários do produto do cliente, a partir do que o
  Analytics já sabe (analytics_users, alimentada pelo Luumu.identify() e pela captura de
  identidade). Respostas, busca e exportações só guardam o ID e o e-mail informados — aqui eles
  viram a mesma pessoa que aparece em Analytics › Usuários.
*/
export interface Person {
  userId: string | null;
  email: string | null;
  name: string | null;
  avatar: string | null;
}

export type PersonRef = { respondent: string | null; respondentEmail: string | null };

const CHUNK = 500;
const lower = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Resolve várias pessoas de um projeto numa consulta. Casa pelo ID do produto e, sem ele, pelo
 * e-mail; com mais de um registro (navegadores diferentes), vale o mais recente.
 * Sem correspondência, devolve o que a resposta já tinha (ID/e-mail, sem nome nem foto).
 */
export async function resolvePeople(projectId: string, refs: PersonRef[]): Promise<(r: PersonRef) => Person> {
  const ids = [...new Set(refs.map((r) => r.respondent).filter((x): x is string => !!x))];
  const emails = [...new Set(refs.map((r) => lower(r.respondentEmail)).filter(Boolean))];
  const byId = new Map<string, Person>();
  const byEmail = new Map<string, Person>();

  type Row = { user_id: string | null; user_email: string | null; user_name: string | null; user_avatar: string | null; last_seen_at: string };
  const rows: Row[] = [];
  // em lotes: exportação pode trazer milhares de pessoas
  for (let i = 0; i < Math.max(ids.length, emails.length); i += CHUNK) {
    const idPart = ids.slice(i, i + CHUNK);
    const emailPart = emails.slice(i, i + CHUNK);
    const res = (await db
      .execute(
        sql`select user_id, user_email, user_name, user_avatar, last_seen_at
              from analytics_users
             where project_id = ${projectId}
               and (${sql.join(
                 [
                   idPart.length ? sql`user_id in (${sql.join(idPart.map((x) => sql`${x}`), sql`, `)})` : null,
                   emailPart.length ? sql`lower(user_email) in (${sql.join(emailPart.map((x) => sql`${x}`), sql`, `)})` : null,
                 ].filter((x) => x !== null),
                 sql` or `
               )})`
      )
      .catch((e) => {
        // sem a identidade, as telas seguem como antes (ID/e-mail); nunca derruba a página
        console.error("[people]", e);
        return { rows: [] };
      })) as unknown as { rows: Row[] };
    rows.push(...res.rows);
  }
  // mais recente primeiro: com vários navegadores, vale o último nome/foto visto
  rows.sort((x, y) => Date.parse(y.last_seen_at) - Date.parse(x.last_seen_at));
  // um registro por navegador: o mais recente pode não ter nome/foto — completa com os anteriores
  const merge = (map: Map<string, Person>, key: string, p: Person) => {
    const cur = map.get(key);
    if (!cur) return void map.set(key, { ...p });
    cur.name ??= p.name;
    cur.avatar ??= p.avatar;
    cur.email ??= p.email;
    cur.userId ??= p.userId;
  };
  for (const r of rows) {
    const p: Person = { userId: r.user_id, email: r.user_email, name: r.user_name, avatar: r.user_avatar };
    if (r.user_id) merge(byId, r.user_id, p);
    const e = lower(r.user_email);
    if (e) merge(byEmail, e, p);
  }

  return (r) => {
    const byUser = r.respondent ? byId.get(r.respondent) : undefined;
    const byMail = byEmail.get(lower(r.respondentEmail));
    return {
      userId: r.respondent ?? byUser?.userId ?? byMail?.userId ?? null,
      email: r.respondentEmail ?? byUser?.email ?? byMail?.email ?? null,
      name: byUser?.name ?? byMail?.name ?? null,
      avatar: byUser?.avatar ?? byMail?.avatar ?? null,
    };
  };
}
