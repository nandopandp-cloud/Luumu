import "server-only";

interface ReportEmailData {
  reportName: string;
  scopeName: string; // nome da pesquisa ou "Todas as pesquisas"
  periodLabel: string;
  total: number;
  scoreLabel: string; // ex: "NPS", "CSAT"
  scoreValue: string; // ex: "+42", "78%"
  positivePct: number;
  publicUrl?: string | null;
  hasAttachment: boolean;
}

const ROXO = "#6B2BD9";
const VERDE = "#7ED957";
const BG = "#F5F3FF";
const FG = "#1a1a2e";
const MUT = "#6b7280";

/** E-mail HTML (inline styles p/ compatibilidade com clientes de e-mail) do relatório agendado. */
export function reportEmailHtml(d: ReportEmailData): string {
  const metric = (label: string, value: string) => `
    <td style="padding:0 8px;">
      <div style="background:#ffffff;border:1px solid #ece8f7;border-radius:14px;padding:16px 18px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${MUT};">${label}</div>
        <div style="margin-top:6px;font-size:28px;font-weight:800;color:${ROXO};line-height:1;">${value}</div>
      </div>
    </td>`;

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <!-- Cabeçalho da marca -->
        <tr><td style="padding:0 4px 20px;">
          <span style="font-size:22px;font-weight:800;color:${ROXO};letter-spacing:-.5px;">Luumu</span>
          <span style="font-size:13px;color:${MUT};margin-left:8px;">Ouça. Entenda. Melhore.</span>
        </td></tr>

        <!-- Card principal -->
        <tr><td style="background:#ffffff;border:1px solid #ece8f7;border-radius:20px;padding:28px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${ROXO};">Relatório automático</div>
          <h1 style="margin:8px 0 4px;font-size:22px;font-weight:800;color:${FG};">${escapeHtml(d.reportName)}</h1>
          <p style="margin:0;font-size:14px;color:${MUT};">${escapeHtml(d.scopeName)} · ${escapeHtml(d.periodLabel)}</p>

          <!-- Métricas -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;">
            <tr>
              ${metric("Respostas", String(d.total))}
              ${metric(d.scoreLabel, d.scoreValue)}
              ${metric("Sentimento +", `${d.positivePct}%`)}
            </tr>
          </table>

          ${
            d.publicUrl
              ? `<a href="${d.publicUrl}" style="display:inline-block;margin-top:18px;background:${ROXO};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px;">Ver relatório completo →</a>`
              : ""
          }
          ${
            d.hasAttachment
              ? `<p style="margin:18px 0 0;font-size:13px;color:${MUT};">📎 O relatório detalhado está anexado a este e-mail.</p>`
              : ""
          }
        </td></tr>

        <!-- Rodapé -->
        <tr><td style="padding:20px 4px;text-align:center;">
          <p style="margin:0;font-size:12px;color:${MUT};">
            Você recebe este e-mail porque um envio automático de relatórios foi configurado na Luumu.
          </p>
          <p style="margin:6px 0 0;font-size:12px;">
            <span style="color:${VERDE};font-weight:700;">Feito com 💜 pela Luumu</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
