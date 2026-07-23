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
  Code2,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { LOCKED_ROUTES } from "@/lib/locked-routes";

const locked = (href: string) => (LOCKED_ROUTES as readonly string[]).includes(href);

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Área ainda sem fonte de dados real — item desabilitado na sidebar e rota bloqueada. */
  locked?: boolean;
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
    ],
  },
  {
    title: "Behavior",
    items: [
      { href: "/heatmaps", label: "Heatmaps", icon: Flame, locked: locked("/heatmaps") },
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
      { href: "/integrations", label: "Integrações", icon: Plug },
      { href: "/sdk", label: "SDK & Eventos", icon: Code2 },
      { href: "/settings", label: "Configurações", icon: Settings },
    ],
  },
];
