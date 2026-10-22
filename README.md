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

```
src/
  app/            rotas (App Router): painel, login, páginas públicas e API
  components/     componentes React: ui/ (design system), shell/ e uma pasta por módulo
  lib/            regras de negócio, acesso a dados (lib/db) e utilitários, por domínio
  sdk/            código do SDK que roda no site do cliente
  proxy.ts        autenticação e bloqueio de rotas antes do render
drizzle/          histórico de migrações SQL
scripts/          build do SDK, seed e jobs avulsos
tests/            testes automatizados, espelhando os módulos
docs/             arquitetura e documentação por módulo
public/           assets estáticos e bundles gerados do SDK
```

Os detalhes (camadas, onde colocar cada coisa e convenções) estão em
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
