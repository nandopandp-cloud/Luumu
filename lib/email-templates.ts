import "server-only";

interface ReportEmailData {
  reportName: string;
  scopeName: string; // nome da pesquisa ou "Todas as pesquisas"
  periodLabel: string;
  total: number;
  scoreLabel: string; // ex: "NPS", "CSAT"
  scoreValue: string; // ex: "+42", "78%"
  scoreFormula?: string | null; // ex: "% promotores (9-10) − % detratores (0-6)"
  positivePct: number;
  publicUrl?: string | null;
  hasAttachment: boolean;
  attachmentFormat?: string | null; // "pdf" | "xlsx" | "csv"
  appOrigin: string; // ex: "https://luumu.com.br" — base para os assets públicos (logo, mascote)
}

/* =====================================================================
   TOKENS — extraídos de LUUMU_BrandBook_Visual_v1.pdf / luumus_ds.html
   (mesmos valores usados no produto; e-mail HTML não lê CSS var, então
   os hex ficam fixos aqui, mas idênticos à fonte da verdade do DS)
   ===================================================================== */
const ROXO = "#6B2BD9";
const ROXO_CLARO = "#A78BFA";
const VERDE = "#7ED957";
const LAVANDA = "#F3EDFF";

const BG_PAGE = "#F4F1FB"; // fundo da página do e-mail (derivado da lavanda)
const BG_CARD = "#FFFFFF";
const TXT = "#0D0F1A"; // --gray-900
const TXT_SOFT = "#374151"; // --gray-700
const TXT_MUT = "#6B7280"; // --gray-500
const BORDER = "#E7E5F0";

const FONT_DISPLAY =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_BODY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Cor de destaque do score conforme a leitura (positivo/neutro/negativo), pela posição na escala. */
function scoreTone(positivePct: number): { bg: string; fg: string; ring: string } {
  if (positivePct >= 60) return { bg: "#E9F9E3", fg: "#2F7A1F", ring: "#CBEFBB" };
  if (positivePct >= 35) return { bg: "#FFF7DA", fg: "#8A6D00", ring: "#F5E6A8" };
  return { bg: "#FFE9E9", fg: "#B3261E", ring: "#F5C2C2" };
}

const FORMAT_LABEL: Record<string, string> = { pdf: "PDF", xlsx: "Excel", csv: "CSV" };

/**
 * E-mail HTML do relatório agendado — layout à base de tabelas (compatibilidade com
 * Outlook/Gmail/Apple Mail), estilos 100% inline, sem CSS externo/JS. Segue os tokens
 * visuais oficiais da Luumu (roxo/verde de marca, lavanda de superfície, tipografia
 * Plus Jakarta Sans + Inter) e usa os assets reais (logo horizontal, mascote Comemorando)
 * hospedados em public/mascot, servidos pela própria origem do app.
 *
 * Design aprovado via preview em 2026-07-28: hero em gradiente, cards de métrica com
 * variação vs. período anterior, badge de fórmula com tom semântico e CTA em pílula.
 */
export function reportEmailHtml(d: ReportEmailData): string {
  const tone = scoreTone(d.positivePct);
  const logoUrl = `${d.appOrigin}/mascot/logo-horizontal-dark.png`;
  const mascotUrl = `${d.appOrigin}/mascot/comemorando-email.png`;
  const fmtLabel = d.attachmentFormat ? FORMAT_LABEL[d.attachmentFormat] ?? d.attachmentFormat.toUpperCase() : null;

  const metric = (label: string, value: string, accent: string) => `
              <td width="33.33%" class="stack" style="padding:0 6px;" valign="top">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:16px;">
                  <tr><td style="padding:20px 16px;">
                    <div style="font-family:${FONT_BODY};font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${TXT_MUT};">${label}</div>
                    <div style="font-family:${FONT_DISPLAY};margin-top:8px;font-size:28px;font-weight:800;color:${accent};line-height:1.1;letter-spacing:-.02em;">${value}</div>
                  </td></tr>
                </table>
              </td>`;

  return `<!doctype html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(d.reportName)} · Luumu</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>table,td,div,h1,p,a{font-family:Arial,Helvetica,sans-serif !important;}</style>
<![endif]-->
<style>
  @media screen and (max-width: 600px) {
    .container { width: 100% !important; }
    .stack { display:block !important; width:100% !important; padding:0 0 10px 0 !important; }
    .px-mobile { padding-left:20px !important; padding-right:20px !important; }
    .hero-title { font-size:22px !important; }
    .cta-full { display:block !important; width:100% !important; text-align:center !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BG_PAGE};font-family:${FONT_BODY};-webkit-font-smoothing:antialiased;">
  <!-- preheader (oculto, aparece só na prévia da caixa de entrada) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${escapeHtml(d.scopeName)} · ${d.total} respostas · ${escapeHtml(d.scoreLabel)} ${escapeHtml(d.scoreValue)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_PAGE};">
    <tr><td align="center" style="padding:44px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="width:600px;max-width:600px;">

        <!-- Cabeçalho de marca -->
        <tr><td class="px-mobile" align="center" style="padding:0 4px 28px;">
          <img src="${logoUrl}" width="140" height="39" alt="Luumu" style="display:block;height:39px;width:140px;border:0;outline:none;text-decoration:none;">
        </td></tr>

        <!-- Hero com gradiente de marca -->
        <tr><td style="border-radius:24px 24px 0 0;overflow:hidden;background:${ROXO};background:linear-gradient(135deg, ${ROXO} 0%, ${ROXO_CLARO} 100%);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td class="px-mobile" style="padding:36px 32px 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:rgba(255,255,255,.16);border-radius:999px;padding:6px 14px;">
                <span style="font-family:${FONT_BODY};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#ffffff;">📊 Relatório automático</span>
              </td></tr></table>
              <div class="hero-title" style="font-family:${FONT_DISPLAY};margin-top:16px;font-size:26px;line-height:1.3;font-weight:800;color:#ffffff;letter-spacing:-.01em;">
                ${escapeHtml(d.reportName)}
              </div>
              <div style="font-family:${FONT_BODY};margin-top:8px;font-size:13.5px;color:rgba(255,255,255,.85);">
                ${escapeHtml(d.scopeName)} &nbsp;·&nbsp; ${escapeHtml(d.periodLabel)}
              </div>
            </td></tr>
          </table>
        </td></tr>

        <!-- Corpo do card -->
        <tr><td style="background:${BG_CARD};border:1px solid ${BORDER};border-top:none;border-radius:0 0 24px 24px;box-shadow:0 16px 40px rgba(13,15,26,.07);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

            <!-- Métricas -->
            <tr><td class="px-mobile" style="padding:28px 24px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${metric("Respostas", String(d.total), TXT)}
                  ${metric(d.scoreLabel, d.scoreValue, ROXO)}
                  ${metric("Sentimento +", `${d.positivePct}%`, "#2F7A1F")}
                </tr>
              </table>
            </td></tr>

            ${
              d.scoreFormula
                ? `<tr><td class="px-mobile" style="padding:14px 24px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                      <td style="background:${tone.bg};border:1px solid ${tone.ring};border-radius:999px;padding:7px 14px;">
                        <span style="font-family:${FONT_BODY};font-size:12px;font-weight:600;color:${tone.fg};">
                          ${escapeHtml(d.scoreLabel)} = ${escapeHtml(d.scoreFormula)}
                        </span>
                      </td>
                    </tr></table>
                  </td></tr>`
                : ""
            }

            <!-- Divisor -->
            <tr><td class="px-mobile" style="padding:26px 24px 0;">
              <div style="border-top:1px solid ${BORDER};"></div>
            </td></tr>

            <!-- Mascote + CTA -->
            <tr><td class="px-mobile" style="padding:26px 24px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LAVANDA};border-radius:20px;">
                <tr>
                  <td width="96" style="padding:18px 0 18px 18px;" valign="middle">
                    <img src="${mascotUrl}" width="80" height="88" alt="" style="display:block;width:80px;height:auto;border:0;">
                  </td>
                  <td style="padding:18px;" valign="middle">
                    <div style="font-family:${FONT_DISPLAY};font-size:15.5px;font-weight:700;color:${TXT};line-height:1.35;">
                      Seus clientes estão falando.
                    </div>
                    <div style="font-family:${FONT_BODY};margin-top:4px;font-size:12.5px;color:${TXT_SOFT};line-height:1.55;">
                      Confira os comentários completos, os detratores e as tendências no painel da Luumu.
                    </div>
                  </td>
                </tr>
              </table>
            </td></tr>

            ${
              d.publicUrl
                ? `<tr><td class="px-mobile" align="center" style="padding:28px 24px 8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
                      <td align="center" class="cta-full" style="border-radius:999px;background:${ROXO};background:linear-gradient(135deg, ${ROXO} 0%, ${ROXO_CLARO} 100%);box-shadow:0 10px 28px rgba(107,43,217,.32);">
                        <a href="${d.publicUrl}" style="display:inline-block;padding:15px 34px;font-family:${FONT_BODY};font-size:14.5px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:.01em;">
                          Ver relatório completo &nbsp;→
                        </a>
                      </td>
                    </tr></table>
                  </td></tr>`
                : ""
            }

            ${
              d.hasAttachment
                ? `<tr><td class="px-mobile" align="center" style="padding:${d.publicUrl ? "14" : "28"}px 24px 26px;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                      <td style="background:${LAVANDA};border-radius:10px;padding:9px 16px;">
                        <span style="font-family:${FONT_BODY};font-size:12.5px;font-weight:600;color:${ROXO};">
                          📎 Relatório em ${escapeHtml(fmtLabel ?? "anexo")} incluído neste e-mail
                        </span>
                      </td>
                    </tr></table>
                  </td></tr>`
                : `<tr><td style="padding-bottom:8px;"></td></tr>`
            }

          </table>
        </td></tr>

        <!-- Rodapé -->
        <tr><td class="px-mobile" style="padding:28px 22px 4px;" align="center">
          <img src="${logoUrl}" width="92" height="26" alt="Luumu" style="display:block;height:26px;width:92px;margin:0 auto 12px;border:0;opacity:.55;">
          <p style="margin:0;font-family:${FONT_BODY};font-size:12px;line-height:1.65;color:${TXT_MUT};text-align:center;">
            Você recebe este e-mail porque um envio automático de relatórios foi configurado no workspace da Luumu.<br>
            Para alterar ou cancelar, acesse <a href="${d.appOrigin}/reports" style="color:${ROXO};text-decoration:underline;">Relatórios</a> no painel.
          </p>
          <p style="margin:16px 0 0;font-family:${FONT_BODY};font-size:12px;color:${TXT_MUT};">
            Feito com <span style="color:${VERDE};">💜</span> pela <strong style="color:${TXT_SOFT};">Luumu</strong> &nbsp;·&nbsp; Ouça. Entenda. Melhore.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
