"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { canManageWorkspace, getCurrentProjectId, requireUser } from "@/lib/auth/current";
import {
  getOrCreateIdentitySecret,
  listInvitees,
  removeInvitees,
  saveAccessibilitySettings,
  setRequireVerified,
  upsertInvitees,
  type InviteeRow,
} from "@/lib/db/accessibility";
import type { A11yConfig } from "@/lib/accessibility/config";
import { inviteeKey, isInviteeStatus, parseInvitees, parseProfile, type InviteeStatus } from "@/lib/accessibility/invitees";

/*
  Toda action confere a sessão e o papel (owner/admin para alterar) e trabalha só no projeto
  ativo: chamar a action direto, sem a página, continua exigindo as mesmas permissões.
*/

type Fail = { ok: false; error: string };
const PATH = "/accessibility";
const NOT_ALLOWED: Fail = { ok: false, error: "Só donos e administradores podem alterar o plugin de acessibilidade." };
const NO_TABLE = "Não foi possível salvar. A migração do plugin de acessibilidade (0044) já foi aplicada?";

async function manager() {
  const session = await requireUser();
  if (!(await canManageWorkspace())) return null;
  return { userId: session.userId, projectId: await getCurrentProjectId() };
}

/**
 * Salva o plugin do projeto ativo (ligado/desligado + configuração). O que chega passa por
 * normalizeA11yConfig: valores desconhecidos caem no padrão e textos são cortados — a action
 * devolve a versão gravada para a tela refletir isso.
 */
export async function saveAccessibilityAction(input: { enabled: boolean; config: unknown }): Promise<{ ok: true; config: A11yConfig } | Fail> {
  const m = await manager();
  if (!m) return NOT_ALLOWED;
  if (!input || typeof input.enabled !== "boolean") return { ok: false, error: "Dados inválidos." };
  if (JSON.stringify(input.config ?? {}).length > 200_000) return { ok: false, error: "Configuração grande demais." };
  try {
    const config = await saveAccessibilitySettings(m.projectId, { enabled: input.enabled, config: input.config }, m.userId);
    revalidatePath(PATH);
    return { ok: true, config };
  } catch {
    return { ok: false, error: NO_TABLE };
  }
}

/* ---------------- convidados ---------------- */

export type InviteePage = { rows: InviteeRow[]; total: number; totals: Record<InviteeStatus, number>; page: number; pageSize: number };

/** Lista com busca (ID, e-mail ou nome), filtro de status e paginação. Leitura: qualquer membro. */
export async function listInviteesAction(input: { q?: string; status?: string | null; page?: number }): Promise<({ ok: true } & InviteePage) | Fail> {
  await requireUser();
  const projectId = await getCurrentProjectId();
  try {
    const page = await listInvitees(projectId, {
      q: typeof input.q === "string" ? input.q.slice(0, 120) : undefined,
      status: isInviteeStatus(input.status) ? input.status : null,
      page: Number.isInteger(input.page) ? input.page : 0,
    });
    return { ok: true, ...page };
  } catch {
    return { ok: false, error: "Não foi possível carregar os convidados. A migração 0044 já foi aplicada?" };
  }
}

type ImportResult = { ok: true; added: number; updated: number; invalid: string[]; duplicates: number } | Fail;

/** Um estudante (formulário) ou vários (lista colada / CSV lido no navegador). */
export async function addInviteesAction(input: { text?: string; one?: { key: string; name?: string; profile?: string | null } }): Promise<ImportResult> {
  const m = await manager();
  if (!m) return NOT_ALLOWED;
  let parsed;
  if (input.one) {
    const key = inviteeKey(input.one.key);
    if (!key) return { ok: false, error: "Informe um ID ou e-mail válido (sem espaços)." };
    parsed = { rows: [{ key, name: String(input.one.name ?? "").trim().slice(0, 120), profile: parseProfile(input.one.profile) }], invalid: [], duplicates: 0 };
  } else {
    if (typeof input.text !== "string" || input.text.length > 3_000_000) return { ok: false, error: "Lista vazia ou grande demais." };
    parsed = parseInvitees(input.text);
  }
  if (!parsed.rows.length) return { ok: false, error: parsed.invalid.length ? "Nenhum ID ou e-mail válido encontrado." : "Lista vazia." };
  try {
    const r = await upsertInvitees(m.projectId, parsed.rows, m.userId);
    revalidatePath(PATH);
    return { ok: true, ...r, invalid: parsed.invalid.slice(0, 20), duplicates: parsed.duplicates };
  } catch {
    return { ok: false, error: NO_TABLE };
  }
}

/** Planilha .xlsx (primeira aba): vira texto com tabulação e segue o mesmo caminho do CSV. */
export async function importInviteesFileAction(form: FormData): Promise<ImportResult> {
  const m = await manager();
  if (!m) return NOT_ALLOWED;
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Arquivo ausente." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Arquivo grande demais (máx. 10 MB)." };
  let text: string;
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return { ok: false, error: "A planilha não tem abas." };
    const lines: string[] = [];
    ws.eachRow((row) => {
      const cells = (row.values as unknown[]).slice(1).map((v) => {
        const val = v && typeof v === "object" && "text" in (v as object) ? (v as { text: unknown }).text : v;
        return String(val ?? "").replace(/[\t\r\n]+/g, " ").trim();
      });
      lines.push(cells.join("\t"));
    });
    text = lines.join("\n");
  } catch {
    return { ok: false, error: "Não consegui ler a planilha. Use .xlsx ou salve como CSV." };
  }
  return addInviteesAction({ text });
}

export async function removeInviteesAction(input: { keys: string[] } | { all: true }): Promise<{ ok: true } | Fail> {
  const m = await manager();
  if (!m) return NOT_ALLOWED;
  try {
    if ("all" in input) await removeInvitees(m.projectId, "all");
    else await removeInvitees(m.projectId, input.keys.map(inviteeKey).filter(Boolean).slice(0, 1000));
    revalidatePath(PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: NO_TABLE };
  }
}

/* ---------------- verificação de identidade ---------------- */

/** Mostra (e cria na primeira vez) o segredo de assinatura. Só owner/admin. */
export async function revealIdentitySecretAction(rotate = false): Promise<{ ok: true; secret: string } | Fail> {
  const m = await manager();
  if (!m) return NOT_ALLOWED;
  try {
    const secret = await getOrCreateIdentitySecret(m.projectId, m.userId, rotate === true);
    revalidatePath(PATH);
    return { ok: true, secret };
  } catch {
    return { ok: false, error: NO_TABLE };
  }
}

export async function setRequireVerifiedAction(on: boolean): Promise<{ ok: true } | Fail> {
  const m = await manager();
  if (!m) return NOT_ALLOWED;
  try {
    if (on) await getOrCreateIdentitySecret(m.projectId, m.userId);
    await setRequireVerified(m.projectId, on === true, m.userId);
    revalidatePath(PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: NO_TABLE };
  }
}
