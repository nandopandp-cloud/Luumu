# Luumu

**Ouça. Entenda. Melhore.**

Plataforma SaaS de Voice of Customer que une **Feedback**, **Analytics** e **Behavior** numa
solução só: pesquisas in-app (CSAT, NPS, CES, PMF…), product tours, heatmaps, analytics de
produto, insights com IA e relatórios. Os clientes instalam um **SDK JavaScript** no próprio
site e administram tudo pelo **painel**.

## Stack

| Camada | Tecnologia |
|---|---|
| App | **Next.js 16** (App Router, Server Actions, `proxy.ts`) + **React 19** + **TypeScript** |
| UI | **Tailwind CSS v4** com o Design System da Luumu, **Recharts**, **@dnd-kit**, **lucide-react** |
| Banco | **Neon Postgres** via **Drizzle ORM** |
| Arquivos | **Vercel Blob** (logos, avatares, imagens de tour) |
| E-mail | **Resend** |
| IA | LLM compatível com a API da OpenAI (padrão: Groq), ver `src/lib/ai/llm.ts` |
| SDK | TypeScript puro empacotado com **esbuild** em `public/sdk*.js` |
| Deploy | **Vercel** (região `gru1`, cron diário de relatórios em `vercel.json`) |

## Começando

Requisitos: Node 22+ e pnpm (via `corepack enable`).

```bash
pnpm install
cp .env.example .env.local   # ou: vercel env pull .env.local
pnpm db:push                 # sincroniza o schema com o banco
pnpm db:seed                 # (opcional) workspace demo, imprime o login de teste
pnpm dev                     # http://localhost:3000
```

### Variáveis de ambiente

| Variável | Obrigatória | Uso |
|---|---|---|
| `DATABASE_URL` | sim | Conexão Neon (pooled) usada pelo app |
| `DATABASE_URL_UNPOOLED` | recomendada | Conexão direta usada pelo drizzle-kit e pelo seed |
| `AUTH_SECRET` | sim | Assinatura do JWT de sessão. Sem ela o `proxy.ts` falha no boot |
| `BLOB_READ_WRITE_TOKEN` | para uploads | Vercel Blob |
| `RESEND_API_KEY`, `EMAIL_FROM` | para e-mails | Envio de relatórios e solicitações de plano |
| `SALES_EMAIL` | não | Destino das solicitações de plano |
| `CRON_SECRET` | em produção | Protege `/api/cron/reports` |
| `NEXT_PUBLIC_APP_URL` | não | URL pública para links absolutos (cai para a URL da Vercel) |
| `GROQ_API_KEY` ou `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` / `AI_FALLBACK_MODEL` | para IA | Insights com IA |
| `PRODUCT_REPORT_USER_ID` | não | Conta com acesso ao Report Quinzenal |

## Scripts

| Comando | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Compila o SDK (`prebuild`) e depois o Next |
| `pnpm build:sdk` | Só os bundles do SDK em `public/` |
| `pnpm test` | Testes (`node:test` + `tsx`, DOM via happy-dom) |
| `pnpm lint` | ESLint |
| `pnpm db:push` / `pnpm db:studio` | Drizzle Kit: sincronizar schema / abrir o Studio |
| `pnpm db:seed` | Popula um workspace demo |

## Estrutura

Todo o código-fonte fica em `src/`, e o alias `@/` aponta para lá (`@/lib/db/surveys` →
`src/lib/db/surveys.ts`). Na raiz ficam só configuração, migrações, scripts, testes e docs.

```
luumu/
├── src/
│   ├── app/                          rotas (Next.js App Router)
│   │   ├── (auth)/                   login: AuthForm, BrandPanel, actions.ts
│   │   ├── (app)/                    painel autenticado (layout com AppShell)
│   │   │   ├── dashboard/            visão geral do projeto
│   │   │   ├── surveys/              lista, nova pesquisa e /[id]: builder, appearance,
│   │   │   │                         preview, responses, settings
│   │   │   ├── responses/            feed de respostas
│   │   │   ├── tours/                product tours e /[id]: analytics, appearance,
│   │   │   │                         settings, versions
│   │   │   ├── heatmaps/             mapas de clique, movimento e scroll
│   │   │   ├── replay/               session replay (bloqueado, dados mock)
│   │   │   ├── analytics/            analytics de produto
│   │   │   ├── insights/             insights com IA
│   │   │   ├── reports/              relatórios agendados e links públicos
│   │   │   ├── product-report/       Report Quinzenal (acesso restrito)
│   │   │   ├── settings/             perfil, membros, cobrança, SDK, integrações
│   │   │   ├── billing/              plano e uso
│   │   │   ├── projects/             actions de projetos
│   │   │   ├── sdk/                  instalação do SDK
│   │   │   └── help/                 central de ajuda
│   │   ├── api/
│   │   │   ├── v1/                   API PÚBLICA usada pelo SDK (CORS + chave do projeto):
│   │   │   │                         config, collect, events, responses, surveys, tours,
│   │   │   │                         builder, heatmaps, analytics, avatars
│   │   │   └── …                     API INTERNA do painel: exports (analytics, reports,
│   │   │                             product-report), uploads (logo, avatar, tours), search,
│   │   │                             usage, events/status, cron/reports
│   │   ├── s/[id]/                   página pública de pesquisa (link compartilhável)
│   │   ├── r/[token]/                relatório público
│   │   ├── demo/                     demonstração do widget
│   │   ├── layout.tsx · page.tsx · error.tsx · global-error.tsx · globals.css · icon.png
│   │
│   ├── components/                   componentes React
│   │   ├── ui/                       design system: Button, Card, Badge, Dialog, Drawer,
│   │   │                             Input, Select, Tabs, Toast, Skeleton, MetricCard,
│   │   │                             Mascot, LuumuLogo, EmptyState, DataFilters…
│   │   ├── shell/                    AppShell, Sidebar, Topbar, ProjectSwitcher,
│   │   │                             PlatformPicker, PlanUsageMenu, ThemeToggle, nav.ts (menu)
│   │   ├── surveys/                  tabela, renderer, widget, aparência, settings, publicar
│   │   │   └── builder/              builder drag-and-drop de perguntas
│   │   ├── tours/                    builder de tours, editor de passos, alvo, versões, analytics
│   │   ├── responses/                feed de respostas e exportação
│   │   ├── insights/                 telas de insights + chat/ (perguntas à IA)
│   │   ├── analytics/                views, widgets e lista de usuários
│   │   ├── heatmaps/                 workspace, filtros e mapa da página
│   │   ├── dashboard/                cards do dashboard
│   │   ├── reports/                  exportação, agendamento e links públicos
│   │   ├── product-report/           tela e configurações do Report Quinzenal
│   │   ├── billing/                  planos, comparação e uso
│   │   ├── settings/                 formulários de perfil, workspace e membros
│   │   ├── sdk/                      snippets de instalação e captura de identidade
│   │   ├── search/                   paleta de comandos (⌘K)
│   │   ├── help/                     central de ajuda
│   │   ├── replay/                   player de sessão
│   │   ├── charts/                   gráficos Recharts genéricos
│   │   ├── illustrations/            ilustrações SVG
│   │   ├── intro/                    animação de entrada pós-login
│   │   └── page-loader/              loader entre rotas
│   │
│   ├── lib/                          regras de negócio e acesso a dados, por domínio
│   │   ├── db/                       acesso ao banco (server-only)
│   │   │   ├── client.ts             conexão Neon + Drizzle
│   │   │   ├── schema.ts             schema do banco (fonte da verdade)
│   │   │   └── *.ts                  uma query por agregado: surveys, responses, tours,
│   │   │                             heatmaps, analytics, reports, users, workspace…
│   │   ├── auth/                     session.ts (JWT), password.ts, current.ts (usuário,
│   │   │                             workspace e projeto atuais + permissões)
│   │   ├── api/                      cors.ts, keys.ts, ratelimit.ts da API pública
│   │   ├── surveys/                  types.ts, templates.ts, builder.ts (blocos e aparência),
│   │   │                             schedule.ts (vigência), scoring.ts (NPS/CSAT/CES),
│   │   │                             sentiment.ts, moods.ts, school-years.ts, device.ts,
│   │   │                             wordcloud.ts
│   │   ├── tours/                    tipos, normalização, posição, alvo, condições,
│   │   │                             frequência, render do card, token, sdk-version.ts (gerado)
│   │   ├── heatmaps/                 core.ts (limites, compactação), draw.ts (render)
│   │   ├── analytics/                core, derive (métricas), selectors, identity-filter,
│   │   │                             svg-avatar, export
│   │   ├── insights/                 análise de temas, perguntas (regra + IA), contexto da IA
│   │   ├── product-report/           acesso, coleta, indicadores, modelo, render HTML/PDF/e-mail
│   │   ├── search/                   busca global
│   │   ├── help/                     artigos da central de ajuda
│   │   ├── billing/                  plans.ts: catálogo de planos, preços e limites
│   │   ├── platform/                 hosts.ts (normalização), selected.ts (plataforma do header)
│   │   ├── email/                    send.ts (Resend), report-template.ts
│   │   ├── export/                   csv.ts, xlsx.ts, pdf.ts
│   │   ├── ai/                       llm.ts: cliente de LLM compatível com OpenAI
│   │   ├── config/                   env.ts (URL pública), locked-routes.ts (rotas bloqueadas)
│   │   ├── utils/                    index.ts (cn, formatação), period.ts, sort.ts
│   │   └── mock/                     dados fictícios: telas bloqueadas e seed
│   │
│   ├── sdk/                          SDK que roda no site do cliente (compilado para public/)
│   │   ├── luumu.ts                  core: pesquisas, eventos, identify; carregado em toda página
│   │   ├── tours/runtime.ts          runtime dos tours (sob demanda)
│   │   ├── builder/                  overlay de seleção de elementos + discovery (sob demanda)
│   │   ├── heatmaps/recorder.ts      gravador de heatmaps (sob demanda)
│   │   ├── analytics/                coletor de analytics e identidade (sob demanda)
│   │   └── shared/                   dom.ts, memory.ts (localStorage)
│   │
│   ├── types/                        declarações de tipos de terceiros
│   └── proxy.ts                      exige sessão e bloqueia rotas antes do render
│
├── drizzle/                          migrações SQL (histórico) + meta/ do drizzle-kit
├── scripts/
│   ├── build-sdk.mjs                 compila src/sdk → public/sdk*.js (roda no prebuild)
│   ├── seed.ts                       popula um workspace demo
│   ├── prune-events.ts               remove duplicatas do catálogo de eventos (ids em URL)
│   ├── test-report-email.ts          envia um e-mail de relatório de teste
│   ├── tsconfig.scripts.json         tsconfig de scripts e testes (alias @/, stub server-only)
│   └── support/                      stub de server-only
├── tests/                            um diretório por módulo: analytics, billing, export,
│                                     heatmaps, help, insights, platform, product-report,
│                                     sdk, search, surveys, tours, ui
├── docs/
│   ├── ARQUITETURA.md                camadas, onde colocar cada coisa, convenções
│   ├── tours/                        arquitetura e integração dos product tours
│   ├── product-report/               Report Quinzenal
│   ├── infra/                        custos do Neon
│   └── design/                       protótipos HTML e arte-fonte
├── public/
│   ├── mascot/ · mascot-anim/        mascote, logos e emojis de sentimento
│   ├── login-panel.png
│   └── sdk*.js                       bundles do SDK (gerados, não editar)
│
├── .env.example                      variáveis de ambiente
├── next.config.ts                    headers de cache e imagens remotas
├── drizzle.config.ts                 schema e pasta de migrações
├── vercel.json                       região e cron
└── AGENTS.md / CLAUDE.md             instruções para agentes de IA
```

Camadas, a tabela "onde colocar cada coisa" e as convenções estão em
**[docs/ARQUITETURA.md](docs/ARQUITETURA.md)**.

## Documentação

- [Arquitetura e convenções](docs/ARQUITETURA.md)
- Product Tours: [arquitetura](docs/tours/ARQUITETURA.md) · [integração no produto](docs/tours/INTEGRACAO.md)
- [Report Quinzenal](docs/product-report/README.md)
- [Custos do Neon](docs/infra/neon-custos.md)

## Design System

Tokens e componentes vêm do brand book da Luumu. Cores núcleo: Roxo Luumu `#6B2BD9` e Verde Luumu
`#7ED957`. Fontes: Plus Jakarta Sans (títulos) e Inter (corpo). Os temas claro e escuro usam
`data-theme`. O mascote oficial (`public/mascot`) aparece no onboarding, nos estados vazios e nas
celebrações.
