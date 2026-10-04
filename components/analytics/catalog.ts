import {
  Activity,
  AppWindow,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Compass,
  Filter,
  Globe,
  Grid3x3,
  Heart,
  Layers,
  LineChart,
  LogIn,
  LogOut,
  Megaphone,
  MonitorSmartphone,
  MousePointerClick,
  PieChart,
  Repeat,
  Ruler,
  Smartphone,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { WIDGETS, type WidgetId } from "@/lib/analytics/core";

/** Categorias do painel "Adicionar bloco", na ordem em que aparecem. */
export const CATEGORIES = [
  { id: "metrics", label: "Métricas", icon: BarChart3 },
  { id: "charts", label: "Gráficos", icon: LineChart },
  { id: "users", label: "Usuários", icon: Users },
  { id: "engagement", label: "Engajamento", icon: Activity },
  { id: "retention", label: "Retenção", icon: Repeat },
  { id: "acquisition", label: "Aquisição", icon: Megaphone },
  { id: "pages", label: "Páginas", icon: AppWindow },
  { id: "devices", label: "Dispositivos", icon: MonitorSmartphone },
  { id: "events", label: "Eventos", icon: MousePointerClick },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATALOG: Record<WidgetId, { category: CategoryId; description: string; icon: LucideIcon }> = {
  kpi_dau: { category: "metrics", description: "Usuários únicos por dia, em média.", icon: Activity },
  kpi_mau: { category: "metrics", description: "Usuários únicos nos últimos 30 dias.", icon: Users },
  kpi_task_success: { category: "metrics", description: "Taxa de conclusão da tarefa principal.", icon: CheckCircle2 },
  kpi_north_star: { category: "metrics", description: "Principal indicador de valor do produto.", icon: Target },
  kpi_pages_per_session: { category: "metrics", description: "Telas vistas por sessão, em média.", icon: Layers },
  kpi_sessions_per_user: { category: "metrics", description: "Quantas vezes cada usuário volta no período.", icon: Repeat },

  users_trend: { category: "charts", description: "DAU e MAU ao longo do tempo.", icon: LineChart },
  engagement_trend: { category: "charts", description: "Ativos, tempo de uso e sessões no tempo.", icon: TrendingUp },
  engagement_funnel: { category: "charts", description: "Jornada completa até voltar ao produto.", icon: Filter },
  hours: { category: "charts", description: "Mapa de calor por dia da semana e hora.", icon: Grid3x3 },
  channels_trend: { category: "charts", description: "Novos usuários por canal, no tempo.", icon: TrendingUp },
  channels_donut: { category: "charts", description: "Fatia de cada canal nos novos usuários.", icon: PieChart },

  kpi_new_users: { category: "users", description: "Vistos pela primeira vez no período.", icon: UserPlus },
  kpi_recurrent: { category: "users", description: "Ativos que usaram o produto em 2+ dias.", icon: CalendarCheck },
  frequency: { category: "users", description: "Diário, semanal, mensal ou esporádico.", icon: PieChart },
  acquisition_funnel: { category: "users", description: "Da visita à primeira resposta de pesquisa.", icon: Filter },

  kpi_session_time: { category: "engagement", description: "Tempo ativo médio por sessão.", icon: Clock },
  kpi_stickiness: { category: "engagement", description: "DAU ÷ MAU: quanto o público volta todo dia.", icon: Heart },
  session_time: { category: "engagement", description: "Tempo de sessão com a evolução diária.", icon: Timer },
  features: { category: "engagement", description: "Ações mais usadas pelo alcance entre ativos.", icon: Sparkles },

  retention: { category: "retention", description: "Cohorts semanais pela primeira visita.", icon: Grid3x3 },
  retention_curve: { category: "retention", description: "% que volta depois de N semanas.", icon: TrendingUp },
  kpi_d1: { category: "retention", description: "Voltaram depois do 1º dia.", icon: TrendingUp },
  kpi_d7: { category: "retention", description: "Voltaram depois de 7 dias.", icon: TrendingUp },
  kpi_d30: { category: "retention", description: "Voltaram depois de 30 dias.", icon: TrendingUp },

  kpi_activation: { category: "acquisition", description: "Novos que se ativaram em até 7 dias.", icon: Zap },
  kpi_survey_conversion: { category: "acquisition", description: "Novos que responderam uma pesquisa.", icon: Sparkles },
  channels_table: { category: "acquisition", description: "Canais com ativação e tempo de uso.", icon: Compass },
  campaigns: { category: "acquisition", description: "Campanhas com utm_campaign.", icon: Megaphone },

  top_pages: { category: "pages", description: "Ranking de telas por acessos.", icon: AppWindow },
  entry_pages: { category: "pages", description: "Onde as sessões começam.", icon: LogIn },
  exit_pages: { category: "pages", description: "A última tela vista na sessão.", icon: LogOut },

  devices: { category: "devices", description: "Desktop, celular e tablet.", icon: MonitorSmartphone },
  device_time: { category: "devices", description: "Tempo de sessão por aparelho.", icon: Smartphone },
  device_trend: { category: "devices", description: "Usuários por aparelho no tempo.", icon: TrendingUp },
  os: { category: "devices", description: "Windows, Android, iOS...", icon: MonitorSmartphone },
  browsers: { category: "devices", description: "Chrome, Safari, Edge...", icon: Globe },
  viewports: { category: "devices", description: "Largura da janela do navegador.", icon: Ruler },

  top_events: { category: "events", description: "Ações mais realizadas, com conversão.", icon: MousePointerClick },
  events_trend: { category: "events", description: "Os principais eventos ao longo do tempo.", icon: TrendingUp },
};

export const widgetName = (id: WidgetId) => WIDGETS[id];
