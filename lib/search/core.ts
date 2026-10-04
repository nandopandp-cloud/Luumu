/*
  Núcleo da busca da Luumu (⌘K). PURO e testado: normalização sem acento, trechos para
  destacar o que casou, recorte de comentário em volta do termo e o catálogo de páginas e
  ações (filtrado no cliente, sem ir ao servidor).
*/

/** minúsculas e sem acento: "Satisfação" e "satisfacao" casam */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Mesma normalização no Postgres (sem depender da extensão unaccent). */
export const SQL_ACCENTS_FROM = "áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ";
export const SQL_ACCENTS_TO = "aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn";

/** Padrão LIKE seguro: o termo do usuário nunca vira curinga. */
export function likePattern(q: string): string {
  return `%${fold(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export const MIN_QUERY = 2;
export const MAX_QUERY = 80;

export function cleanQuery(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
}

export interface Segment {
  text: string;
  match: boolean;
}

/** Divide `text` em trechos marcando as ocorrências de `q` (sem acento, sem caixa). */
export function highlight(text: string, q: string): Segment[] {
  const needle = fold(q.trim());
  if (!needle) return [{ text, match: false }];
  const hay = fold(text);
  // fold preserva o tamanho em texto NFC comum; se não preservar, não arrisca destacar errado
  if (hay.length !== text.length) return [{ text, match: false }];
  const out: Segment[] = [];
  let i = 0;
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, i)) {
    if (at > i) out.push({ text: text.slice(i, at), match: false });
    out.push({ text: text.slice(at, at + needle.length), match: true });
    i = at + needle.length;
  }
  if (i < text.length) out.push({ text: text.slice(i), match: false });
  return out.length ? out : [{ text, match: false }];
}

/** Recorte do comentário em volta da primeira ocorrência, com reticências. */
export function snippet(text: string, q: string, radius = 70): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const at = fold(flat).indexOf(fold(q.trim()));
  if (at < 0 || flat.length <= radius * 2) return flat.length > radius * 2 ? `${flat.slice(0, radius * 2).trimEnd()}…` : flat;
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + q.length + radius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}

/** Pontuação de um texto para a consulta: começo da palavra vale mais que meio. */
export function score(q: string, ...fields: string[]): number {
  const needle = fold(q.trim());
  if (!needle) return 1;
  let best = 0;
  for (const [i, f] of fields.entries()) {
    const hay = fold(f);
    const at = hay.indexOf(needle);
    if (at === -1) continue;
    const s = (at === 0 ? 100 : /\s|[-/(]/.test(hay[at - 1]) ? 70 : 40) - i * 15;
    best = Math.max(best, s);
  }
  return best;
}

/* ---------- páginas e ações ---------- */

export type CommandKind = "page" | "action";

export interface CommandItem {
  id: string;
  kind: CommandKind;
  title: string;
  subtitle: string;
  href?: string;
  /** ação executada no cliente (ex.: alternar tema) */
  run?: "toggle-theme";
  keywords: string[];
  icon: string;
}

export const COMMANDS: CommandItem[] = [
  { id: "a-new-survey", kind: "action", title: "Nova pesquisa", subtitle: "Criar a partir de um modelo de CSAT, NPS, CES…", href: "/surveys/new", keywords: ["criar", "csat", "nps", "ces", "pesquisa"], icon: "plus" },
  { id: "a-new-tour", kind: "action", title: "Novo tour guiado", subtitle: "Abrir Tours para criar um passo a passo", href: "/tours", keywords: ["criar", "tour", "onboarding", "guia"], icon: "route" },
  { id: "a-invite", kind: "action", title: "Convidar membro", subtitle: "Adicionar pessoas ao workspace", href: "/settings/members", keywords: ["convite", "equipe", "time", "usuario", "membro"], icon: "user-plus" },
  { id: "a-theme", kind: "action", title: "Alternar tema claro/escuro", subtitle: "Muda a aparência da plataforma", run: "toggle-theme", keywords: ["tema", "escuro", "claro", "dark", "light"], icon: "moon" },
  { id: "p-dashboard", kind: "page", title: "Dashboard", subtitle: "Visão geral de notas e respostas", href: "/dashboard", keywords: ["inicio", "home", "visao geral"], icon: "dashboard" },
  { id: "p-surveys", kind: "page", title: "Pesquisas", subtitle: "Todas as pesquisas do projeto", href: "/surveys", keywords: ["survey", "formulario"], icon: "surveys" },
  { id: "p-responses", kind: "page", title: "Respostas", subtitle: "Feed de respostas e comentários", href: "/responses", keywords: ["feedback", "comentarios"], icon: "responses" },
  { id: "p-heatmaps", kind: "page", title: "Heatmaps", subtitle: "Cliques, movimento e rolagem das suas páginas", href: "/heatmaps", keywords: ["mapa de calor", "cliques", "scroll", "rolagem", "comportamento"], icon: "flame" },
  { id: "p-tours", kind: "page", title: "Tours", subtitle: "Product tours e onboarding", href: "/tours", keywords: ["onboarding", "guia"], icon: "route" },
  { id: "p-analytics", kind: "page", title: "Analytics", subtitle: "Aquisição, engajamento, retenção, páginas e eventos", href: "/analytics", keywords: ["dau", "mau", "retencao", "aquisicao", "engajamento", "funil", "cohort"], icon: "chart" },
  { id: "p-insights", kind: "page", title: "Insights IA", subtitle: "Temas, sentimento e conversa com a Luumu", href: "/insights", keywords: ["ia", "inteligencia", "temas", "sentimento"], icon: "sparkles" },
  { id: "p-reports", kind: "page", title: "Relatórios", subtitle: "Relatórios e envios por e-mail", href: "/reports", keywords: ["exportar", "pdf", "email"], icon: "reports" },
  { id: "p-sdk", kind: "page", title: "SDK & Eventos", subtitle: "Configurações: instalação, chave e eventos rastreados", href: "/settings/sdk", keywords: ["instalar", "script", "api", "eventos", "chave"], icon: "code" },
  { id: "p-settings", kind: "page", title: "Configurações", subtitle: "Workspace, projetos e plataformas", href: "/settings", keywords: ["ajustes", "workspace", "projeto", "logo"], icon: "settings" },
  { id: "p-profile", kind: "page", title: "Meu perfil", subtitle: "Nome, foto e senha", href: "/settings/profile", keywords: ["conta", "senha", "foto", "avatar"], icon: "user" },
  { id: "p-members", kind: "page", title: "Membros", subtitle: "Pessoas e permissões do workspace", href: "/settings/members", keywords: ["equipe", "permissoes", "time"], icon: "users" },
  { id: "p-help", kind: "page", title: "Ajuda", subtitle: "Perguntas frequentes e tutoriais", href: "/help", keywords: ["faq", "duvida", "suporte", "tutorial", "como"], icon: "help" },
  { id: "p-billing", kind: "page", title: "Plano & Cobrança", subtitle: "Plano atual, uso e upgrade", href: "/billing", keywords: ["plano", "preco", "assinatura", "upgrade", "limite", "cobranca"], icon: "crown" },
];

/**
 * Páginas e ações que casam com a consulta, das mais relevantes às menos. Cada palavra da
 * consulta precisa casar com o título, a descrição ou uma palavra-chave ("tema escuro").
 */
export function matchCommands(q: string, items: CommandItem[] = COMMANDS): CommandItem[] {
  const words = fold(q).split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items
    .map((c) => {
      let total = 0;
      for (const w of words) {
        const s = Math.max(score(w, c.title, c.subtitle), score(w, ...c.keywords) - 20);
        if (s <= 0) return { c, s: 0 };
        total += s;
      }
      // a frase inteira no título vale um bônus
      return { c, s: total + (fold(c.title).includes(words.join(" ")) ? 50 : 0) };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
}

/* ---------- resultados do servidor ---------- */

export interface SurveyHit {
  id: string;
  name: string;
  type: string;
  status: string;
  responses: number;
  updatedAt: string;
}

export interface TourHit {
  id: string;
  name: string;
  description: string;
  status: string;
  updatedAt: string;
}

export interface ResponseHit {
  id: string;
  surveyId: string;
  surveyName: string;
  comment: string | null;
  respondent: string | null;
  score: number | null;
  sentiment: "positivo" | "neutro" | "negativo" | null;
  createdAt: string;
}

export interface SearchResults {
  query: string;
  project: { id: string; name: string } | null;
  surveys: SurveyHit[];
  tours: TourHit[];
  responses: ResponseHit[];
}

/** "há 5 min", "ontem", "há 3 meses" */
export function relativeTime(iso: string, now = Date.now()): string {
  const sec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return "agora";
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(sec / 3600), "hour");
  if (abs < 86_400 * 30) return rtf.format(Math.round(sec / 86_400), "day");
  if (abs < 86_400 * 365) return rtf.format(Math.round(sec / (86_400 * 30)), "month");
  return rtf.format(Math.round(sec / (86_400 * 365)), "year");
}
