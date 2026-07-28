import { config } from "dotenv";
config({ path: ".env.local" });
import { Resend } from "resend";
import { reportEmailHtml } from "@/lib/email-templates";
import { getAppOrigin } from "@/lib/env";

/**
 * Cenários de exemplo por tipo de pesquisa — refletem o que buildReportSnapshot()
 * realmente produz (scoreFormula só existe para NPS; outros tipos vêm com formula: null).
 */
const SCENARIOS = {
  nps: {
    reportName: "Pesquisa de Satisfação — Pós-compra",
    scoreLabel: "NPS",
    scoreValue: "+58",
    scoreFormula: "% promotores (9-10) − % detratores (0-6)",
    positivePct: 84,
  },
  csat: {
    reportName: "Pesquisa de Atendimento — Suporte",
    scoreLabel: "CSAT",
    scoreValue: "92%",
    scoreFormula: null,
    positivePct: 92,
  },
} as const;

async function main() {
  const to = process.argv[2];
  const scenarioArg = (process.argv[3] as keyof typeof SCENARIOS) || "nps";
  if (!to) {
    console.error("Uso: npx tsx scripts/test-report-email.ts <email-destino> [nps|csat]");
    process.exit(1);
  }
  const scenario = SCENARIOS[scenarioArg];
  if (!scenario) {
    console.error(`Cenário inválido: ${scenarioArg}. Use "nps" ou "csat".`);
    process.exit(1);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY ausente no .env.local");
    process.exit(1);
  }
  const from = process.env.EMAIL_FROM || "Luumu <onboarding@resend.dev>";

  const html = reportEmailHtml({
    ...scenario,
    scopeName: "Todas as pesquisas",
    periodLabel: "Últimos 7 dias",
    total: 312,
    publicUrl: `${getAppOrigin()}/reports`,
    hasAttachment: true,
    attachmentFormat: "pdf",
    appOrigin: getAppOrigin(),
  });

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: `📊 Seu relatório semanal está pronto — ${scenario.scoreLabel} ${scenario.scoreValue} [TESTE]`,
    html,
  });

  if (error) {
    console.error({ ok: false, error: error.message });
    process.exit(1);
  }
  console.log({ ok: true, id: data?.id, scenario: scenarioArg });
}

main();
