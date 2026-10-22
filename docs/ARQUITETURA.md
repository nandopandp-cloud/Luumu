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

A árvore completa de pastas e arquivos, com a função de cada um, está na seção
[Estrutura do README](../README.md#estrutura).

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
