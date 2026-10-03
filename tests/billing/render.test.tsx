import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// os componentes de cliente importam as server actions (que leem estas variáveis ao carregar);
// aqui elas nunca são chamadas
process.env.AUTH_SECRET ||= "test-secret";
process.env.DATABASE_URL ||= "postgres://u:p@localhost/test";

test("cards, tabela e FAQ renderizam com o plano atual e o pedido pendente", async () => {
  const { PlanCards } = await import("../../components/billing/PlanCards");
  const { ComparisonTable } = await import("../../components/billing/ComparisonTable");
  const { Faq } = await import("../../components/billing/Faq");
  const { ToastProvider } = await import("../../components/ui/Toast");

  const html = renderToStaticMarkup(
    createElement(
      ToastProvider,
      null,
      createElement(PlanCards, { current: "growth", pendingPlan: "scale", canManage: true }),
      createElement(ComparisonTable, { highlight: "growth" }),
      createElement(Faq, { cta: createElement("span", null, "cta") })
    )
  );
  assert.match(html, /Plano atual/);
  assert.match(html, /Mais popular/);
  assert.match(html, /Mudança solicitada/);
  assert.match(html, /Sob consulta/);
  assert.match(html, /R\$ 299/);
  assert.match(html, /Compare os planos/);
  assert.match(html, /Ver todos os recursos/);
  assert.doesNotMatch(html, /Contrato próprio e acordo/); // linha extra da tabela fica escondida até expandir
  assert.match(html, /Mudar para Free/); // downgrade não oferece "Começar grátis"
  assert.match(html, /Perguntas frequentes/);
});

test("sem permissão, os botões ficam desabilitados e há aviso", async () => {
  const { PlanCards } = await import("../../components/billing/PlanCards");
  const { ToastProvider } = await import("../../components/ui/Toast");
  const html = renderToStaticMarkup(createElement(ToastProvider, null, createElement(PlanCards, { current: "free", pendingPlan: null, canManage: false })));
  assert.match(html, /Só donos e administradores/);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 5);
});
