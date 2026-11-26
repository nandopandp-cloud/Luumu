# Notificações

Sino no header do produto do cliente (ambiente logado), com um painel de notificações. As
notificações só existem dentro do produto: não há push no celular nem e-mail (decisão de produto,
nov/2026). Nada é "enviado": o navegador do estudante busca o que existe e decide o que mostrar.

Dois tipos de conteúdo:

1. **Recados**, escritos no painel da Luumu.
2. **Avisos automáticos de atividades**: "Nova tarefa", "Nova Prova Genial" e "Falta 1 dia". São
   alimentados por um **webhook por turma** que o back-end do cliente chama. O contrato com o
   cliente, incluindo quem faz o quê, está em [INTEGRACAO.md](INTEGRACAO.md).

## Peças

| Peça | Onde |
|---|---|
| Regras puras dos recados (status, público, validação, recorte público, datas) | `src/lib/notifications/model.ts` |
| Regras puras dos avisos automáticos (turmas, feed, "nova", prazo, conclusão, textos) | `src/lib/notifications/activities.ts` |
| Leitura do webhook (eventos, campos, motivos de recusa) | `src/lib/notifications/webhook.ts` |
| Assinatura do webhook (HMAC, janela de 5 min) | `src/lib/notifications/signature.ts` |
| Banco dos recados | `src/lib/db/notifications.ts`, tabelas `notification_settings`, `notifications`, `notification_events` (migração `0048`) |
| Banco dos avisos automáticos | `src/lib/db/notification-activities.ts`, tabelas `notification_webhooks`, `notification_activities`, `notification_webhook_deliveries`, `notification_activity_stats` (migração `0051`) |
| Painel | `src/app/(app)/notifications/` e `src/components/notifications/` (abas Recados, **Avisos automáticos**, Sino e instalação) |
| Catálogo do SDK | campo `notif` do `GET /api/v1/config` (`notif.auto` = avisos automáticos ligados) |
| Webhook do cliente | `POST /api/v1/notifications/webhook?key=pk_...` |
| Lista da turma | `GET /api/v1/notifications/feed?key=pk_...&c=<turma>` (CDN, 2 min) |
| Métricas | `POST /api/v1/notifications/events` |
| Sino no produto | `src/sdk/notifications/bell.ts` → `public/sdk-notifications.js` (sob demanda) |

## Como um recado chega ao estudante

1. Publicado no painel, o recado entra no `notif` do `/config`, que fica em cache na borda por
   60 s. Ele só vai para as plataformas onde o sino está ligado. Vão os recados no ar e os
   agendados para as próximas 24h; o sino mostra os agendados na hora marcada.
2. O core do SDK guarda o catálogo por **20 min** quando há sino (30 min sem). Um recado publicado
   agora chega em até ~20 min a quem já está navegando. Quem abre o produto depois vê na hora.
3. O core baixa `sdk-notifications.js` só se `notif` vier preenchido. O sino aparece só com o
   usuário identificado (`Luumu.identify` com id ou e-mail).
4. Público: anos escolares (mesma regra das pesquisas) e/ou lista de ids e e-mails.
   - A lista **não** vai em texto no `/config`. Vai o hash (`audienceHash`, com o id do projeto
     como sal), comparado com o hash do usuário no navegador.
   - Recados "em teste" vão só para os usuários de teste do projeto.

## Como um aviso automático chega ao estudante

```
back-end do cliente ──POST assinado──▶ /notifications/webhook ──▶ notification_activities
                                                                      (1 linha por atividade,
                                                                       class_ids text[] + GIN)
navegador: identify({ class_ids }) ──GET por turma──▶ /notifications/feed (CDN 2 min)
           sino calcula "nova", prazo e conclusão (activities.ts) ──métricas──▶ /notifications/events
```

1. **Webhook** (`webhook/route.ts`), em ordem:
   1. resolve o projeto pela chave pública;
   2. aplica o limite de 600 requisições por minuto por projeto;
   3. confere a assinatura com o segredo atual ou com o anterior (válido por 24h depois de uma
      troca);
   4. lê cada evento (`parseEvent`). O corpo pode ter um evento ou um lote de até 100.
2. **Aplicação** (`applyActivityEvent`):
   - O mesmo `id` de evento volta como `duplicate`, sem mexer em nada.
   - O upsert só vale se o `occurredAt` do evento for maior ou igual ao guardado (`setWhere`).
     Se for mais antigo, volta como `stale`.
   - O cancelamento de uma atividade desconhecida grava a marca de cancelada. Assim um `assigned`
     atrasado não ressuscita a atividade.
   - A atividade é gravada antes do registro em `notification_webhook_deliveries`. Uma falha no
     meio é refeita pelo reenvio do cliente, porque gravar a mesma fotografia duas vezes dá no
     mesmo.
3. **Recusas:**
   - Evento inválido e assinatura errada também vão para o registro, com o motivo, e aparecem
     no painel.
   - A chave do registro é gerada pela Luumu, e não é o `id` do cliente: assim o evento corrigido
     não é tomado por repetido.
4. **Feed:**
   - O `/config` leva `notif.auto = { n, d }`: n = avisar novas, d = horas antes do prazo.
   - O sino lê `class_ids` (ou `classIds`) do identify, até 10 turmas, e busca o feed de cada uma:
     ao montar, a cada 5 min com a aba visível e ao voltar para a aba (no mínimo 1 min entre
     buscas).
   - O feed traz as atividades em aberto da turma, até 100, com o prazo mais próximo primeiro:
     - liberadas, ou com liberação na próxima 1h;
     - com prazo no futuro;
     - ou sem prazo e liberadas há até 30 dias.
5. **Cálculo no sino** (`activityItems`):
   - "nova" vale por 7 dias depois da liberação;
   - o lembrete de prazo vale da antecedência configurada até o prazo, e o id dele leva o prazo
     (prazo novo = aviso novo);
   - na primeira sincronização daquele estudante naquele navegador, o que foi liberado há mais de
     48h entra como lido;
   - a mesma atividade em duas turmas vira um aviso só.
6. **Conclusão** (`isCompletionPath`):
   - conta a tela de resultado do tipo da atividade (as rotas "concluiu" de
     `lib/analytics/journey.ts`), dentro do link dela;
   - o sino confere a cada mudança no DOM (SPA), no `popstate`, a cada minuto e logo depois de
     ler o feed;
   - o produto também pode avisar a conclusão por `Luumu.notifications.complete(id)`;
   - as concluídas ficam em `localStorage` por estudante (`luumu_ntf_act_<hash>`).
7. **Métricas:**
   - O id do aviso (`n:<atividade>` ou `d:<atividade>:<prazo>`) vai no mesmo
     `/notifications/events` dos recados.
   - O servidor separa pelo prefixo (`parseItemId`) e soma em `notification_activity_stats`, por
     atividade, aviso, tipo e dia, sem guardar o usuário.
   - O navegador já manda cada (aviso, tipo) uma vez por estudante.

### Tempos

| O quê | Atraso |
|---|---|
| Atividade nova, para quem abre o produto depois | até ~2 min (CDN do feed) |
| Atividade nova, para quem já está com o produto aberto | até ~7 min (CDN + busca a cada 5 min) |
| Lembrete de prazo | na hora (cálculo local a cada minuto) |
| Ligar e desligar no painel | até ~20 min (catálogo do SDK) |

### Custo

- O webhook recebe alguns milhares de requisições por mês.
- O feed é cacheado por turma na CDN. A função roda no máximo uma vez a cada 2 min por turma com
  estudante online: com algumas centenas de turmas online ao mesmo tempo, é da ordem de 1 a 4
  milhões de invocações por mês, ou ~US$ 1 a 3 no excedente da Vercel. Cada consulta é uma
  leitura por índice GIN.
- No Neon:
  - uma linha por atividade;
  - um registro por evento, guardado por 30 dias;
  - contadores por atividade e dia.
  Tudo da ordem de milhares de linhas por mês, centavos.

## Onde o sino entra

- `slot` (recomendado): o produto coloca `<div id="luumu-bell"></div>` no header.
- `selector`: um seletor CSS configurado no painel; o sino entra no fim do elemento.
- `floating`: fixo num canto da tela.

Num produto SPA o header é remontado a cada rota, e um `MutationObserver` devolve o sino ao
lugar. O painel abre num host próprio no `<body>` (`position: fixed`), para não ser cortado por
`overflow` ou `transform` do header. Os dois usam Shadow DOM.

## Lidas e métricas dos recados

- **Lidas:**
  - ficam no `localStorage`, por usuário (hash);
  - abrir o painel zera o contador, e ao fechar as "Novas" passam para "Anteriores";
  - não sincroniza entre aparelhos.
- **Métricas:**
  - tipos: `delivered` (o recado esteve no sino do estudante), `seen` (abriu o painel com ele) e
    `click`;
  - uma linha por (recado, tipo, usuário), com o hash do usuário, nunca o id ou o e-mail;
  - o SDK manda cada uma uma vez, em lote, agrupado por usuário.

## Retenção (cron diário, `api/cron/reports`)

- Recados arquivados ou expirados há mais de 90 dias saem com as métricas (`pruneNotifications`).
- Atividades (`pruneActivities`), junto com as métricas delas:
  - canceladas ou com prazo vencido há mais de 30 dias;
  - sem prazo, liberadas há mais de 60 dias.
- Registros de envio do webhook: 30 dias.

## Permissões

- Donos, administradores e editores criam, publicam e configuram: recados, sino e avisos
  automáticos.
- O **segredo do webhook** só é visto e trocado por donos e administradores
  (`canManageWorkspace`), porque dá acesso de escrita.
- Leitores veem as listas e as métricas.

## Aplicar

1. Rode `drizzle/0048_notifications.sql` (recados) e `drizzle/0051_notification_activities.sql`
   (avisos automáticos) no SQL Editor do Neon. Sem a 0051:
   - o webhook responde 503;
   - a aba Avisos automáticos mostra o aviso da migração;
   - os recados seguem normais.
2. Faça o deploy.
3. Em Notificações → Sino e instalação, ligue o sino, escolha as plataformas e a posição, e
   cadastre usuários de teste.
4. Em Notificações → Avisos automáticos:
   1. gere o segredo e entregue a URL e o segredo ao time do produto;
   2. acompanhe os envios em homologação;
   3. ligue os avisos.

## Diagnóstico

| Sintoma | Onde olhar |
|---|---|
| O produto diz que mandou, mas nada aparece no painel | `401` na resposta do webhook: chave, segredo ou relógio. Recusas por assinatura aparecem em *Últimos envios* como "Assinatura inválida". |
| O evento chegou ("Aplicado"), mas o estudante não vê | 1. *Ver como uma turma* com o id da turma: a atividade está lá? 2. `Luumu.notifications.debug()` no console do estudante: as turmas do identify batem com as do webhook? Os avisos estão ligados? 3. O sino está ligado nesta plataforma? |
| O aviso não some depois de concluir | O `activity.url` aponta para a página da atividade? A tela de resultado está dentro dele (`…/t123/complete`)? Senão, o produto chama `Luumu.notifications.complete(id)`. |
| "Ignorado (mais antigo)" em *Últimos envios* | Já chegou um evento com `occurredAt` mais recente para essa atividade. Isso é esperado em filas fora de ordem. |
