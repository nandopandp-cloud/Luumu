import "server-only";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
// remetente configurável; precisa ser de um domínio verificado no Resend em produção.
// "onboarding@resend.dev" funciona só para testes com o próprio e-mail da conta Resend.
const FROM = process.env.EMAIL_FROM || "Luumu <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

export interface SendEmailInput {
  to: string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Envia um e-mail via Resend. Se RESEND_API_KEY não estiver configurada, não quebra —
 * loga e retorna { skipped: true }, para o app funcionar em dev/preview sem o serviço.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY ausente — envio ignorado. Para: ${input.to.join(", ")} · Assunto: ${input.subject}`);
    return { ok: false, skipped: true };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao enviar e-mail." };
  }
}

export const isEmailConfigured = () => resend !== null;
