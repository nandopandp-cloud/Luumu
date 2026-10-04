/*
  Central de Ajuda (FAQ) da Luumu. PURO: conteúdo + busca, testado.

  Regra do conteúdo: descrever a plataforma COMO ELA É. Recurso que ainda não existe
  (Session Replay, Analytics, Integrações, API e Webhooks) é dito como "em breve", nunca
  explicado como se funcionasse. Ao mudar um recurso, atualize o artigo correspondente.
*/
import { fold } from "@/lib/search/core";

export interface HelpArticle {
  id: string;
  q: string;
  /** parágrafos separados por linha em branco; "- " no início vira item de lista */
  a: string;
  link?: { label: string; href: string };
  keywords?: string[];
}

export interface HelpCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  articles: HelpArticle[];
}

export const HELP: HelpCategory[] = [
  {
    id: "comecando",
    title: "Começando agora",
    subtitle: "Aprenda o básico para começar a usar a Luumu rapidamente.",
    icon: "rocket",
    articles: [
      {
        id: "o-que-e",
        q: "O que é a Luumu?",
        a: "A Luumu é uma plataforma de Voice of Customer: você cria pesquisas (CSAT, NPS, CES e outras), coleta respostas dentro do seu produto ou por link e analisa tudo em um só lugar, com dashboards, sentimento, temas e uma IA que conversa sobre os seus dados.\n\nAlém das pesquisas, a Luumu tem Product Tours para guiar usuários e Heatmaps para ver onde clicam e até onde rolam a página.",
        link: { label: "Ver o Dashboard", href: "/dashboard" },
      },
      {
        id: "primeira-pesquisa",
        q: "Como criar minha primeira pesquisa?",
        a: "Vá em Pesquisas → Nova pesquisa e escolha um modelo (CSAT, NPS, CES…). No editor você ajusta as perguntas, a aparência e, em Configurações, quem recebe, quando aparece e com que frequência.\n\nQuando estiver pronta, publique: o status passa para Ativa e ela começa a aparecer onde o SDK estiver instalado (ou pelo link público).",
        link: { label: "Criar uma pesquisa", href: "/surveys/new" },
        keywords: ["nova", "criar", "começar"],
      },
      {
        id: "instalar",
        q: "Preciso instalar algo no meu produto?",
        a: "Para pesquisas dentro do produto, tours e heatmaps, sim: um script (o SDK) com a chave pública do projeto. É uma linha de código, e a aba Configurações → SDK & Eventos mostra o trecho pronto para copiar.\n\nSe quiser só coletar por link, não precisa instalar nada: cada pesquisa tem um link público.",
        link: { label: "Ver a instalação do SDK", href: "/settings/sdk" },
        keywords: ["script", "código", "sdk"],
      },
      {
        id: "projetos",
        q: "O que são workspace e projetos?",
        a: "O workspace é a sua conta (o time e o plano). Dentro dele você organiza projetos, normalmente um por produto. Cada projeto tem suas próprias pesquisas, respostas, tours, heatmaps e chave do SDK.\n\nVocê troca de projeto pelo seletor no topo da barra lateral.",
      },
      {
        id: "plataformas",
        q: "O que são plataformas?",
        a: "Um mesmo projeto pode rodar em mais de um endereço (por exemplo, app.seuproduto.com e aluno.seuproduto.com). Cada endereço em que o SDK roda vira uma plataforma, detectada automaticamente.\n\nVocê pode direcionar pesquisas e tours para plataformas específicas e filtrar respostas e dashboards por plataforma.",
        keywords: ["host", "domínio", "hostname"],
      },
      {
        id: "plano-gratuito",
        q: "Existe um plano gratuito?",
        a: "Sim. O plano Free permite experimentar a Luumu com 100 respostas por mês e 1 pesquisa ativa. Recursos como Insights IA, Product Tours e Heatmaps estão nos planos pagos.",
        link: { label: "Comparar os planos", href: "/billing" },
        keywords: ["grátis", "free", "preço"],
      },
    ],
  },
  {
    id: "pesquisas",
    title: "Pesquisas",
    subtitle: "Crie, publique e configure suas pesquisas.",
    icon: "surveys",
    articles: [
      {
        id: "tipos",
        q: "Quais tipos de pesquisa posso criar?",
        a: "Há modelos prontos de CSAT, NPS, CES, SUS, PMF, Onboarding, Saída (exit), Churn, Feature, Beta e um modelo em branco (Personalizada). Todos podem ser editados: você adiciona, remove e reordena perguntas.",
        keywords: ["csat", "nps", "ces", "modelos", "templates"],
      },
      {
        id: "perguntas",
        q: "Que tipos de pergunta existem?",
        a: "Notas (escala, estrelas, NPS 0–10, CSAT, CES), múltipla escolha, texto curto e texto longo, entre outros blocos do editor. A primeira pergunta de nota da pesquisa é a usada para calcular o score e o sentimento.",
      },
      {
        id: "logica",
        q: "Posso mostrar uma pergunta só para quem deu nota baixa?",
        a: "Sim. No editor, cada pergunta pode ter uma condição de exibição: aparecer apenas quando a resposta de uma pergunta anterior for menor, maior ou igual a um valor. É o jeito de perguntar \"o que podemos melhorar?\" só para quem avaliou mal.",
        keywords: ["condição", "lógica", "pular"],
      },
      {
        id: "aparencia",
        q: "Como personalizo a aparência?",
        a: "Na aba Aparência você escolhe o formato (pop-up, slider, modal ou barra), a posição na tela, o tema (claro, escuro ou automático) e a cor principal. A prévia mostra o resultado na hora.",
        keywords: ["cor", "tema", "formato", "posição"],
      },
      {
        id: "canais",
        q: "Por quais canais posso enviar a pesquisa?",
        a: "Dentro do produto (in-app, pelo SDK) ou por link público, que você pode compartilhar onde quiser: e-mail, WhatsApp, redes sociais.",
        link: { label: "Ver minhas pesquisas", href: "/surveys" },
        keywords: ["link", "compartilhar", "whatsapp", "email"],
      },
      {
        id: "quem-recebe",
        q: "Como escolher quem recebe a pesquisa?",
        a: "Em Configurações → Público: \"Todos os usuários\" ou \"Usuários específicos\", informando uma lista de e-mails ou IDs. Para isso funcionar, seu produto precisa informar quem é o usuário com Luumu.identify({ id, email }).",
        keywords: ["público", "segmento", "identify", "audiência"],
      },
      {
        id: "gatilho",
        q: "Como definir quando a pesquisa aparece?",
        a: "Sem gatilho, ela aparece no carregamento da página (depois do atraso configurado). Com gatilhos por evento, ela aparece quando um evento acontece no seu produto, por exemplo depois de concluir uma aula. Os eventos são capturados automaticamente pelo SDK ou enviados com Luumu.track(\"nome\").",
        keywords: ["evento", "trigger", "quando"],
      },
      {
        id: "frequencia",
        q: "Com que frequência a mesma pessoa vê a pesquisa?",
        a: "Você escolhe em Configurações → Frequência:\n\n- Uma vez por usuário\n- Uma vez por sessão\n- Recorrente (a cada 30 dias)\n- Sempre",
        keywords: ["repetir", "vezes"],
      },
      {
        id: "plataforma",
        q: "Posso mostrar a pesquisa só em uma plataforma?",
        a: "Sim. Em Configurações → Plataforma, marque os endereços em que ela pode aparecer. Sem nenhum marcado, vale para todas as plataformas do projeto.",
      },
      {
        id: "vigencia",
        q: "Posso agendar início e fim da pesquisa?",
        a: "Sim. Defina o início e o fim da vigência nas configurações. Fora desse período a pesquisa não aparece, mesmo estando ativa. Você também pode limitar o número de respostas: ao atingir o limite, ela é encerrada automaticamente.",
        keywords: ["agendar", "data", "limite", "encerrar"],
      },
      {
        id: "status",
        q: "O que significa cada status?",
        a: "- Rascunho: em edição, não aparece para ninguém.\n- Ativa: publicada e aparecendo.\n- Pausada: fica fora do ar, mas pode ser retomada.\n- Encerrada: terminou e não recebe mais respostas.",
      },
      {
        id: "idioma",
        q: "Em quais idiomas a pesquisa pode ser exibida?",
        a: "Português (BR), inglês e espanhol: os botões e textos do próprio widget seguem o idioma escolhido. O texto das perguntas é o que você escrever.",
      },
    ],
  },
  {
    id: "respostas",
    title: "Respostas",
    subtitle: "Acompanhe e organize o que os clientes estão dizendo.",
    icon: "responses",
    articles: [
      {
        id: "onde-ver",
        q: "Onde vejo as respostas?",
        a: "Na página Respostas, em um feed com nota, sentimento, comentário, plataforma e dispositivo de cada resposta. Clique em \"Ver detalhes\" para abrir a resposta completa.",
        link: { label: "Abrir Respostas", href: "/responses" },
        keywords: ["analisar", "análise", "ver", "feed", "visualizar"],
      },
      {
        id: "filtros",
        q: "Como filtro as respostas?",
        a: "Pela pesquisa, pelo período e pela plataforma. As abas separam todas, só com comentário, positivas, neutras e negativas, e a ordenação mostra mais recentes, melhores ou piores notas, comentários mais longos e mais.",
        keywords: ["filtrar", "período", "ordenar"],
      },
      {
        id: "sentimento",
        q: "Como o sentimento é calculado?",
        a: "Pela nota da pergunta principal, na escala dela: notas altas são positivas, intermediárias neutras e baixas negativas. No Dashboard e em Insights, a régua vai de Muito negativo (0–29%) a Muito positivo (90–100%).",
      },
      {
        id: "exportar",
        q: "Posso exportar as respostas?",
        a: "Sim. Na página Respostas use Exportar: PDF (relatório visual), Excel (.xlsx) ou CSV, respeitando a pesquisa e a plataforma escolhidas.",
        keywords: ["csv", "excel", "planilha", "baixar"],
      },
      {
        id: "dispositivo",
        q: "Consigo saber de qual dispositivo veio a resposta?",
        a: "Sim. Cada resposta mostra se veio de celular, tablet ou desktop (respostas antigas, anteriores a esse registro, aparecem sem essa informação).",
      },
      {
        id: "quem-respondeu",
        q: "Consigo saber quem respondeu?",
        a: "Se o seu produto informa o usuário com Luumu.identify, a resposta mostra o ID e o e-mail dele. Sem isso, a resposta é anônima.",
        keywords: ["identify", "anônimo", "usuário"],
      },
      {
        id: "relatorios",
        q: "Posso receber um relatório por e-mail?",
        a: "Sim. Em Relatórios você agenda o envio periódico por e-mail, exporta em PDF ou Excel e cria links públicos de um relatório para compartilhar com quem não tem acesso à Luumu.",
        link: { label: "Abrir Relatórios", href: "/reports" },
        keywords: ["pdf", "agendar", "compartilhar"],
      },
      {
        id: "excluir",
        q: "Excluir uma pesquisa apaga as respostas?",
        a: "Sim: ao excluir uma pesquisa, as respostas dela são apagadas junto. Se quiser apenas parar de coletar, prefira pausar ou encerrar.",
      },
    ],
  },
  {
    id: "tours",
    title: "Product Tours",
    subtitle: "Guie seus usuários pelo produto, passo a passo.",
    icon: "route",
    articles: [
      {
        id: "o-que-e-tour",
        q: "O que é um Product Tour?",
        a: "Uma sequência de balões que apontam para elementos do seu produto, explicando onde clicar e o que cada parte faz. Serve para onboarding, novidades e funcionalidades pouco usadas.",
        link: { label: "Abrir Tours", href: "/tours" },
      },
      {
        id: "criar-tour",
        q: "Como crio um tour?",
        a: "Em Tours → Novo tour, informe a página inicial e abra o seu produto pelo builder: ele abre o site com uma barra da Luumu, e você clica nos elementos para criar cada passo, sem código.",
      },
      {
        id: "quando-tour",
        q: "Quando o tour aparece?",
        a: "Você escolhe: ao carregar a página, no primeiro acesso, depois de um evento ou de forma manual (pelo código). A frequência e as plataformas também são configuráveis.",
      },
      {
        id: "versoes",
        q: "O que acontece quando edito um tour publicado?",
        a: "As mudanças ficam em rascunho até você publicar de novo, então quem está usando não vê nada pela metade. O histórico guarda as versões e permite restaurar uma anterior.",
        keywords: ["publicar", "versão", "restaurar"],
      },
      {
        id: "analytics-tour",
        q: "Como sei se o tour funciona?",
        a: "Cada tour tem uma aba de analytics com quantas pessoas começaram, concluíram e em qual passo desistiram.",
      },
      {
        id: "aparencia-tour",
        q: "Posso personalizar o visual do tour?",
        a: "Sim: cores, imagens nos passos e até uma comemoração com confete ao final.",
      },
    ],
  },
  {
    id: "insights",
    title: "Analytics e Insights",
    subtitle: "Uso do produto, indicadores e conversa com seus dados.",
    icon: "sparkles",
    articles: [
      {
        id: "dashboard",
        q: "O que o Dashboard mostra?",
        a: "A nota principal (CSAT, NPS ou CES) e sua evolução, a distribuição de notas, o sentimento e as pesquisas recentes, com comparação com o período anterior e filtros de pesquisa, período e plataforma.",
        link: { label: "Abrir o Dashboard", href: "/dashboard" },
      },
      {
        id: "insights-ia",
        q: "O que é o Insights IA?",
        a: "Uma análise automática dos comentários: temas mais citados, o que mudou em relação ao período anterior, recomendações com os comentários que as sustentam e a evolução do sentimento.",
        link: { label: "Abrir Insights IA", href: "/insights" },
      },
      {
        id: "conversar",
        q: "Posso fazer perguntas para a IA?",
        a: "Sim. Em Insights IA você conversa com a Luumu sobre os dados do período, por exemplo \"por que o CSAT caiu?\" ou \"o que os clientes pedem?\". A resposta usa só os seus dados; quando a IA não está disponível, a Luumu responde com os números calculados, sem inventar.",
        keywords: ["chat", "perguntar", "ia"],
      },
      {
        id: "ia-privacidade",
        q: "A IA vê dados pessoais dos meus clientes?",
        a: "Não. Antes de qualquer envio, e-mails, telefones, CPFs, links e números longos são removidos dos comentários. O provedor de IA não usa esses dados para treinar modelos.",
      },
      {
        id: "temas",
        q: "Como os temas são identificados?",
        a: "Cada comentário é classificado por um dicionário de temas (atendimento, preço, usabilidade, desempenho…). Os temas mostram quantas menções tiveram e quantas foram positivas, neutras ou negativas.",
      },
      {
        id: "nps-calculo",
        q: "Como o NPS e o CSAT são calculados?",
        a: "- NPS: % de promotores (9–10) menos % de detratores (0–6).\n- CSAT: % de notas no topo da escala (numa escala de 1 a 5, as notas 4 e 5).\n- CES: média do esforço informado (quanto menor, melhor).",
        keywords: ["fórmula", "cálculo"],
      },
      {
        id: "comparacao",
        q: "Contra qual período a comparação é feita?",
        a: "Contra o período imediatamente anterior, com a mesma duração. Por exemplo: últimos 30 dias contra os 30 dias antes deles.",
      },
      {
        id: "analytics",
        q: "O que é a área Analytics?",
        a: "O analytics de produto da Luumu: aquisição (canais, campanhas, páginas de entrada), engajamento (DAU, MAU, tempo de uso, frequência, horários), retenção (cohorts e D1/D7/D30), páginas, dispositivos e eventos. Um dono ou administrador ativa a coleta na própria página; o SDK que já está instalado passa a medir, com um único envio por carregamento de página.",
        link: { label: "Abrir Analytics", href: "/analytics" },
      },
      {
        id: "visoes",
        q: "Posso salvar uma visão do Analytics?",
        a: "Sim. Monte a aba, o período, a plataforma, o dispositivo (e, na aba Personalizada, os blocos) e clique em Nova visão. Dê um nome e um objetivo e, se quiser, compartilhe com o time. As visões ficam no seletor ao lado do título, e Compartilhar copia o link da visão.",
        keywords: ["salvar", "visão", "dashboard", "personalizada", "compartilhar"],
      },
      {
        id: "north-star",
        q: "Como defino a North Star e o Task Success?",
        a: "Em Analytics → Métricas, escolha entre os eventos reais do seu produto: o evento North Star (a ação que mais representa valor), o evento de ativação e os eventos de início e conclusão da tarefa principal. Enquanto não forem escolhidos, os cards pedem a configuração em vez de mostrar um número.",
        keywords: ["north star", "task success", "ativação", "métricas", "funil"],
      },
      {
        id: "canal-aquisicao",
        q: "Como o canal de aquisição é identificado?",
        a: "Pela origem da primeira página da sessão: UTMs da URL (utm_source, utm_medium, utm_campaign) e, sem elas, o site de onde a pessoa veio (buscadores = orgânico, redes sociais = social, outros sites = indicação). Sem nenhuma origem, a sessão é direta.",
        keywords: ["utm", "canal", "origem", "campanha", "orgânico"],
      },
    ],
  },
  {
    id: "heatmaps",
    title: "Heatmaps e Session Replay",
    subtitle: "Veja como as pessoas usam as suas páginas.",
    icon: "flame",
    articles: [
      {
        id: "ativar",
        q: "Como ativo os heatmaps?",
        a: "Na página Heatmaps, um dono ou administrador clica em \"Ativar heatmaps neste projeto\". O SDK que já está no seu produto passa a coletar, sem instalar nada novo. A coleta começa desligada em todo projeto.",
        link: { label: "Abrir Heatmaps", href: "/heatmaps" },
      },
      {
        id: "modos",
        q: "O que cada mapa mostra?",
        a: "- Cliques: onde as pessoas clicam e os elementos mais clicados.\n- Movimento: para onde o cursor vai e os caminhos mais comuns.\n- Scroll: até onde a página é vista e onde ela é abandonada.",
      },
      {
        id: "print",
        q: "Por que a imagem da página ainda não apareceu?",
        a: "A imagem é capturada automaticamente numa das visitas e renovada a cada 7 dias, uma por página e dispositivo. Logo depois de ativar, os números já aparecem e a imagem chega em seguida.",
      },
      {
        id: "dispositivos",
        q: "Por que o mapa mostra um dispositivo de cada vez?",
        a: "Celular e desktop têm layouts diferentes: um clique no celular não tem onde cair na página do desktop. Por isso o mapa usa um dispositivo por vez (você troca abaixo do mapa), enquanto os números ao lado somam todos.",
      },
      {
        id: "privacidade-hm",
        q: "Os heatmaps capturam o que é digitado?",
        a: "Nunca. Valores de campos não são capturados, e e-mails e números longos (CPF, telefone) são mascarados. Para esconder qualquer outra área, adicione o atributo data-luumu-mask ao elemento.",
        keywords: ["mascarar", "lgpd", "senha"],
      },
      {
        id: "replay",
        q: "O Session Replay está disponível?",
        a: "Ainda não. O Session Replay está em construção e aparece como \"Em breve\". Os heatmaps já estão disponíveis.",
      },
    ],
  },
  {
    id: "integracoes",
    title: "Integrações",
    subtitle: "Conecte a Luumu às ferramentas do seu time.",
    icon: "plug",
    articles: [
      {
        id: "quais",
        q: "Quais integrações estão disponíveis?",
        a: "As integrações com outras ferramentas ainda estão em construção, por isso a área aparece bloqueada. Enquanto isso, você pode exportar respostas em CSV, Excel ou PDF e receber relatórios por e-mail.",
      },
      {
        id: "api",
        q: "Existe API ou webhooks?",
        a: "Ainda não: API e Webhooks estão previstos e aparecem como \"Em breve\" nos planos.",
      },
      {
        id: "dados-fora",
        q: "Como levo os dados para outra ferramenta hoje?",
        a: "Exporte as respostas em CSV, Excel ou PDF na página Respostas, ou agende relatórios por e-mail em Relatórios.",
        link: { label: "Abrir Relatórios", href: "/reports" },
      },
      {
        id: "eventos-externos",
        q: "Posso usar eventos do meu produto como gatilho?",
        a: "Sim, sem integração: o SDK captura eventos automaticamente e você pode enviar os seus com Luumu.track(\"nome\").",
      },
      {
        id: "pedir",
        q: "Como peço uma integração?",
        a: "Fale com o time da Luumu: os pedidos dos clientes orientam a ordem das próximas integrações.",
      },
    ],
  },
  {
    id: "sdk",
    title: "SDK & Eventos",
    subtitle: "Instalação, identificação de usuários e eventos.",
    icon: "code",
    articles: [
      {
        id: "instalar-sdk",
        q: "Como instalo o SDK?",
        a: "Copie o trecho da aba Configurações → SDK & Eventos e cole antes do fechamento do </body> do seu produto. Ele carrega o script da Luumu com a chave pública do projeto (pk_…).",
        link: { label: "Abrir SDK & Eventos", href: "/settings/sdk" },
        keywords: ["script", "instalação", "integrar", "integração", "instalar"],
      },
      {
        id: "identify",
        q: "Como identifico o usuário logado?",
        a: "Chame Luumu.identify({ id, email }) depois do login. Isso permite segmentar pesquisas por usuário, mostrar quem respondeu e segmentar tours. Chame Luumu.reset() no logout.",
        keywords: ["identify", "login", "usuário"],
      },
      {
        id: "eventos-auto",
        q: "Quais eventos são capturados automaticamente?",
        a: "Visualizações de página (inclusive trocas de tela em SPA), cliques em botões e links, envios de formulário, cliques de frustração (rage click) e tempo de engajamento. Os nomes são gerados a partir do texto dos elementos.",
      },
      {
        id: "eventos-proprios",
        q: "Como envio meus próprios eventos?",
        a: "Use Luumu.track(\"nome_do_evento\"). Para dar nome a um clique específico sem código, adicione data-luumu-track=\"nome\" ao elemento; para ignorar um elemento, use data-luumu-ignore.",
        keywords: ["track", "evento"],
      },
      {
        id: "desligar-auto",
        q: "Posso desligar a captura automática?",
        a: "Sim: adicione data-luumu-autotrack=\"false\" à tag do script. Os eventos enviados com Luumu.track continuam funcionando.",
      },
      {
        id: "dominios",
        q: "Como restrinjo a chave a alguns domínios?",
        a: "Em Configurações → SDK & Eventos, defina a lista de domínios permitidos da chave. Chamadas de outros endereços são recusadas.",
        keywords: ["segurança", "domínio", "chave"],
      },
      {
        id: "spa",
        q: "Funciona em aplicações de página única (React, Vue, Next)?",
        a: "Sim. O SDK percebe as trocas de rota sem recarregar a página e trata cada tela como uma página.",
      },
    ],
  },
  {
    id: "configuracoes",
    title: "Configurações",
    subtitle: "Workspace, projetos, membros e perfil.",
    icon: "settings",
    articles: [
      {
        id: "convidar",
        q: "Como convido alguém para o meu workspace?",
        a: "Em Configurações → Membros, um dono ou administrador cadastra nome, e-mail, papel e uma senha temporária. A pessoa entra com esses dados e pode trocar a senha no perfil. Não há cadastro aberto: o acesso é sempre por convite.",
        link: { label: "Abrir Membros", href: "/settings/members" },
        keywords: ["membro", "time", "equipe", "acesso"],
      },
      {
        id: "papeis",
        q: "Quais são os papéis de acesso?",
        a: "- Dono: acesso total, inclusive definir os projetos de cada membro.\n- Admin: gerencia membros, projetos e o plano.\n- Editor: cria e edita pesquisas e vê todas as respostas.\n- Viewer: apenas visualiza dashboards e respostas.",
        keywords: ["permissão", "admin", "editor", "viewer"],
      },
      {
        id: "escopo",
        q: "Posso limitar um membro a alguns projetos?",
        a: "Sim. O dono do workspace pode definir em quais projetos cada membro tem acesso. Sem essa definição, o membro vê todos os projetos.",
      },
      {
        id: "projeto-novo",
        q: "Como crio um novo projeto?",
        a: "Pelo seletor de projetos no topo da barra lateral. Cada projeto tem sua própria chave do SDK, pesquisas e dados.",
      },
      {
        id: "logo",
        q: "Como troco o nome ou a logo?",
        a: "O nome e a logo do workspace e dos projetos ficam em Configurações. Sua foto e seu nome ficam em Meu perfil.",
        link: { label: "Abrir Configurações", href: "/settings" },
      },
      {
        id: "senha",
        q: "Como troco minha senha?",
        a: "Em Meu perfil (menu do seu nome, no canto superior direito).",
        link: { label: "Abrir Meu perfil", href: "/settings/profile" },
      },
    ],
  },
  {
    id: "plano",
    title: "Plano & Cobrança",
    subtitle: "Planos, limites e mudanças de plano.",
    icon: "crown",
    articles: [
      {
        id: "mudar",
        q: "Posso mudar de plano a qualquer momento?",
        a: "Sim. Você solicita a mudança na página Plano & Cobrança e nossa equipe confirma com você os detalhes e a data de início. Nenhuma cobrança é feita na hora do pedido.",
        link: { label: "Abrir Plano & Cobrança", href: "/billing" },
      },
      {
        id: "limite",
        q: "O que acontece se eu ultrapassar o limite?",
        a: "Você acompanha o uso do mês no topo da plataforma (Uso do plano). Se passar do limite de respostas, nossa equipe entra em contato para combinar o plano adequado; nada é bloqueado sem aviso. Nos heatmaps, novas visitas deixam de ser registradas até o mês seguinte.",
      },
      {
        id: "contagem",
        q: "Como são contadas as respostas e sessões?",
        a: "Cada envio de pesquisa conta como uma resposta, somando todos os projetos do workspace no mês do calendário. Sessões contam as visitas registradas pelos heatmaps: uma pessoa navegando pelo produto é uma sessão, mesmo passando por várias páginas.",
      },
      {
        id: "anual",
        q: "Vocês oferecem desconto anual?",
        a: "Sim: no plano anual você paga 20% a menos que no mensal, com cobrança única por ano.",
      },
      {
        id: "workspaces",
        q: "Posso ter múltiplos workspaces?",
        a: "Sim. Cada workspace tem seu próprio plano. Dentro de um workspace você pode ter vários projetos e plataformas, sem custo extra.",
      },
      {
        id: "suporte",
        q: "O plano inclui suporte?",
        a: "Sim, todos os planos incluem suporte. O Enterprise conta com suporte dedicado, onboarding acompanhado e SLA.",
      },
      {
        id: "uso",
        q: "Onde vejo quanto do plano já usei?",
        a: "No botão Uso do plano, no topo da plataforma, e na página Plano & Cobrança. Os números somam todos os projetos do workspace.",
      },
      {
        id: "quem-muda",
        q: "Quem pode mudar o plano?",
        a: "Donos e administradores do workspace.",
      },
    ],
  },
  {
    id: "seguranca",
    title: "Segurança e Privacidade",
    subtitle: "Como os seus dados e os dos seus clientes são protegidos.",
    icon: "shield",
    articles: [
      {
        id: "onde-ficam",
        q: "Onde os dados ficam guardados?",
        a: "Em banco de dados gerenciado, com conexão criptografada, separados por workspace e projeto: um workspace nunca enxerga os dados de outro.",
      },
      {
        id: "chave-publica",
        q: "A chave do SDK é um segredo?",
        a: "Não: a chave pk_ é pública por natureza (fica no código do seu site) e só permite enviar dados e ler as pesquisas ativas. Para impedir uso em outros sites, restrinja a chave aos seus domínios.",
      },
      {
        id: "dados-ia",
        q: "Os comentários são usados para treinar IA?",
        a: "Não. Os comentários vão anonimizados para a análise e o provedor não os usa para treinar modelos.",
      },
      {
        id: "heatmap-dados",
        q: "O que os heatmaps registram?",
        a: "Posições de cliques e do cursor relativas aos elementos da página, profundidade de rolagem e tempo na página. Não gravam a tela nem o que é digitado, e mascaram dados pessoais visíveis.",
      },
      {
        id: "acesso",
        q: "Quem pode acessar o meu workspace?",
        a: "Só as pessoas convidadas por um dono ou administrador. Não existe cadastro aberto, e cada membro pode ser limitado a alguns projetos.",
      },
    ],
  },
  {
    id: "problemas",
    title: "Solução de problemas",
    subtitle: "O que verificar quando algo não sai como esperado.",
    icon: "wrench",
    articles: [
      {
        id: "nao-aparece",
        q: "A pesquisa não aparece no meu produto. E agora?",
        a: "Confira, nesta ordem:\n\n- O status está Ativa e dentro da vigência?\n- O SDK está instalado nesta página (com a chave deste projeto)?\n- A plataforma está entre as marcadas na pesquisa?\n- Você já respondeu e a frequência é \"uma vez por usuário\"?\n- O público é \"usuários específicos\" e você não está na lista?\n- Há gatilho por evento que ainda não aconteceu?\n\nDepois de publicar, a pesquisa pode levar até alguns minutos para aparecer para quem já visitou o site.",
        keywords: ["não aparece", "sumiu", "não mostra"],
      },
      {
        id: "testar",
        q: "Como testo a pesquisa sem esperar o gatilho?",
        a: "Use a prévia no editor, ou chame Luumu.show(\"id_da_pesquisa\") no console do seu site para exibi-la na hora.",
      },
      {
        id: "sdk-nao-carrega",
        q: "O SDK não está carregando.",
        a: "Verifique se a chave pk_ está correta e ativa e se o domínio do site está na lista de domínios permitidos da chave (se houver lista). Bloqueadores de anúncio também podem impedir o script.",
      },
      {
        id: "eventos-nao-aparecem",
        q: "Meus eventos não aparecem na lista.",
        a: "O nome do evento aparece depois que ele acontece pela primeira vez numa plataforma conhecida do projeto. Recarregue a aba Configurações → SDK & Eventos alguns minutos depois de disparar o evento.",
      },
      {
        id: "plataforma-nova",
        q: "Uma plataforma nova não aparece.",
        a: "Ela é registrada na primeira visita em que o SDK roda naquele endereço. Abra o site com o SDK instalado e atualize a lista.",
      },
      {
        id: "heatmap-vazio",
        q: "Ativei os heatmaps, mas não aparece nada.",
        a: "A visita é enviada quando a pessoa sai da página (troca de aba, fecha ou navega). Navegue pelo seu produto, troque de aba e volte em alguns minutos. Confira também se o seu plano inclui heatmaps e se o limite do mês não foi atingido.",
      },
      {
        id: "tour-nao-aparece",
        q: "O tour não aparece.",
        a: "Confira se ele está publicado, se a frequência permite exibir de novo para você e se o gatilho (primeiro acesso, evento, página) aconteceu. A plataforma também precisa estar entre as escolhidas.",
      },
      {
        id: "login",
        q: "Não consigo entrar na Luumu.",
        a: "O acesso é por convite: peça a um dono ou administrador do workspace para cadastrar você. Se já tem conta e esqueceu a senha, peça a ele uma nova senha temporária.",
        keywords: ["senha", "acesso", "entrar"],
      },
      {
        id: "ia-nao-responde",
        q: "A IA não respondeu minha pergunta.",
        a: "Há um limite de perguntas por minuto e por dia. Se ele for atingido, ou se a IA estiver indisponível, a Luumu responde com os números calculados. Tente de novo em alguns minutos.",
      },
      {
        id: "numeros-diferentes",
        q: "Os números do Dashboard e de Respostas não batem.",
        a: "Confira se os filtros são os mesmos nas duas telas: pesquisa, período e plataforma. O período padrão é dos últimos 30 dias.",
      },
    ],
  },
];

export const HELP_EXAMPLES = ["Como criar uma pesquisa?", "Como analisar as respostas?", "Como integrar o SDK?"];

export interface HelpHit {
  category: HelpCategory;
  article: HelpArticle;
  score: number;
}

/**
 * Busca na FAQ: cada palavra relevante da consulta precisa aparecer na pergunta, na resposta
 * ou nas palavras-chave (sem acento e sem caixa). A pergunta pesa mais que a resposta.
 */
export function searchHelp(query: string, categories: HelpCategory[] = HELP): HelpHit[] {
  const STOP = new Set(["como", "o", "a", "os", "as", "de", "do", "da", "dos", "das", "e", "um", "uma", "no", "na", "em", "eu", "meu", "minha", "para", "que", "com", "por", "se", "é", "posso"]);
  const words = fold(query)
    .split(/[^a-z0-9_]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    // raiz da palavra: "trocar" casa com "troco", "integrar" com "integração", "analisar" com "análise"
    .map((w) => (w.length > 4 ? w.slice(0, Math.max(4, w.length - 3)) : w));
  if (!words.length) return [];
  const scored: (HelpHit & { matched: number })[] = [];
  for (const category of categories) {
    for (const article of category.articles) {
      const q = fold(article.q);
      const a = fold(article.a);
      const k = fold([...(article.keywords ?? []), category.title].join(" "));
      let score = 0;
      let matched = 0;
      for (const w of words) {
        const s = (q.includes(w) ? 10 : 0) + (k.includes(w) ? 6 : 0) + (a.includes(w) ? 3 : 0);
        if (s) matched++;
        score += s;
      }
      if (matched) scored.push({ category, article, score, matched });
    }
  }
  // artigos com TODAS as palavras; se nenhum, os que têm ao menos metade delas
  const full = scored.filter((h) => h.matched === words.length);
  const pool = full.length ? full : scored.filter((h) => h.matched * 2 >= words.length);
  return pool.sort((x, y) => y.matched - x.matched || y.score - x.score).map(({ category, article, score }) => ({ category, article, score }));
}

export const totalArticles = (categories: HelpCategory[] = HELP) => categories.reduce((n, c) => n + c.articles.length, 0);
