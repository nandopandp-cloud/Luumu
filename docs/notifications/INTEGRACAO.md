# Notificações da Luumu no GenieX — guia de integração (Opção A)

Para o time de engenharia do GenieX. O sino, o painel, os textos e as regras ficam com a Luumu;
aqui está só o que o GenieX precisa fazer. São quatro itens, todos no front-end do ambiente
logado do estudante. Nenhum back-end novo, nenhuma chave secreta.

O que o estudante vai ver:

- **Nova tarefa** / **Nova Prova Genial**: quando aparece uma atividade nova para ele.
- **Falta 1 dia**: 24h antes do prazo de cada atividade ainda pendente.
- **Recados** escritos pela equipe no painel da Luumu (isso já funciona hoje, sem nada do GenieX).

As notificações só aparecem dentro do produto, com o estudante logado. Não há push nem e-mail.

---

## 1. Identificar o estudante em todas as telas logadas (provavelmente já existe)

O sino só aparece para quem foi identificado. Confiram se o GenieX já faz isto:

```js
// depois do login E ao reabrir o app com a sessão já ativa
Luumu.identify({
  id: String(estudante.id),          // obrigatório: o mesmo id em todos os aparelhos
  email: estudante.email,            // opcional
  name: estudante.nome,              // opcional
  school_year: estudante.anoEscolar, // opcional, recomendado: "6º ano", "1ª série"... (segmenta recados)
});

// no logout
Luumu.reset();
```

- Em SPA, chame o `identify` logo depois do login, sem esperar recarregar a página: o sino aparece
  na hora.
- No logout, `Luumu.reset()` tira o sino da tela. Sem isso, o próximo estudante no mesmo
  computador veria o sino do anterior até a página recarregar.

## 2. Reservar o lugar do sino no header

No header do ambiente logado, onde o sino deve ficar (sugestão: junto dos ícones à direita, antes
do avatar):

```html
<div id="luumu-bell"></div>
```

- Só nas telas logadas. Na tela de login, o elemento não deve existir.
- Deixem o elemento vazio: a Luumu coloca o sino dentro dele. O sino usa a cor do texto do header
  e ocupa 38×38 px.
- O sino fica num Shadow DOM: o CSS do GenieX não afeta o sino, e o CSS do sino não afeta o
  GenieX. Se o header for remontado numa troca de rota, o sino volta sozinho.
- Com SSR/hidratação (Next.js e similares), use `suppressHydrationWarning` nesse elemento.
  Exemplo em React:

```tsx
<div id="luumu-bell" suppressHydrationWarning />
```

## 3. Entregar ao SDK a lista de atividades pendentes do estudante

É o item principal. O GenieX passa para a Luumu a lista **atual** de atividades que o estudante
logado ainda precisa fazer. A Luumu compara com a última lista que viu, descobre o que é novo e
calcula os prazos.

```js
window.Luumu?.notifications?.setActivities?.([
  {
    id: "t123",                               // id estável da atividade
    type: "tarefa",                           // "tarefa" ou "prova_genial"
    title: "Frações e decimais",
    assignedAt: "2026-11-18T10:00:00-03:00",  // quando foi liberada para o estudante
    dueAt: "2026-11-25T23:59:00-03:00",       // prazo; null se não tiver
    url: "/tarefas/t123",                     // página que abre a atividade
  },
  {
    id: "p45",
    type: "prova_genial",
    title: "Prova Genial 3",
    assignedAt: "2026-11-17T08:00:00-03:00",
    dueAt: "2026-11-28T18:00:00-03:00",
    url: "/provas/p45",
  },
]);
```

### Onde e quando chamar

- **No layout do ambiente logado** (o componente que envolve todas as telas do estudante), e não só
  na tela de Tarefas. Se a chamada ficar só na tela de Tarefas, o estudante só é avisado quando já
  está olhando as tarefas, e o sino perde o sentido.
- Chame **depois do `identify`**, sempre que a lista for carregada: ao entrar no app, ao voltar para
  a aba, depois de entregar uma tarefa. Pode chamar quantas vezes quiser: a chamada é local, não
  faz requisição à Luumu, e listas repetidas são ignoradas.
- A fonte é o endpoint que o GenieX já usa para listar as atividades pendentes do estudante
  (o da tela de Tarefas ou da página inicial). Não precisa de endpoint novo.

### Regras da lista

- **É uma fotografia, não um evento.** Mandem sempre a lista completa de pendentes. Atividade que
  saiu da lista (entregue, cancelada, encerrada) para de gerar avisos de prazo.
- **Só pendentes.** Não incluam atividades já entregues. Se for mais fácil mandar todas, marquem as
  entregues com `done: true`.
- **Só as do estudante logado.** Nunca dados de outros estudantes.
- **Até 100 atividades.** Se houver mais, mandem as de prazo mais próximo.

### Campos

| Campo | Obrigatório | Formato | Observação |
|---|---|---|---|
| `id` | sim | texto, até 100 caracteres | Estável: o mesmo id sempre, para o mesmo estudante. Pode ser o id da atividade (não precisa ser único entre estudantes). |
| `type` | sim | `"tarefa"` ou `"prova_genial"` | Define o ícone e o texto ("Nova tarefa", "Nova Prova Genial"). |
| `title` | sim | texto, até 120 caracteres | Mostrado ao estudante. |
| `url` | sim | caminho começando com `/` | Abre a atividade no próprio GenieX. |
| `dueAt` | não | ISO 8601 com fuso (`-03:00` ou `Z`) ou `null` | Sem prazo, não há aviso de 24h. |
| `assignedAt` | recomendado | ISO 8601 com fuso | Na primeira vez que a Luumu vê o estudante, só o que foi liberado nas últimas 48h vira "Nova tarefa"; sem este campo, a primeira lista não gera avisos de novidade (evita encher o sino com tudo o que já existia). |
| `done` | não | `true` / `false` | Só se a lista incluir entregues. |
| `subject` | não | texto, até 60 caracteres | Matéria, se quiserem que apareça no texto ("Matemática · Frações e decimais"). |

### Por que `window.Luumu?.notifications?.setActivities?.(…)`

A chamada com `?.` não quebra nada se o SDK ainda não carregou ou se a função ainda não existir.
Com isso, o GenieX pode publicar o código **antes** de a Luumu liberar a funcionalidade: até lá a
chamada não faz nada, e depois começa a funcionar sozinha, sem novo deploy de vocês.

## 4. Liberar a Luumu na Content Security Policy (só se o GenieX usar CSP)

O sino é baixado sob demanda:

- `script-src`: `https://luumu.com.br` (`sdk.js` e `sdk-notifications.js`)
- `connect-src`: `https://luumu.com.br` (configuração e métricas)

Se o SDK já roda no GenieX (pesquisas, analytics, acessibilidade), provavelmente isso já está
liberado.

---

## Dados e privacidade

- As atividades ficam **no navegador do estudante**. Títulos, prazos e links não são enviados à
  Luumu.
- Para a Luumu vão só métricas de uso do sino (notificação recebida, vista, clicada), com o
  estudante representado por um código embaralhado (hash), nunca o id ou o e-mail.

## Como testar

1. Em homologação, confirmem que o domínio de homologação está na lista de domínios da chave do
   SDK (painel da Luumu → Configurações → SDK).
2. Logado como um estudante de teste, no console do navegador:
   - `document.getElementById("luumu-bell")` deve existir;
   - `Luumu.notifications.debug()` mostra a última lista recebida e as notificações calculadas
     (disponível quando a Luumu liberar a funcionalidade).
3. Atribuam uma tarefa ao estudante de teste com prazo para daqui a menos de 24h e recarreguem o
   app: devem aparecer "Nova tarefa" e "Falta 1 dia" no sino.
4. Entreguem a tarefa: o aviso de prazo some depois da próxima chamada de `setActivities`.

## Resumo do que o GenieX faz

- [ ] `Luumu.identify({ id, … })` em todas as telas logadas (provavelmente já existe) e
      `Luumu.reset()` no logout.
- [ ] `<div id="luumu-bell"></div>` no header do ambiente logado.
- [ ] `window.Luumu?.notifications?.setActivities?.([...])` no layout logado, com as atividades
      pendentes do estudante, sempre que a lista carregar ou mudar.
- [ ] (Se usar CSP) liberar `https://luumu.com.br` em `script-src` e `connect-src`.
