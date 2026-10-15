import {
  LayoutDashboard,
  ClipboardList,
  MessageSquare,
  Flame,
  PlayCircle,
  BarChart3,
  Sparkles,
  FileText,
  Settings,
  Route,
  Crown,
  CircleHelp,
  CalendarRange,
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

/**
 * Report Quinzenal de Produto: fora do NAV porque só a conta autorizada o vê. A sidebar o
 * acrescenta ao grupo "Inteligência" quando o layout confirma o acesso no servidor; esconder o
 * item é só UI, a proteção real é o guard em lib/product-report/access.ts.
 */
export const PRODUCT_REPORT_NAV_ITEM: NavItem = {
  href: "/product-report",
  label: "Report Quinzenal",
  icon: CalendarRange,
};

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
      { href: "/analytics", label: "Analytics", icon: BarChart3, badge: "Novo" },
      { href: "/insights", label: "Insights IA", icon: Sparkles, locked: locked("/insights") },
      { href: "/reports", label: "Relatórios", icon: FileText },
    ],
  },
  {
    title: "Configuração",
    items: [
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
