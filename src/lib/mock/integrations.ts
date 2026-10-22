export interface Integration {
  name: string;
  category: string;
  desc: string;
  connected: boolean;
  color: string;
  initials: string;
}

export const integrations: Integration[] = [
  { name: "Slack", category: "Comunicação", desc: "Alertas de respostas e insights no seu canal.", connected: true, color: "#4A154B", initials: "Sl" },
  { name: "Microsoft Teams", category: "Comunicação", desc: "Notificações no Teams.", connected: false, color: "#5059C9", initials: "Te" },
  { name: "Discord", category: "Comunicação", desc: "Webhooks para servidores Discord.", connected: false, color: "#5865F2", initials: "Dc" },
  { name: "Zapier", category: "Automação", desc: "Conecte a 6.000+ apps.", connected: true, color: "#FF4A00", initials: "Zp" },
  { name: "Make", category: "Automação", desc: "Automações visuais sem código.", connected: false, color: "#6D00CC", initials: "Mk" },
  { name: "Webhook", category: "Automação", desc: "Envie eventos para qualquer endpoint.", connected: true, color: "#374151", initials: "Wh" },
  { name: "HubSpot", category: "CRM", desc: "Sincronize feedback com contatos.", connected: false, color: "#FF7A59", initials: "Hs" },
  { name: "Salesforce", category: "CRM", desc: "Enriqueça leads com CSAT/NPS.", connected: false, color: "#00A1E0", initials: "Sf" },
  { name: "Intercom", category: "Suporte", desc: "Dispare pesquisas em conversas.", connected: true, color: "#1F8DED", initials: "Ic" },
  { name: "Zendesk", category: "Suporte", desc: "Tickets a partir de feedback negativo.", connected: false, color: "#03363D", initials: "Zd" },
  { name: "Jira", category: "Produto", desc: "Crie issues a partir de insights.", connected: false, color: "#0052CC", initials: "Ji" },
  { name: "ClickUp", category: "Produto", desc: "Tarefas a partir de recomendações.", connected: false, color: "#7B68EE", initials: "Cu" },
  { name: "Notion", category: "Produto", desc: "Exporte relatórios para páginas.", connected: false, color: "#0D0F1A", initials: "No" },
  { name: "Google Analytics", category: "Analytics", desc: "Correlacione eventos e conversões.", connected: true, color: "#E8710A", initials: "GA" },
  { name: "PostHog", category: "Analytics", desc: "Unifique product analytics.", connected: false, color: "#F54E00", initials: "Ph" },
  { name: "Amplitude", category: "Analytics", desc: "Envie eventos de comportamento.", connected: false, color: "#1E61F0", initials: "Am" },
  { name: "Mixpanel", category: "Analytics", desc: "Funis e retenção combinados.", connected: false, color: "#7856FF", initials: "Mp" },
];
