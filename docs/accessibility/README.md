# Plugin de Acessibilidade

Botão de acessibilidade dentro do produto do cliente: recursos de leitura, cor e navegação,
Libras pelo tradutor oficial VLibras (gov.br), navegação pelo rosto e um convite para
estudantes sinalizados. Tudo é
configurado no painel da Luumu (`/accessibility`) e chega ao produto pelo SDK que ele já
instalou. Sem código novo no cliente.

## Peças

```
painel Luumu  /accessibility                         produto do cliente
┌─────────────────────────────────┐          ┌──────────────────────────────────┐
│ AccessibilityAdmin (abas)       │          │ sdk.js (core)                    │
│  Recursos · Aparência ·         │          │  /config traz `a11y` → baixa     │
│  Libras · Convite               │          │  sdk-a11y.js (sob demanda)       │
│ LivePreview ── iframe ──────────┼─► /demo/accessibility?embed=1          │
│   (postMessage da config)       │          │ widget.ts  launcher, painel,     │
└───────────────┬─────────────────┘          │   convite, avisos                │
                │ saveAccessibilityAction    │ page-effects.ts  efeitos na página│
                ▼                            │ libras.ts (VLibras) · face-nav.ts│
   accessibility_settings (0044)  ◄── /api/v1/config (recorte público)        │
                                  ◄── /api/v1/accessibility/match (convidados)│
                                  ◄── /api/v1/accessibility/prefs (escolhas)  │
                                             └──────────────────────────────────┘
```

| Arquivo | Papel |
|---|---|
| `src/lib/accessibility/features.ts` | catálogo de recursos e perfis, preferências do estudante, correção de daltonismo (puro) |
| `src/lib/accessibility/config.ts` | configuração do projeto, `normalizeA11yConfig` (única porta de entrada) e `publicA11yConfig` (puro) |
| `src/lib/accessibility/audience.ts` | grupos de rede/escola/turma/ano e lista individual (puro) |
| `src/lib/accessibility/nudge.ts` | quando o convite pode reaparecer (puro) |
| `src/lib/accessibility/scope.ts` | onde o plugin fica ativo: domínios, grupos, convidados (puro) |
| `src/lib/accessibility/invitees.ts` | chave do estudante, leitura de lista colada/CSV, status do convite (puro) |
| `src/lib/accessibility/verify.ts` | verificação de identidade (HMAC) e chave pseudonimizada das preferências (server-only) |
| `src/lib/api/accessibility.ts` | validação comum das rotas do SDK com dados de um estudante |
| `src/lib/accessibility/vlibras.ts` | VLibras: avatares, pedido de personalização no formato oficial, validação do endereço aprovado (puro) |
| `src/lib/db/accessibility.ts` | leitura/gravação, cache de 60s por instância |
| `src/sdk/accessibility/*` | widget no produto (`public/sdk-a11y.js`) |
| `src/components/accessibility/*` | editor do painel e prévia |
| `src/app/demo/accessibility` | plataforma escolar fictícia com o widget real (prévia e demonstração) |

## Como o produto informa quem é o estudante

Tudo que depende do estudante usa os traits do `Luumu.identify`. Os nomes aceitos (português ou
inglês) estão em `TRAIT_ALIASES` (`audience.ts`):

```js
Luumu.identify({
  id: "123456", email: "ana@escola.sp.gov.br",
  user_hash: "…",   // HMAC-SHA256(segredo do projeto, id em minúsculas), ver "Verificação"
  rede: "Rede Estadual SP", escola: "EE Prof. Ana Rosa", turma: "7º A",
  school_year: "7º ano",
});
```

A chave do estudante é o `id` (ou, na falta dele, o `email`), em minúsculas e sem espaços
(`userKeyFrom`). A comparação de rede/escola/turma ignora acento, caixa e espaços repetidos.
Dentro de um grupo, todos os campos preenchidos precisam bater; dentro de um campo, qualquer
valor serve; entre grupos, basta um.

O produto também pode abrir o painel por um botão próprio:
`Luumu.accessibility.open()`, `open("libras")` ou `open("face")`.

## Onde o plugin aparece (Ativação)

`config.scope` (`scope.ts`), com duas escolhas independentes:

- **Plataformas**: as do projeto onde o botão aparece. Nenhuma marcada = todas (mesmo padrão
  do público das pesquisas). Nas outras, o plugin nem é carregado.
- **Estudantes**: todos, ou só alguns — quem casar com um grupo de rede/escola/turma/ano ou
  estiver na lista de convidados ("Convidados da lista"). "Só alguns" sem nenhum critério não
  alcança ninguém; o painel avisa antes de publicar.

Cada camada é decidida onde custa menos e expõe menos:

| Camada | Onde | Por quê |
|---|---|---|
| plataforma | servidor, no `/config` | o host já é parte da chave de cache; fora dela o SDK nem recebe o plugin |
| grupos | navegador | rede/escola/turma não identificam ninguém |
| convidados | servidor, `/match`, por estudante | a lista é dado sensível |

Enquanto decide, o widget fica escondido e não toca na página. Fora do escopo, as escolhas
guardadas do estudante não são aplicadas.

## No ar × rascunho (painel)

O cartão do topo descreve **o que está no ar** (a última versão salva): ligado ou desligado,
onde, para quem e quantos recursos. O botão Ligado/Desligado liga e desliga **essa** versão.
O que se edita nas abas é um rascunho: aparece como "Alterações ainda não publicadas", a prévia
já o mostra, e só vai ao produto com **Publicar alterações**.

**Tempo até chegar ao produto: até ~5 minutos.** O SDK guarda o catálogo do `/config` no
navegador para não buscá-lo a cada página: 30 min normalmente, **5 min em projetos que usam o
plugin** — ligado ou desligado (o `/config` marca `a11yWatch` quando o projeto já configurou o
plugin), porque ligar, desligar ou mudar onde ele aparece precisa chegar logo. Somam-se até
~1 min de cache de borda e ~1 min de cache em memória do servidor. Além disso:

- se um catálogo novo chega sem o plugin, o core desmonta o widget (a página volta como era);
- se uma rota do plugin (`/prefs`, `/match`) responde 404 ("desligado"), o widget avisa o core,
  que tira o plugin da página na hora e descarta o catálogo guardado. Falha do banco responde
  503, para não desligar o plugin por engano.

## Atalhos e convite (aparência)

- **Cápsula de atalhos**: em repouso só o botão de acessibilidade aparece; ao passar o mouse (ou
  focar pelo teclado — Tab no botão principal já revela o resto) a cápsula cresce e mostra Libras
  e Navegação por rosto, com o nome de cada um ao lado. Em telas de toque os atalhos ficam no
  painel. Na posição "meio", o botão principal fica em cima e a cápsula cresce para baixo.
- **Arrastar** (`launcher.draggable`, ligado por padrão): o estudante leva o botão para qualquer
  ponto da tela com mouse, caneta ou dedo (um toque sem arrastar continua abrindo o painel), ou
  move com Shift + setas. A posição fica em `prefs.launcherPos` (centro em fração da tela, para
  valer em telas diferentes) e sincroniza com a conta como as demais escolhas; na metade de cima
  da tela os atalhos abrem para baixo. "Restaurar padrão" volta à posição do painel da Luumu.
- **Cores** (`launcher.colors`): botão principal (vazio = cor de destaque da marca), fundo da
  cápsula, botões de atalho e ícones; estilos prontos Noite, Grafite, Claro e Lavanda. O widget
  deriva gradientes, anel, brilho e a cor de texto com contraste; o painel avisa quando o ícone
  fica com menos de 3:1 sobre o botão.
- **Convite**: layout com ilustração à esquerda (`nudge.image`: padrão em
  `public/a11y/convite-estudante.png`, uma enviada pelo cliente ou nenhuma), título, texto com
  `**negrito**`, até três perfis para o estudante marcar (o sugerido já vem marcado) e os botões.
  Com perfis marcados, "Ativar" liga direto; sem nada marcado, abre o painel.

## Login e logout no produto

O plugin reavalia quem é o estudante sempre que o produto chama `Luumu.identify` ou
`Luumu.reset` — inclusive em login sem recarregar a página (SPA): o plugin e o convite aparecem
na hora para quem tem direito, e somem no logout. O SDK lembra o último estudante identificado
naquele navegador até o `reset()`: o produto deve chamar `Luumu.reset()` no logout (computador
de escola é compartilhado).

## Convidados

Tabela `accessibility_invitees`, editada na aba Convite (as mudanças valem na hora, fora da
barra "Salvar"):

- **um a um**: ID ou e-mail, nome e perfil sugerido só para ele;
- **em lote**: lista colada (um por linha ou separados por vírgula), CSV ou Excel (.xlsx), com
  cabeçalho `id`/`email`/`matrícula`, `nome`, `perfil` em qualquer ordem (o perfil aceita o id
  ou o nome mostrado, ex. "Mais foco"). Quem já está na lista é atualizado e mantém o status;
- busca, filtro por status, seleção, "Remover todos" e um modelo CSV para baixar.

**Status do convite**: Ainda não viu → Viu o convite → Aceitou / Dispensou. O SDK manda o
desfecho para `/match` (`event`) só quando o estudante é convidado da lista. "Aceitou" não volta
atrás.

## Preferências em qualquer aparelho

Regra do projeto: **vale sempre a última necessidade aplicada pelo estudante**, em qualquer
aparelho, navegador ou janela anônima. As escolhas ficam na conta dele
(`accessibility_user_prefs`, chave pseudonimizada):

- **a conta guarda a última mudança que chegou ao servidor**, com a hora do servidor (relógio de
  aparelho adiantado ou atrasado não decide nada);
- **toda mudança no aparelho fica pendente** até a conta confirmar o recebimento (`d` no cache
  local). Ao ler a conta, um aparelho **sem pendência adota a conta**; com pendência (ex.: estava
  sem internet), envia a dele;
- a conta é **lida a cada página e ao voltar para a aba**, no máximo uma vez por minuto; leitura
  que falha tenta de novo (3 s e 10 s);
- **ID e e-mail**: a conta é gravada nas duas chaves e lida por qualquer uma (vale a mais
  recente) — o mesmo estudante pode chegar com ID e e-mail num aparelho e só com e-mail em outro.
  Com "exigir verificação", só a chave assinada é usada;
- o `localStorage` é só o cache que deixa a página certa já no primeiro desenho; mudança pendente
  é enviada na hora ao esconder ou fechar a aba (`keepalive`);
- estudante não identificado: só no aparelho, nenhuma chamada ao servidor;
- **o convite também**: o desfecho fica na mesma linha (chave `_nudge` do JSON). "Aceito" nunca é
  rebaixado (`mergeNudge`); para convidados da lista, o status do painel também conta. O convite
  espera a leitura da conta antes de decidir se aparece;
- **pré-requisitos**: o produto chama `Luumu.identify` com o `id` e/ou `email` do estudante (o
  mesmo valor em todos os aparelhos). Com "Exigir verificação", também o `user_hash` — sem ele o
  servidor recusa (403) e as escolhas ficam só no aparelho.

## Integração com plataforma externa

Painel → Ativação → **Integração**. No modo **Plataforma externa**, quem decide quem recebe o
convite e onde ficam as escolhas do estudante é outra plataforma; a Luumu não guarda lista de
convidados nem preferências (`/prefs` e `/match` não são chamados). Contrato em
`src/lib/accessibility/integration.ts`; documentação para o time da plataforma em
`docs/accessibility/integracao-plataforma-externa.pdf` (gerada por
`scripts/a11y-integration-pdf.mjs`).

**Entrada** — a página informa o estudante logado (pode ser antes de o plugin carregar; o SDK
guarda e entrega; `luumu:ready` avisa quando o `Luumu` existe):

```js
Luumu.accessibility.setUser({
  id: "123", email: "ana@escola.br", user_hash: "…",      // identificam (como o identify)
  invite: true,                                          // mostrar o convite
  profiles: ["leitura", "foco"],                         // perfis do convite (vazio = os do painel)
  status: "pending",                                     // "accepted"/"dismissed" = não mostra de novo
  prefs: { textSize: 2, legibleFont: true, profiles: ["leitura"] }, // última configuração salva
});
```

O convite só sai com `invite: true`, status `pending`/`shown`, convite ligado no painel,
nenhum recurso já ligado e uma vez por sessão do navegador. O plugin espera até 10 s pelo
`setUser` antes de desistir do convite. `prefs` é adotado, exceto quando o estudante mudou algo
nesta página depois do último `setUser` (um eco antigo não desfaz a mudança).

**Saída** — cada mudança sai na hora, com o mesmo `A11yEvent`
(`prefs.updated`, `invite.shown`, `invite.accepted`, `invite.dismissed`):

- navegador: `window` `"luumu:accessibility"` (`e.detail`) e `Luumu.accessibility.onChange(fn)`;
- webhook (opcional, vale nos dois modos): o widget manda para
  `POST /api/v1/accessibility/events` (mesmas regras das outras rotas: key, CORS, limite,
  verificação) e a Luumu repassa, com `after()`, para a URL configurada — assinado
  (`X-Luumu-Signature: sha256=HMAC(segredo, "<ts>.<corpo>")`), até 3 tentativas (0, +1 s, +4 s),
  5 s cada. Nada é guardado. A URL nunca vai para o navegador (`publicA11yConfig` só manda
  `webhook: true`) e precisa ser https pública (`safeWebhookUrl`). Só estudantes identificados.
  "Testar webhook" no painel manda um evento `test`.

## Verificação de identidade

Sem ela, quem souber o ID de um estudante consegue pedir as preferências dele (que podem indicar
uma deficiência) e saber se ele é convidado. Com ela, o backend do produto assina o ID:

```
user_hash = HMAC-SHA256(segredo do projeto, id em minúsculas e sem espaços)   // hex
```

e manda no `identify`. O segredo é gerado e trocado no painel (aba Ativação, só owner/admin),
fica em `accessibility_settings.identity_secret` e nunca vai para o navegador. Com **Exigir
verificação** ligado, `/prefs` e `/match` recusam chamadas sem assinatura válida (o widget
continua funcionando, com as escolhas só no aparelho). Ligue a exigência depois que o produto
já estiver enviando o `user_hash`.

## Privacidade (LGPD)

- **Lista de convidados** é dado sensível: indica que uma pessoa identificada tem uma
  necessidade de acessibilidade. Ela nunca sai no `/config` público. O SDK só sabe que ela
  existe (`hasList`) e pergunta `POST /api/v1/accessibility/match` pelo próprio estudante logado
  (rate limit de 30/min por IP + key; com verificação, só com `user_hash` válido). A resposta
  fica 12h no navegador dele.
- **Escolhas do estudante** ficam na conta dele (`accessibility_user_prefs`) com a chave
  **pseudonimizada**: `sha256(projeto + ID)`. A tabela não guarda o ID em claro ao lado das
  necessidades. No navegador, o cache local é por projeto e por estudante (computador de escola
  é compartilhado). Ver "Verificação de identidade" para quem pode ler.
- Todas as rotas com dados de um estudante usam POST: o ID não vai para a URL (logs, cache).
- **Navegação por rosto**: a imagem da câmera é processada no navegador (MediaPipe
  FaceLandmarker, baixado do jsDelivr só quando o estudante aceita). Nenhum quadro sai do
  dispositivo, e a câmera é desligada ao parar ou ao sair da página.
- **Leitor de texto**: usa a voz do próprio navegador (`speechSynthesis`).
- **Libras**: o texto que o estudante clica vai para o tradutor do VLibras (ver "Libras").

## Libras (VLibras)

O botão Libras abre o **VLibras Widget**, o tradutor oficial do governo federal: gratuito, de
código aberto e com tradução real (português → glosa → sinais animados num avatar 3D, ~21 mil
sinais, regionalismos, dicionário e velocidade ajustável). Com ele aberto, o estudante clica
num texto da página e o avatar traduz.

**Por que o VLibras e não um avatar próprio.** A primeira versão do plugin tinha um avatar SVG
da Luumu com a marca do cliente, mas ele só fazia uma animação ilustrativa. Para um estudante
surdo, uma sinalização que não significa nada é pior do que nenhuma. Alternativas avaliadas
(nov/2026):

| Opção | Tradução | Custo | Marca do cliente no avatar | Abrir pelo código |
|---|---|---|---|---|
| **VLibras 7** (gov.br) | real, IA + 21 mil sinais | grátis | cores e logo, para parceiros aprovados | sim (`VLibrasWidget.open()`) |
| Hand Talk (Hugo e Maya) | real | pago, por token | roupa com a marca nos planos pagos | não documentado |
| Rybená | real | pago | roupa e avatar exclusivos nos planos pagos | não documentado |
| Avatar SVG da Luumu (removido) | **não traduz** | n/a | total | sim |

**Integração (v7).** Feita conforme a [documentação oficial](https://www.vlibras.gov.br/doc/widget/installation/webpageintegration.html)
e o loader `vlibras-plugin.js`, ver `src/sdk/accessibility/libras.ts`:

- avatar (Ícaro, Hosana, Guga ou aleatório), posição (L/R) e personalização vão em
  `window.VLibrasWidget` antes do script carregar;
- `window.VLibrasWidget.open()` abre o tradutor; `#vlibras-app-root[data-active]` diz se ele está
  aberto. A Luumu observa esse atributo, então fechar pelo X do VLibras desliga o botão Libras;
- o botão flutuante do VLibras é escondido quando a Luumu carrega o script (o estudante já tem
  o botão Libras). Se o site já tinha o VLibras instalado, a Luumu reaproveita o dele;
- o tradutor abre do lado oposto aos botões da Luumu;
- sem o VLibras disponível (rede ou CSP), o estudante recebe um aviso e o recurso desliga.

**Personalização com a marca do cliente.** Pela [regra do VLibras](https://www.vlibras.gov.br/doc/widget/functionalities/customize-avatar.html),
cores e logo na camisa são **exclusivos de instituições parceiras** e passam por aprovação. A
Luumu não gera nem hospeda personalização por conta própria. A aba Libras do painel:

1. coleta as cores (camisa, calça, pele, cabelo) e a logo desejadas;
2. gera a logo no padrão exigido (PNG 500×500, sem fundo, margem de 75 px);
3. monta o e-mail de pedido para `cgpsp@economia.gov.br` com o arquivo de configuração no
   formato oficial (`calca`, `camisa`, `cabelo`, `corpo`, `iris`, `olhos`, `sombrancelhas`,
   `pos`, `logo`) e os sites do projeto;
4. depois da aprovação, recebe o endereço de personalização (`https://…json`), que vai para
   `window.VLibrasWidget.personalization`.

**CSP do produto do cliente.** Se o site usa Content Security Policy, libere
`frame-src https://vlibras.gov.br` (o avatar roda num iframe) e
`font-src https://vlibras.gov.br https://cdn.jsdelivr.net`, além de `script-src https://vlibras.gov.br https://cdn.jsdelivr.net`.

**Privacidade.** O VLibras envia o texto clicado ao serviço de tradução do governo
(`traducao2.vlibras.gov.br`). Ele tem métricas próprias de uso, amostradas e só depois que o
estudante aceita o aviso de consentimento do próprio VLibras.

## Recursos na página

`page-effects.ts` aplica tudo como classes `lu-a11y-*` em `<html>` com uma `<style>` própria,
e `destroy()` devolve a página exatamente como estava. Algumas notas:

- **Tamanho do texto** escala cada elemento com texto a partir do tamanho original, em px e
  com `!important`. Funciona em sites com px, rem ou em sem compor escalas. Conteúdo novo
  (SPA) refaz a escala, no máximo uma vez por segundo.
- **Contraste, saturação e daltonismo** viram `filter` no `<html>`: filtro no elemento raiz
  não cria bloco de contenção, então elementos `position: fixed` do site continuam no lugar.
  O modo escuro inverte a página e desfaz a inversão em imagens, vídeos e no próprio widget.
- **Fonte legível** é Atkinson Hyperlegible (Google Fonts), com Verdana como reserva. Ícones
  de fonte (`i`, `[class*=icon]`, Font Awesome, Material) ficam de fora.

## Ambiente

1. Aplique `drizzle/0044_accessibility.sql` no SQL Editor do Neon (três tabelas:
   `accessibility_settings`, `accessibility_invitees`, `accessibility_user_prefs`). Sem ela, o
   `/config` manda o plugin desligado e `/accessibility` mostra um aviso com o erro do banco.
   Depois aplique `drizzle/0045_accessibility_identity.sql`: ela acrescenta as colunas da
   verificação de identidade em bancos onde a tabela de configuração veio da primeira versão
   da 0044 (o `CREATE TABLE IF NOT EXISTS` não altera tabela existente). As duas são idempotentes.
2. `pnpm build:sdk` gera `public/sdk-a11y.js`, e o `prebuild` já roda esse passo.
3. Upload de logo usa o mesmo Blob Store dos tours (`BLOB_READ_WRITE_TOKEN`). Sem ele, cole a URL.
