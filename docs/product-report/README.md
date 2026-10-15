# Report Quinzenal de Produto

Módulo da Luumu que monta o report quinzenal de Gestão de Produto da Jovens Gênios: North Star,
CSAT, Aderência e Tempo de uso de GenieX, Exploradores e Educadores, com metas, histórico e
exportação em HTML e PDF.

Rota: `/product-report` (menu **Inteligência → Report Quinzenal**).

## Acesso

Só a conta `nandopandp@gmail.com` vê e usa o módulo.

- A regra está em `lib/product-report/authorize.ts`. O `userId` vem da sessão (JWT assinado com
  `AUTH_SECRET`) e o e-mail comparado é o **do banco**, nunca o do token ou da requisição.
- Layout, página, todas as server actions e a rota de exportação chamam o guard
  (`lib/product-report/access.ts`). Outra conta recebe **404**; sem sessão, vai para o login.
- O item do menu só aparece para a conta autorizada, mas isso é só interface: a proteção é o guard.
- `tests/product-report/guards.test.ts` falha se uma action ou rota nova do módulo não chamar o guard.
- **Recomendado:** defina `PRODUCT_REPORT_USER_ID` com o id da conta autorizada. Hoje, admins de
  qualquer workspace criam contas com o e-mail que quiserem, sem confirmação de posse. Se a conta
  autorizada for apagada e recriada por outra pessoa, o id muda e o acesso não acompanha.

Nenhuma permissão, papel ou módulo existente foi alterado.

## Como usar

A tela é o próprio report, no layout de referência da área: cabeçalho com período e status,
mensagem de abertura, **1. Resumo dos Indicadores** (tabelas de Gestão de Produto, GenieX,
Exploradores e Educadores), **2. Evolução dos Indicadores** (6 gráficos) e **Observações e
conclusões executivas**. O HTML e o PDF exportados saem com o mesmo layout, e os gráficos são
literalmente os mesmos (`lib/product-report/charts.ts` gera o SVG da tela e do HTML e as
primitivas que o PDF desenha).

1. Escolha a **quinzena** no seletor do topo. Por padrão a página abre na última quinzena encerrada.
2. **Editar** liga o modo de edição:
   - a "Meta" vale para a quinzena aberta e a "Nova Meta" para a seguinte; meta vazia herda a
     última definida, como na planilha;
   - a mensagem de abertura fica editável (sem texto, vale "Fala pessoal, boa tarde. Segue o report
     referente ao Qx do mês de …");
   - aparece o painel **Dados, fontes e histórico**: atualizar indicadores, projeto de cada
     plataforma, pesos, atualização automática, valores informados e versões finais. Nada desse
     painel entra no report exportado.
3. Se houver **pontos de atenção** nos dados (ausentes, coleta incompleta, atualização antiga ou
   com falha), uma faixa aparece acima do report com o botão "Atualizar indicadores".
4. As **observações** são editadas direto no quadro do fim da página.
5. **Exportar HTML** e **Exportar PDF** baixam o report como está agora.
6. **Compartilhar**:
   - "Concluir e gerar versão final" congela números, metas e textos no histórico e muda o status
     para **Concluído**;
   - "Copiar resumo em texto" copia um resumo para colar no e-mail ou no Slack;
   - "Abrir versão para envio" abre o HTML para imprimir ou anexar.

   Não existe link público: o report continua restrito à conta autorizada.

Status do report: **Concluído** (há versão final da quinzena), **Em revisão** (quinzena encerrada,
sem versão final) ou **Em andamento** (quinzena aberta).

**Valores informados** cobrem só o que a Luumu não mediu numa quinzena (por exemplo, antes da
coleta de analytics existir). O dado da Luumu sempre tem prioridade, e o relatório mostra a origem
de cada número.

## Indicadores e fórmulas

São os mesmos cálculos das telas da Luumu, sem fórmula paralela:

| Indicador | Fonte na Luumu |
|---|---|
| Aderência (%) | KPI "Aderência (DAU/MAU)" do Analytics: DAU médio da quinzena ÷ MAU (30 dias até o fim da quinzena) |
| Tempo de uso (min) | "Tempo médio de uso" do Analytics: duração média das sessões da quinzena |
| CSAT (%) | Score das pesquisas do tipo CSAT do projeto (`lib/scoring.ts`, % top-box). Com várias pesquisas CSAT na quinzena, vale a de mais respostas, como no painel |

A North Star segue a planilha "North Star" (`lib/product-report/indicators.ts`):

- consolidado de cada componente = média das plataformas (o CSAT usa só Exploradores e
  Educadores, porque o GenieX não tem CSAT);
- resultado = consolidado ÷ meta × peso (pesos 30/40/30, editáveis em Fontes de dados);
- North Star = soma dos três resultados, **sem teto**, como na planilha;
- se faltar o dado de uma plataforma, o consolidado e a North Star ficam vazios (não é feita
  média parcial).

Quinzenas: dias 1 a 15 e dia 16 até o fim do mês, no horário de Brasília.

## Atualização automática

Fica **desligada** por padrão. Para ligar, use o interruptor em Fontes de dados.

O cron diário que já existia (`/api/cron/reports`, `vercel.json`) passou a ter mais um passo
(`lib/product-report/cron.ts`). Ele atualiza a última quinzena encerrada se ela ainda não tem uma
atualização feita depois do fim. Na prática, isso roda nos dias 1 e 16. Se falhar, ele tenta de
novo nos dias seguintes, até 3 vezes; depois disso, o botão da tela continua funcionando. Cada
execução cobre uma única quinzena.

- `CRON_SECRET` precisa estar definida na Vercel. Sem ela, a rota do cron fica aberta (isso já
  valia antes deste módulo).
- O cron **não envia e-mail**. O envio automático não foi implementado, e a revisão manual segue
  como padrão. Se for ativado no futuro, mande o **PDF como anexo**: o HTML usa SVG nos gráficos,
  que Gmail e Outlook não exibem.

## Instalação

1. Aplique as migrações em `db/migrations/`:
   - `0032_product_report.sql`: três tabelas novas, sem mexer nas existentes.
   - `0033_product_report_history.sql`: importa o histórico da planilha (Q2 abr a Q2 set/2026)
     para o workspace da conta autorizada. Rode depois que a conta existir. Pode reexecutar: não
     sobrescreve nada.
2. (Recomendado) Defina `PRODUCT_REPORT_USER_ID`.
3. Abra `/product-report` e configure as Fontes de dados.

Observações sobre o histórico importado:

- A planilha não tem as quinzenas Q1 ago, Q2 ago e Q1 set.
- Na Q2 abr, a planilha digitou 15 min no tempo de uso consolidado (a média das plataformas é
  15,17), então a North Star recalculada fica 96,55 em vez de 96,21.

## Arquivos

| Arquivo | Papel |
|---|---|
| `lib/product-report/authorize.ts`, `access.ts` | Regra e guard de acesso |
| `lib/product-report/period.ts` | Calendário de quinzenas |
| `lib/product-report/indicators.ts` | Catálogo de indicadores e fórmula da North Star |
| `lib/product-report/model.ts` | Monta o relatório: origem dos valores, metas herdadas, status, histórico, alertas |
| `lib/product-report/collect.ts` | Busca na Luumu, só leitura |
| `lib/product-report/render-html.ts`, `render-pdf.ts`, `svg-chart.ts` | Exportação |
| `lib/product-report/cron.ts` | Passo do cron diário |
| `lib/db/product-report.ts` | Persistência |
| `app/(app)/product-report/` | Página e server actions |
| `app/api/product-report/export/route.ts` | Exportação HTML e PDF |
| `components/product-report/` | Interface |
