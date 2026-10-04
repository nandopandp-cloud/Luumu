import {
  LayoutDashboard,
  ClipboardList,
  MessageSquare,
  Flame,
  PlayCircle,
  BarChart3,
  Sparkles,
  FileText,
  Plug,
  Settings,
  Route,
  Crown,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";
import { LOCKED_ROUTES } from "@/lib/locked-routes";

const locked = (href: string) => (LOCKED_ROUTES as readonly string[]).includes(href);

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Área ainda sem fonte de dados real, item desabilitado na sidebar e rota bloqueada. */
  locked?: boolean;
  /** Selo curto ao lado do rótulo (ex.: "Novo"). */
  badge?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    title: "Produto",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/surveys", label: "Pesquisas", icon: ClipboardList },
      { href: "/responses", label: "Respostas", icon: MessageSquare },
      { href: "/tours", label: "Tours", icon: Route, badge: "Novo" },
    ],
  },
  {
    title: "Behavior",
    items: [
      { href: "/heatmaps", label: "Heatmaps", icon: Flame, badge: "Novo" },
      { href: "/replay", label: "Session Replay", icon: PlayCircle, locked: locked("/replay") },
    ],
  },
  {
    title: "Inteligência",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3, locked: locked("/analytics") },
      { href: "/insights", label: "Insights IA", icon: Sparkles, locked: locked("/insights") },
      { href: "/reports", label: "Relatórios", icon: FileText },
    ],
  },
  {
    title: "Configuração",
    items: [
      { href: "/integrations", label: "Integrações", icon: Plug, locked: locked("/integrations") },
      { href: "/settings", label: "Configurações", icon: Settings },
      { href: "/billing", label: "Plano & Cobrança", icon: Crown },
    ],
  },
  {
    // grupo sem título: a Ajuda fica separada do resto
    title: "",
    items: [{ href: "/help", label: "Ajuda", icon: CircleHelp }],
  },
];
