# Luumu Product Tours — Arquitetura

Tours guiados que o cliente da Luumu cria visualmente e que rodam dentro do produto dele, sem
código. Este documento registra as decisões do MVP e onde cada módulo futuro se encaixa.

---

## 1. Visão geral

```
                    PAINEL LUUMU (Next.js)                            PRODUTO DO CLIENTE
 ┌────────────────────────────────────────────────┐        ┌──────────────────────────────────┐
 │ /tours            lista + métricas             │        │ <script src=".../sdk.js">         │
 │ /tours/[id]       Tour Builder (passos, preview│        │                                  │
 │                   por dispositivo, alvo)       │        │  sdk.js  (core, ~25KB)           │
 │ /tours/[id]/...   público, aparência, versões, │        │   ├─ pesquisas / eventos         │
 │                   analytics                    │        │   └─ ponte de tours (lazy)       │
 └───────────┬────────────────────────────────────┘        │        │                         │
             │ server actions (sessão + projeto)            │        ├─► sdk-tours.js  RUNTIME │
             ▼                                              │        │   (só se houver tour)   │
 ┌────────────────────────────────────────────────┐        │        └─► sdk-builder.js BUILDER│
 │ lib/db/tours.ts        tours, versões, passos   │◄──────┤            (só com token admin) │
 │ lib/db/tour-events.ts  eventos + analytics      │  API  └──────────────────────────────────┘
 │ lib/db/product-registry.ts  Element Registry    │  /api/v1/config        catálogo (+tours)
 │ lib/tours/*  módulos PUROS compartilhados       │  /api/v1/tours/[id]    passos publicados
 │   (tipos, normalização, posição, alvo,          │  /api/v1/tours/preview rascunho (token)
 │    condições, frequência, render do card)       │  /api/v1/tours/events  eventos em lote
 └────────────────────────────────────────────────┘  /api/v1/builder/*     discovery + passos
```

Separação de módulos (cada um substituível sem reescrever os outros):

| Módulo | Onde | Responsabilidade |
|---|---|---|
| **Discovery** | `sdk/builder/discovery.ts` | Varre o DOM no modo builder e descreve elementos relevantes |
| **Element Registry** | `lib/db/product-registry.ts`, tabelas `product_routes` / `product_elements` | Guarda o que o discovery viu, por plataforma e rota |
| **Identificação** | `lib/tours/target.ts` (puro) + `sdk/tours/resolve.ts` (DOM) | Descritor resiliente do alvo e resolução em tempo de execução |
| **Builder** | `components/tours/*` (painel) + `sdk/builder/*` (overlay no produto) | Montar passos, selecionar elemento, preview |
| **Runtime** | `sdk/tours/*` | Exibir o tour: navegação, espera, posição, foco, eventos |
| **Analytics** | `lib/db/tour-events.ts` | Ingestão e métricas (funil por passo, conclusão, tempo, alvos ausentes) |
| **API** | `app/api/v1/tours/*`, `app/api/v1/builder/*` | Contratos públicos com CORS, key e token |
| **Database** | `db/schema.ts` + `db/migrations/0016_product_tours.sql` | Neon Postgres via Drizzle |

O que é **puro** (sem DOM, sem banco) fica em `lib/tours/` e é importado tanto pelo painel
(React) quanto pelos bundles do SDK (esbuild). É a mesma regra de posição e o mesmo HTML do
card nos dois lados: o preview do painel é idêntico ao que o usuário final vê.

---

## 2. Modelo de dados

```
tours ─┬─< tour_versions ─┬─< tour_steps          (target + route embutidos no passo)
       │   (version 0 =   │
       │    rascunho)     └── settings jsonb       (gatilho, frequência, público,
       │                                            plataformas, aparência)
       └─< tour_events                              (analytics)

product_routes ─< product_elements                  (Element Registry, por host + rota)
```

- **tours** — `id, workspace_id, project_id, name, description, status (draft|published|archived),
  published_version_id, has_unpublished_changes, created_by, created_at, updated_at`.
- **tour_versions** — `id, tour_id, project_id, version (0 = rascunho, 1..n publicadas),
  status (draft|published|superseded), settings jsonb, published_at, published_by`.
  Um tour tem sempre exatamente uma versão 0 (o rascunho). Publicar **copia** o rascunho para
  uma nova versão `n+1`; o publicado nunca é editado no lugar. Restaurar copia uma versão antiga
  de volta para o rascunho.
- **tour_steps** — `id, version_id, tour_id, key, order, type, title, body, route, target jsonb,
  config jsonb`. `key` é estável entre versões (o mesmo passo na v1 e na v3 tem a mesma key), o
  que permite comparar o funil entre versões.
- **tour_events** — `id, workspace_id, project_id, tour_id, version_id, step_key, type, user_id,
  anonymous_id, session_id, route, host, meta, created_at`.
- **product_routes / product_elements** — registro do discovery, único por
  `(project, host, route[, fingerprint])`, com teto por projeto.

**Entidades do briefing como JSON tipado.** `TourStepTarget`, `TourCondition`, `TourSegment`
e `TourTrigger` são estruturas tipadas (`lib/tours/types.ts`) gravadas em `tour_steps.target`,
`tour_steps.config.conditions` e `tour_versions.settings`. Elas são sempre lidas e gravadas
junto com o passo/versão a que pertencem, e versionar como linhas separadas só multiplicaria
cópias no publish. Se um dia precisarem de consulta própria (ex.: "todos os tours com gatilho
X"), viram tabela sem mudar o formato da API.

**Multi-tenancy.** Toda tabela tem `workspace_id` e `project_id`. O painel resolve o projeto
pela sessão (`getCurrentProjectId`, já com o escopo do membro) e toda função de `lib/db/tours.ts`
recebe o projeto e confere a posse antes de ler ou escrever. A API pública resolve o projeto pela
SDK key; as rotas de builder exigem um token assinado cujo projeto precisa ser o da key.

---

## 3. Fluxo do Builder

```
Painel                                                      Produto do cliente
──────                                                      ──────────────────
1. Novo tour (nome)  ──► cria tour + rascunho com 1 passo de boas-vindas
2. Construtor: lista de passos (drag & drop), editor, preview Desktop/Tablet/Mobile
3. "Editar produto" ──► server action gera token (JWT 4h: projeto, tour, usuário)
                    ──► abre  https://produto/rota?luumu_builder=<token>   ───►  sdk.js lê o token,
                                                                                guarda em sessionStorage,
                                                                                limpa a URL e carrega
                                                                                sdk-builder.js
                                                            4. Barra Luumu no topo do produto
                                                               [Selecionar] [Navegar] [Concluir]
                                                            5. Hover: contorno + "Selecionar elemento"
                                                               Clique: painel com nome, tipo, página,
                                                               identificação e [Adicionar ao tour]
                                                            6. POST /api/v1/builder/steps
                                                               (passo entra no RASCUNHO)
7. Painel recebe postMessage do produto e recarrega
   (ou ao voltar o foco para a aba) ──► passo aparece na lista
8. "Preview no produto" ──► token de preview  ──►  runtime roda o RASCUNHO a partir do passo N,
                                                   sem frequência, sem segmentação, sem analytics
9. Publicar ──► nova versão; /config passa a anunciar o tour (até 60s de borda)
```

**Por que janela e não iframe.** A maioria dos produtos bloqueia ser emoldurada
(`X-Frame-Options`/CSP `frame-ancestors`), e o login do cliente costuma depender de cookies que
um iframe de terceiro não recebe. O builder roda **dentro do produto real**, como overlay do
próprio SDK — funciona em qualquer framework e com a sessão do administrador. O preview
dentro do painel (mock de navegador por dispositivo) é para o conteúdo e a posição do card;
o preview real é sempre no produto.

O discovery roda **só** em modo builder: cada rota visitada pelo administrador é varrida e
enviada ao Element Registry. Usuários finais nunca pagam esse custo.

---

## 4. Fluxo do SDK (usuário final)

```
sdk.js carrega
  └─ GET /api/v1/config?key&host      (já existia; agora inclui `tours`: id, versão, gatilho,
                                        frequência, público — SEM os passos)
       └─ algum tour elegível neste navegador? (frequência local + gatilho + público)
            não → nada mais acontece (zero bytes extras)
            sim → <script sdk-tours.js?v=BUILD>  (lazy, cacheado)
                   └─ GET /api/v1/tours/[id]?key&v=   (passos publicados, cache de borda)
                   └─ para cada passo:
                        rota diferente? → clica no link da própria app para a rota
                                          (router do cliente cuida) ou location.assign
                        espera rota → waitForElement (MutationObserver + polling, timeout)
                        não achou? → evento tour_target_not_found → pula (padrão) ou encerra
                        rola até o elemento → posiciona card (flip + clamp) → foco
                   └─ eventos em lote → POST /api/v1/tours/events (sendBeacon no pagehide)
```

- **Estado entre páginas.** O tour ativo fica em `sessionStorage` (`tourId, versão, passo`):
  numa app multipágina (ou num router que recarrega), o runtime retoma no passo certo.
- **SPAs.** O core já intercepta `pushState`/`replaceState`/`popstate`; o runtime observa a
  rota e o DOM, sem depender de framework.
- **Isolamento.** Tudo é renderizado num Shadow DOM próprio, com `:host { all: initial }`. O
  CSS do cliente não entra; o nosso não sai. O runtime nunca altera elementos do cliente — o
  destaque é desenhado por cima (camada fixa), não via classes no alvo.
- **Defensivo.** Cada ponto de entrada (`boot`, `start`, cada passo, cada evento) tem
  try/catch. Falha vira `tour_error` e o tour encerra; a aplicação do cliente nunca recebe uma
  exceção nossa.
- **Segurança.** Nenhum `eval`/`Function`. Texto é escapado. Ações são uma whitelist
  (`none | navigate | open_url | track`), URLs só `http(s)` e rotas só caminhos relativos.

---

## 5. Descoberta de elementos (Product Discovery Engine)

Candidatos (nunca o DOM inteiro):

- `button`, `a[href]`, `input` (exceto `password` e `hidden`), `select`, `textarea`, `summary`;
- `[role=button|link|tab|menuitem|option|switch|checkbox|radio|treeitem]`;
- `[data-luumu-id]`, `[aria-label]` em elementos interativos, `[tabindex]` ≥ 0;
- landmarks de navegação (`nav a`, `[role=navigation] *`) recebem o tipo `navigation`.

Filtros: visível (tem caixa, não `display:none`/`visibility:hidden`/opacidade 0), não está
dentro de outro candidato já escolhido (evita registrar o ícone *e* o botão), não pertence a
um Shadow DOM da Luumu. Teto de 300 elementos por rota.

**Privacidade.** O discovery lê rótulos (texto visível curto, `aria-label`, `placeholder`,
`name`), nunca `value` de campos. Inputs de senha são ignorados por completo. Texto longo
(conteúdo, não ação) é truncado — a mesma regra `looksLikeContent` do auto-tracking.

---

## 6. Identificação resiliente

Ao selecionar um elemento, o SDK grava um **descritor** com várias estratégias, não um seletor:

```ts
{
  luumuId, elementId, testId, ariaLabel, role, tag, text, name, href,
  classes /* só as estáveis */, path /* caminho semântico curto */,
  selector /* fallback */, fingerprint, strategy /* a melhor disponível */, stability
}
```

Resolução em tempo de execução (`sdk/tours/resolve.ts`), em ordem de prioridade:

1. `data-luumu-id` — se existir, decide sozinho (prioridade absoluta);
2. `id` estável (sem dígitos aleatórios / hash);
3. `data-testid` / `data-test` / `data-cy`;
4. `aria-label` + tag;
5. tag/role + texto normalizado (sem acento, caixa, espaços);
6. caminho semântico (landmark → … → elemento) e classes estáveis;
7. `fingerprint` (hash de tag, role, texto, aria, landmark ancestral);
8. seletor CSS de fallback.

Cada candidato recebe uma **pontuação** somando os sinais que batem (`scoreCandidate`, puro e
testado). Vence o de maior pontuação acima de um mínimo; entre empates, o visível e o mais
próximo do viewport. Isso tolera textos alterados, classes geradas (CSS Modules,
styled-components, Emotion — descartadas por `isStableClass`) e reordenação do DOM.

`stability` (0–1) é mostrado no builder: alto com `data-luumu-id`, baixo quando só há seletor.
Abaixo de 0,5 o painel sugere adicionar `data-luumu-id` no elemento.

---

## 7. API

Painel (server actions, sessão + projeto): `createTour`, `saveTourDraft`, `publishTour`,
`restoreTourVersion`, `setTourStatus` (arquivar/reativar), `duplicateTour`, `deleteTour`,
`createBuilderLink` (token de builder ou preview).

Pública (CORS, `key` = SDK key pública):

| Rota | Uso | Cache |
|---|---|---|
| `GET /api/v1/config?key&host` | catálogo (pesquisas + `tours`) | borda 60s |
| `GET /api/v1/tours/[id]?key&v` | passos da versão publicada | borda 60s |
| `GET /api/v1/tours/preview?token` | rascunho para preview | sem cache |
| `POST /api/v1/tours/events` | eventos em lote `{key, events[]}` | — |
| `GET /api/v1/builder/session?token` | dados do tour para a barra do builder | sem cache |
| `POST /api/v1/builder/discovery` | elementos de uma rota `{token, host, route, elements[]}` | — |
| `POST /api/v1/builder/steps` | adicionar passo / trocar alvo `{token, ...}` | — |

SDK (`window.Luumu`):

```js
Luumu.identify({ id, email, name, role, plan, ...traits })   // traits viram segmentação
Luumu.track("project_created")                               // dispara/avança tours
Luumu.tours.start("tour_id")   Luumu.tours.stop()   Luumu.tours.next()   Luumu.tours.previous()
Luumu.tours.skip()   Luumu.tours.complete()   Luumu.tours.isActive()   Luumu.tours.getCurrentStep()
```

Os métodos de `Luumu.tours` existem desde o core; o primeiro uso carrega o runtime sob demanda.

---

## 8. Estrutura de pastas

```
lib/tours/            puro e compartilhado (painel + SDK)
  types.ts            contratos: TourStep, ElementTarget, TourSettings, Rule, eventos
  defaults.ts         passo/config padrão por tipo
  normalize.ts        validação/whitelist de tudo que vem do cliente ou do painel
  position.ts         computePosition (placements, flip, clamp, seta)
  target.ts           isStableClass, normalizeText, scoreCandidate, routeMatches, fingerprint
  conditions.ts       avaliação de regras (segmentação e condições de passo)
  frequency.ts        decisão de exibição por frequência
  render.ts           HTML + CSS do card (mesmo no preview e no runtime)
  token.ts            token de builder/preview (server-only)
lib/db/tours.ts, tour-events.ts, product-registry.ts
app/api/v1/tours/*, app/api/v1/builder/*
app/(app)/tours/*     telas do painel
components/tours/*    componentes do builder
sdk/luumu.ts          core: ponte + carregamento sob demanda
sdk/tours/            runtime.ts, resolve.ts, dom.ts
sdk/builder/          builder.ts, discovery.ts
tests/tours/          testes unitários e de integração (node:test)
```

---

## 9. Plano por etapas

| Etapa | Entrega | Status |
|---|---|---|
| 1 | Schema, migração, normalização e tipos | MVP |
| 2 | Painel: lista, criação, Construtor (passos, DnD, editor, preview por dispositivo) | MVP |
| 3 | Público e gatilho (first access, carregamento, evento, manual), frequência, plataformas | MVP |
| 4 | Aparência (temas, cor, progresso, dispensar) | MVP |
| 5 | Publish/versões/rollback | MVP |
| 6 | Runtime: tooltip, popover, modal, spotlight; navegação entre rotas; responsivo; eventos | MVP |
| 7 | Builder no produto: overlay de seleção + discovery + Element Registry | MVP |
| 8 | Analytics básico (funil, conclusão, abandono, tempo, alvo ausente) | MVP |
| 9 | Checklist, full screen, vídeo, condições por evento avançadas | futuro |
| 10 | Gerar tour com IA (usa só `product_elements`, nunca inventa alvo) | futuro |
| 11 | A/B, idiomas, branching | futuro |

Ganchos já previstos para o futuro: `StepType` aceita novos tipos sem migração (o render é por
tipo); `TourTrigger` é união discriminada; o Element Registry já guarda rota, texto, tipo e
descrição (`data-luumu-description`) — exatamente o contexto que um gerador por IA precisa.

---

## 10. Testes

`node --import tsx --test --test-force-exit "tests/**/*.test.ts"` (script `test` do package.json).

| Arquivo | Tipo | Cobre |
|---|---|---|
| `tests/tours/position.test.ts` | unitário | placements, flip, auto, clamp na tela, seta, mobile |
| `tests/tours/target.test.ts` | unitário | ids/classes instáveis, texto, rotas com parâmetro, pontuação, prioridade de estratégia |
| `tests/tours/conditions-frequency.test.ts` | unitário | regras (texto, número, lista, rota), all/any, públicos, frequências |
| `tests/tours/normalize-render.test.ts` | unitário | whitelist de URLs/ações, limites, responsivo, escape de HTML |
| `tests/tours/dom.integration.test.ts` | integração (happy-dom) | discovery (privacidade, ocultos, aninhados), resolução após deploy, `waitForElement` |
| `tests/tours/runtime.integration.test.ts` | integração (happy-dom) | tour completo: modal → alvo → alvo ausente pulado → outra rota (SPA) → conclusão, eventos, frequência, ESC |

`--test-force-exit` é necessário porque o runtime mantém de propósito um observador de rota
permanente (é o comportamento certo numa página real).

**E2E (ainda não automatizado).** Precisa de Playwright e de um produto de teste com o SDK.
Roteiro manual até lá:

1. Criar tour → "Editar no produto" → login no produto → selecionar 2 elementos em telas
   diferentes → os passos aparecem no Construtor sem recarregar.
2. Reordenar com arrastar, trocar posição no mobile, "Preview no produto" a partir do passo 2.
3. Publicar → abrir o produto numa janela anônima → o tour aparece (primeiro acesso), navega
   entre as telas e conclui → Analytics mostra 1 iniciado / 1 concluído.
4. Alterar o texto de um botão-alvo no produto → o tour ainda o encontra.
5. Remover um alvo → passo pulado, "elementos não encontrados" sobe no Analytics.
6. Restaurar a v1 em Versões → publicar → v3 no ar com o conteúdo da v1.

## 11. Limitações conhecidas do MVP

- **Frequência é por navegador** (por usuário identificado dentro do navegador). Um usuário que
  troca de dispositivo pode ver de novo um tour com "uma vez". Guardar o progresso no servidor
  por `userId` é a evolução natural (a tabela `tour_events` já tem os dados).
- **"Primeiro acesso"** é a primeira sessão em que o SDK roda naquele navegador. Num produto
  com o SDK instalado há tempo, usuários antigos não contam como primeiro acesso; para eles, use
  "Ao abrir uma página" com público "Novos usuários" ou uma regra (`user.createdAt`...).
- **Navegação entre rotas** usa um link da própria aplicação para a rota (o router do cliente
  cuida). Sem link na tela, recarrega a página e retoma do `sessionStorage`. Rotas com
  parâmetro (`/projetos/:id`) não são navegadas automaticamente: o passo espera o usuário
  chegar lá e, no tempo limite, é pulado.
- **Preview no painel** usa uma página-esqueleto; o preview fiel é o "Preview no produto".
- **Fora do MVP** (previsto na arquitetura): checklist, full screen, vídeo, gerador por IA,
  A/B, idiomas, branching.
