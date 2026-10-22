# Arquitetura

Visão geral de como o código da Luumu está organizado e de onde cada coisa nova deve entrar.
Detalhes de módulos específicos ficam nas pastas de `docs/` (tours, product-report, infra).

## Visão geral

```
            site do cliente                              painel Luumu
   ┌──────────────────────────────┐            ┌──────────────────────────────┐
   │  <script src="/sdk.js">      │            │  src/app/(app)/*  (RSC)      │
   │  src/sdk/luumu.ts (core)     │            │  src/components/*            │
   │   └ sob demanda: tours,      │            │        │ Server Actions      │
   │     builder, heatmaps,       │            │        ▼                     │
   │     analytics                │            │  src/lib/<domínio>  regras   │
   └──────────────┬───────────────┘            │  src/lib/db/*       dados    │
                  │ fetch (CORS + public key)  └──────────────┬───────────────┘
                  ▼                                           │
        src/app/api/v1/*  ───────────────►  src/lib/db/*  ◄───┘
                                                 │
                                          Neon Postgres (Drizzle)
```

O mesmo código **puro** de `src/lib/<domínio>` (sem DOM, sem banco) é importado pelo painel, pelas
rotas da API e pelo SDK. Assim a regra fica numa fonte só: segmentação por ano escolar,
frequência de tours, posicionamento, limites de heatmap etc.

## Pastas

```
src/
  app/                        rotas (App Router)
    (auth)/                   login
    (app)/                    painel autenticado (AppShell); uma pasta por módulo, cada uma com
                              page.tsx + actions.ts (Server Actions) quando há escrita
    api/v1/                   API PÚBLICA consumida pelo SDK (CORS + chave pública do projeto)
    api/*                     API INTERNA do painel (exports, uploads, busca, cron)
    s/[id]                    página pública de pesquisa (link)
    r/[token]                 relatório público
    demo/                     demonstração do widget
  components/
    ui/                       design system: Button, Card, Dialog, Select, Toast…
    shell/                    AppShell, Sidebar, Topbar, nav.ts (menu)
    <módulo>/                 componentes de uma tela do painel (surveys, tours, insights…)
    surveys/builder/          builder drag-and-drop de pesquisas
  lib/
    db/                       acesso a dados (server-only): client.ts, schema.ts e uma query
                              por agregado (surveys.ts, responses.ts, tours.ts…)
    auth/                     sessão (JWT), senha, usuário/workspace/projeto atuais
    api/                      CORS, chaves e rate limit da API pública
    surveys/                  tipos, templates, builder, vigência, score, sentimento, ano escolar
    tours/ heatmaps/ analytics/ insights/ product-report/ search/ help/
                              regras de cada módulo (puras sempre que possível)
    billing/                  catálogo de planos e limites
    platform/                 hosts dos projetos e plataforma selecionada no header
    email/                    envio (Resend) e templates de e-mail
    export/                   CSV, XLSX e PDF
    ai/                       cliente de LLM
    config/                   URL pública do app e rotas bloqueadas
    utils/                    cn(), formatação, período, ordenação
    mock/                     dados fictícios: telas ainda bloqueadas e o seed
  sdk/                        SDK do cliente; build com scripts/build-sdk.mjs
    luumu.ts                  core (carregado em toda página do cliente)
    tours/ builder/ heatmaps/ analytics/   bundles carregados sob demanda
    shared/                   DOM e memória (localStorage) compartilhados
  types/                      declarações de tipos de terceiros
  proxy.ts                    sessão obrigatória e rotas bloqueadas, antes do render
drizzle/                      migrações SQL (histórico) + meta do drizzle-kit
scripts/                      build-sdk.mjs, seed.ts, prune-events.ts, test-report-email.ts
tests/<módulo>/               *.test.ts (unitário) e *.integration.test.ts (happy-dom)
docs/                         esta documentação; docs/design guarda protótipos e arte-fonte
public/                       mascote, imagens e os bundles gerados do SDK
```

## Onde colocar cada coisa

| Você vai criar… | Lugar |
|---|---|
| Uma tela do painel | `src/app/(app)/<módulo>/page.tsx`, com componentes em `src/components/<módulo>/` |
| Uma mutação disparada pelo painel | `actions.ts` da rota (Server Action), chamando `src/lib/db/*` |
| Uma consulta ou escrita no banco | `src/lib/db/<agregado>.ts`, começando com `import "server-only"` |
| Uma tabela ou coluna | `src/lib/db/schema.ts` + migração SQL em `drizzle/` |
| Uma regra de negócio | `src/lib/<domínio>/`. Se o SDK ou um client component também precisa dela, mantenha o arquivo **puro** (sem `server-only`, `next/*` ou banco) |
| Um endpoint chamado pelo SDK | `src/app/api/v1/<recurso>/route.ts`, usando `src/lib/api/` (CORS, chave, rate limit) |
| Um componente genérico reutilizável | `src/components/ui/` |
| Um item de menu | `src/components/shell/nav.ts` (e a rota em `PROTECTED` do `src/proxy.ts`) |
| Um teste | `tests/<módulo>/`, `.integration.test.ts(x)` quando precisa de DOM |

## Convenções

- **Imports** usam o alias `@/` (aponta para `src/`). A exceção é o SDK, que importa `src/lib`
  por caminho relativo para o esbuild empacotar sem alias.
- **Fronteira servidor/cliente:** tudo que toca banco, cookies ou segredos importa
  `server-only`. Módulos que o cliente ou o SDK usam ficam puros e dizem isso no comentário do topo.
- **Escopo:** toda leitura do painel parte de `getCurrentProjectId()` / `getCurrentWorkspaceId()`
  (`src/lib/auth/current.ts`), que já aplicam as permissões do membro. As funções de `lib/db`
  recebem esse id como parâmetro.
- **Rotas bloqueadas:** módulos sem dados reais ficam em `src/lib/config/locked-routes.ts`,
  que a sidebar e o proxy leem.
- **Arquivos gerados**, não edite à mão: `public/sdk*.js` e `src/lib/tours/sdk-version.ts`
  (saem do `pnpm build:sdk`, que roda sozinho no `prebuild`).

## Banco de dados

`src/lib/db/schema.ts` é a fonte da verdade. `pnpm db:push` sincroniza um banco com ele. Os
arquivos de `drizzle/` são o histórico do que mudou: a partir da `0007` eles são SQL escrito à mão.
Em produção, aplique o SQL novo no SQL Editor do Neon. Telas que dependem de tabelas novas
mostram um aviso apontando a migração que falta.

## Testes

`pnpm test` roda `node:test` via `tsx` com `scripts/tsconfig.scripts.json`, que resolve `@/` e
troca `server-only` por um stub. Os testes de integração montam um DOM com
`tests/tours/support/dom-env.ts`. `tests/product-report/guards.test.ts` lê arquivos de `src/app`
para garantir que toda action e rota do Report Quinzenal passa pelo guard de acesso.
