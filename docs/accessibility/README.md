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
                                  ◄── /api/v1/accessibility/match (lista)     │
                                             └──────────────────────────────────┘
```

| Arquivo | Papel |
|---|---|
| `src/lib/accessibility/features.ts` | catálogo de recursos e perfis, preferências do estudante, correção de daltonismo (puro) |
| `src/lib/accessibility/config.ts` | configuração do projeto, `normalizeA11yConfig` (única porta de entrada) e `publicA11yConfig` (puro) |
| `src/lib/accessibility/audience.ts` | grupos de rede/escola/turma/ano e lista individual (puro) |
| `src/lib/accessibility/nudge.ts` | quando o convite pode reaparecer (puro) |
| `src/lib/accessibility/vlibras.ts` | VLibras: avatares, pedido de personalização no formato oficial, validação do endereço aprovado (puro) |
| `src/lib/db/accessibility.ts` | leitura/gravação, cache de 60s por instância |
| `src/sdk/accessibility/*` | widget no produto (`public/sdk-a11y.js`) |
| `src/components/accessibility/*` | editor do painel e prévia |
| `src/app/demo/accessibility` | plataforma escolar fictícia com o widget real (prévia e demonstração) |

## Como o produto informa quem é o estudante

O convite usa os traits do `Luumu.identify`. Os nomes aceitos (português ou inglês) estão em
`TRAIT_ALIASES` (`audience.ts`):

```js
Luumu.identify({
  id: "123456", email: "ana@escola.sp.gov.br",
  rede: "Rede Estadual SP", escola: "EE Prof. Ana Rosa", turma: "7º A",
  school_year: "7º ano",
});
```

A comparação ignora acento, caixa e espaços repetidos. Dentro de um grupo, todos os campos
preenchidos precisam bater; dentro de um campo, qualquer valor serve; entre grupos, basta um.

O produto também pode abrir o painel por um botão próprio:
`Luumu.accessibility.open()`, `open("libras")` ou `open("face")`.

## Privacidade (LGPD)

- **Lista individual de estudantes sinalizados** é dado sensível: indica que uma pessoa
  identificada tem uma necessidade de acessibilidade. Ela nunca sai no `/config` público. O
  SDK só sabe que ela existe (`hasList`) e pergunta `POST /api/v1/accessibility/match` pelo
  próprio estudante logado (com rate limit de 20/min por IP + key). A resposta fica 12h no
  navegador dele.
- **Escolhas do estudante** ficam só no `localStorage`, por projeto e por usuário (`id` ou
  `email` do identify). Computador de escola é compartilhado, por isso a chave inclui o usuário.
  Nenhuma escolha é enviada à Luumu.
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

1. Aplique `drizzle/0044_accessibility.sql` no SQL Editor do Neon. Sem ela, o `/config` manda
   o plugin desligado e `/accessibility` mostra um aviso.
2. `pnpm build:sdk` gera `public/sdk-a11y.js`, e o `prebuild` já roda esse passo.
3. Upload de logo usa o mesmo Blob Store dos tours (`BLOB_READ_WRITE_TOKEN`). Sem ele, cole a URL.
