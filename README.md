# Luumu

**Ouça. Entenda. Melhore.**

Plataforma SaaS de Voice of Customer que une **Feedback**, **Analytics** e **Behavior** em uma
única solução. Pesquisas (CSAT, NPS, CES, PMF…), heatmaps, session replay, analytics e insights de IA.

> Protótipo navegável (Fase 1) — todas as telas com dados mockados. Sem backend ainda.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** com o Design System da Luumu (tokens do brand book)
- **Recharts** (gráficos), **@dnd-kit** (builder drag-and-drop), **lucide-react** (ícones)
- Deploy: **Vercel**

## Rodar localmente

```bash
pnpm install
pnpm dev       # http://localhost:3000
pnpm build     # build de produção
```

Entre por `/login` (qualquer credencial entra) → `/dashboard`.

## Estrutura

```
app/
  (auth)/login · signup
  (app)/                         # AppShell (sidebar + topbar)
    dashboard · surveys · responses
    surveys/new · surveys/[id]/builder|responses|settings
    heatmaps · replay · replay/[id]
    analytics · insights · reports
    integrations · sdk · settings/(members|billing)
components/
  ui/        # Design System (Button, Card, Badge, MetricCard, Mascot…)
  shell/     # AppShell, Sidebar, Topbar, ThemeToggle
  survey-builder/ · replay/ · charts/ · responses/ · settings/
lib/mock/    # dados mockados tipados
public/mascot(-anim)/  # logo + mascote oficiais (SVG/WEBM)
```

## Design System

Tokens e componentes portados de `luumus_ds.html` (repositório de marca). Cores núcleo: Roxo Luumu
`#6B2BD9`, Verde Luumu `#7ED957`. Fontes: Plus Jakarta Sans (títulos) + Inter (corpo). Tema claro e
escuro via `data-theme`. Mascote oficial presente em onboarding, estados vazios e celebrações.
