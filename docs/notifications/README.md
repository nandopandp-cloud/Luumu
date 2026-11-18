# Notificações

Sino no header do produto do cliente (ambiente logado) com um painel de notificações. Fase 1:
**recados** escritos no painel da Luumu. As notificações automáticas (nova Tarefa, nova Prova
Genial, prazo de 24h) entram quando o cliente enviar as atividades (proposta enviada ao time do
GenieX: Opção A `Luumu.notifications.setActivities` ou Opção B webhook).

## Peças

| Peça | Onde |
|---|---|
| Regras puras (status, público, validação, recorte público, datas no fuso) | `src/lib/notifications/model.ts` |
| Banco (configuração do sino, recados, métricas, limpeza) | `src/lib/db/notifications.ts`, tabelas `notification_settings`, `notifications`, `notification_events` (migração `drizzle/0048_notifications.sql`) |
| Painel | `src/app/(app)/notifications/` (lista + "Sino e instalação", `new`, `[id]`), `src/components/notifications/` |
| Catálogo do SDK | campo `notif` do `GET /api/v1/config` |
| Métricas | `POST /api/v1/notifications/events` |
| Sino no produto | `src/sdk/notifications/bell.ts` → `public/sdk-notifications.js` (sob demanda) |

## Como o recado chega ao estudante

1. Publicado no painel, o recado entra no `notif` do `/config` (cacheado 60 s na borda) só para as
   plataformas onde o sino está ligado. Vão os recados no ar e os agendados para as próximas 24h;
   o sino mostra os agendados na hora marcada.
2. O core do SDK guarda o catálogo por **10 min** quando há sino (30 min sem). Um recado publicado
   agora chega em até ~10 min a quem já está navegando; quem abre o produto depois vê na hora.
3. O core baixa `sdk-notifications.js` só se `notif` vier preenchido. O sino aparece só com o
   usuário identificado (`Luumu.identify` com id ou e-mail).
4. Público: anos escolares (mesma regra das pesquisas) e/ou lista de ids/e-mails. A lista **não**
   vai em texto no `/config`: vai o hash (`audienceHash`, sal = id do projeto), comparado com o
   hash do usuário no navegador. Recados "em teste" vão só para os usuários de teste do projeto.

## Onde o sino entra

- `slot` (recomendado): o produto coloca `<div id="luumu-bell"></div>` no header.
- `selector`: um seletor CSS configurado no painel; o sino entra no fim do elemento.
- `floating`: fixo num canto da tela.

Num produto SPA o header é remontado a cada rota: um `MutationObserver` devolve o sino ao lugar.
O painel abre num host próprio no `<body>` (`position: fixed`), para não ser cortado por
`overflow`/`transform` do header. Os dois usam Shadow DOM.

## Lidas e métricas

- Lidas: no `localStorage`, por usuário (hash). Abrir o painel zera o contador; ao fechar, as
  "Novas" passam para "Anteriores". Não sincroniza entre aparelhos (fase 1).
- Métricas: `delivered` (o recado esteve no sino do estudante), `seen` (abriu o painel com ele),
  `click`. Uma linha por (recado, tipo, usuário), com o hash do usuário — nunca id ou e-mail. O SDK
  manda cada uma uma vez, em lote, agrupado por usuário.
- Retenção: o cron diário apaga recados arquivados ou expirados há mais de 90 dias, com as métricas.

## Permissões

Donos, administradores e editores criam, publicam e configuram. Leitores veem a lista e as
métricas (`canEditContent()` em `src/lib/auth/current.ts`; as actions recusam também).

## Aplicar

1. Rode `drizzle/0048_notifications.sql` no SQL Editor do Neon. Sem a migração, o módulo mostra um
   aviso e o `/config` segue sem sino.
2. Deploy. Em Notificações → Sino e instalação: ligue o sino, escolha as plataformas e a posição,
   e cadastre usuários de teste.

## Custo

Sem requisição nova por página: os recados vêm no `/config` que o SDK já busca (cache na borda), e o
TTL menor (10 min) só vale para projetos com o sino ligado. As métricas são um POST em lote por
usuário e recado, só quando há algo novo. Consultas por índice (`notifications_project_idx` e a
chave primária de `notification_events`).
