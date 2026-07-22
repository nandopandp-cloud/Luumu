export interface Session {
  id: string;
  user: string;
  duration: string;
  device: string;
  browser: string;
  pages: number;
  events: number;
  errors: number;
  rage: number;
  when: string;
  country: string;
}

export const sessions: Session[] = [
  { id: "s-8f21", user: "Marina Souza", duration: "4m 12s", device: "Desktop", browser: "Chrome", pages: 7, events: 42, errors: 0, rage: 0, when: "há 8 min", country: "🇧🇷 BR" },
  { id: "s-3a90", user: "Anônimo", duration: "1m 03s", device: "Mobile", browser: "Safari", pages: 2, events: 11, errors: 2, rage: 3, when: "há 22 min", country: "🇧🇷 BR" },
  { id: "s-77c4", user: "Carlos Lima", duration: "8m 55s", device: "Desktop", browser: "Firefox", pages: 12, events: 88, errors: 1, rage: 0, when: "há 40 min", country: "🇵🇹 PT" },
  { id: "s-1b56", user: "Ana Beatriz", duration: "2m 30s", device: "Tablet", browser: "Chrome", pages: 4, events: 27, errors: 0, rage: 1, when: "há 1h", country: "🇧🇷 BR" },
  { id: "s-9de2", user: "Anônimo", duration: "0m 45s", device: "Mobile", browser: "Chrome", pages: 1, events: 6, errors: 4, rage: 5, when: "há 2h", country: "🇦🇷 AR" },
  { id: "s-4c08", user: "Pedro Alves", duration: "6m 18s", device: "Desktop", browser: "Edge", pages: 9, events: 63, errors: 0, rage: 0, when: "há 3h", country: "🇧🇷 BR" },
];

export const replayEvents = [
  { t: "0:00", type: "pageview", label: "Entrou em /dashboard", tone: "info" },
  { t: "0:14", type: "click", label: "Clicou em 'Nova pesquisa'", tone: "neutral" },
  { t: "0:32", type: "navigation", label: "Navegou para /surveys/new", tone: "info" },
  { t: "1:05", type: "rage", label: "Rage click no botão 'Publicar'", tone: "error" },
  { t: "1:12", type: "error", label: "TypeError: cannot read 'id'", tone: "error" },
  { t: "2:40", type: "form", label: "Enviou formulário de pesquisa", tone: "success" },
  { t: "3:20", type: "conversion", label: "Pesquisa publicada 🎉", tone: "success" },
] as const;
