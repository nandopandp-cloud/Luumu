/*
  De quem é o ID anônimo deste navegador (PURO: o core guarda o estado no localStorage).

  O Analytics agrupa tudo pelo ID anônimo. Num computador compartilhado (laboratório da escola),
  vários estudantes passavam pelo mesmo ID: a etiqueta (id/e-mail) ficava com quem usou por
  último e a sessão aberta era herdada pelo próximo login. Agora o ID tem um DONO, o primeiro
  estudante identificado nele; quando outro estudante faz login, ele ganha o ID dele (o que já
  usou neste navegador, ou um novo). O mesmo estudante saindo e voltando continua com o mesmo ID.

  O dono é guardado como impressão digital (hash) do id e do e-mail, nunca em texto.
*/

export interface Owner {
  /** hash do id do produto */
  i?: string;
  /** hash do e-mail */
  e?: string;
}

export interface AnonState {
  /** ID anônimo em uso */
  id: string;
  /** dono do ID em uso (null = ninguém se identificou neste navegador ainda) */
  owner: Owner | null;
  /** estudantes já vistos neste navegador e o ID de cada um (o mais recente por último) */
  known: (Owner & { a: string })[];
}

/** Quantos estudantes um navegador lembra (laboratório com várias turmas). */
export const MAX_KNOWN = 40;

/** cyrb53: hash curto, estável e sem dependências. */
export function ownerHash(v: string): string {
  let h1 = 0xdeadbeef ^ 0x4c75;
  let h2 = 0x41c6ce57 ^ 0x4c75;
  for (let i = 0; i < v.length; i++) {
    const ch = v.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Dono a partir do que o produto passou no identify (id e/ou e-mail). */
export function ownerOf(who: { id?: unknown; email?: unknown }): Owner | null {
  const norm = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).trim().toLowerCase() : "");
  const id = norm(who.id);
  const email = norm(who.email);
  if (!id && !email) return null;
  return { ...(id ? { i: ownerHash(id) } : {}), ...(email ? { e: ownerHash(email) } : {}) };
}

/** Certamente a mesma pessoa: o id bate, ou (sem id dos dois lados) o e-mail bate. */
export function samePerson(a: Owner, b: Owner): boolean {
  if (a.i && b.i) return a.i === b.i;
  return !!(a.e && b.e && a.e === b.e);
}

/**
 * Certamente outra pessoa. Na dúvida (um lado só com id e o outro só com e-mail), NÃO é
 * troca: trocar o ID à toa dividiria a mesma pessoa em duas no painel.
 */
export function otherPerson(a: Owner, b: Owner): boolean {
  if (a.i && b.i) return a.i !== b.i;
  if (a.e && b.e) return a.e !== b.e;
  return false;
}

const merge = (a: Owner, b: Owner): Owner => ({ ...a, ...b });

/**
 * Próximo estado depois de um identify. `changed` = o ID anônimo mudou (outra pessoa assumiu
 * o navegador): o core envia o que estava pendente antes e abre uma sessão nova.
 */
export function switchOwner(state: AnonState, who: Owner | null, fresh: () => string): { state: AnonState; changed: boolean } {
  if (!who) return { state, changed: false };
  const remember = (known: AnonState["known"], o: Owner, a: string) =>
    [...known.filter((k) => k.a !== a && !samePerson(k, o)), { ...o, a }].slice(-MAX_KNOWN);

  // primeiro login neste navegador, ou a mesma pessoa (talvez agora com id e e-mail)
  if (!state.owner || !otherPerson(state.owner, who)) {
    const owner = state.owner ? merge(state.owner, who) : who;
    return { state: { id: state.id, owner, known: remember(state.known, owner, state.id) }, changed: false };
  }

  // outra pessoa: o ID dela neste navegador, ou um novo
  const seen = state.known.find((k) => samePerson(k, who));
  const id = seen?.a ?? fresh();
  const owner = seen ? merge({ ...(seen.i ? { i: seen.i } : {}), ...(seen.e ? { e: seen.e } : {}) }, who) : who;
  const known = remember(remember(state.known, state.owner, state.id), owner, id);
  return { state: { id, owner, known }, changed: id !== state.id };
}
