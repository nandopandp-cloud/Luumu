# Tours guiados da Luumu — guia de integração

Para o time técnico do produto onde os tours vão rodar. A criação dos tours é feita no
painel da Luumu, sem código; aqui está só o que o seu produto precisa ter.

## 1. Instalar o SDK (obrigatório)

O mesmo script das pesquisas. Se ele já está instalado, os tours já funcionam.

```html
<script src="https://luumu.com.br/sdk.js" data-luumu="SUA_CHAVE_PUBLICA"></script>
```

Ou, se preferir iniciar pelo código:

```html
<script src="https://luumu.com.br/sdk.js" data-luumu-auto="false"></script>
<script>
  Luumu.init({ publicKey: "SUA_CHAVE_PUBLICA" });
</script>
```

- Funciona em React, Next.js, Vue, Angular, SPAs e sites tradicionais: o SDK não depende do
  seu framework e percebe trocas de rota (`pushState`, `replaceState`, `popstate`) sozinho.
- O arquivo principal tem ~25 KB. O motor dos tours (~33 KB) só é baixado quando existe um
  tour para mostrar àquele usuário.
- Tudo o que a Luumu desenha fica num Shadow DOM: o seu CSS não afeta o tour, e o CSS do tour
  não afeta o seu produto. O SDK nunca altera os seus elementos.

**Content Security Policy.** Se o seu site usa CSP, libere o domínio da Luumu em `script-src`
(sdk.js, sdk-tours.js e sdk-builder.js) e em `connect-src` (chamadas à API).

## 2. Identificar o usuário (recomendado)

Habilita a segmentação ("só plano Pro", "só administradores") e faz a frequência valer por
usuário, e não só por navegador.

```js
Luumu.identify({
  id: user.id,
  email: user.email,
  name: user.name,
  role: "admin",     // qualquer atributo simples vira condição de segmentação
  plan: "pro",
  company: "Acme",
});
```

Chame após o login (ou ao restaurar a sessão). No logout: `Luumu.reset()`.

## 3. Marcar elementos importantes (opcional, recomendado)

O tour reencontra os elementos mesmo sem isso: combina texto, `aria-label`, link, estrutura e
outros sinais, e ignora classes geradas automaticamente. Para ter garantia total nos elementos
que aparecem nos tours, adicione um identificador estável:

```html
<button
  data-luumu-id="dashboard-create-project"
  data-luumu-name="Criar projeto"
  data-luumu-description="Cria um novo projeto"
>
  Criar projeto
</button>
```

- `data-luumu-id` tem prioridade absoluta na identificação. Use um nome que não mude entre
  deploys.
- `data-luumu-name` e `data-luumu-description` aparecem para quem monta o tour no painel.
- No painel, cada passo mostra a "estabilidade" do alvo. Quando ela está baixa, o painel
  sugere exatamente o `data-luumu-id` a adicionar.

## 4. Eventos e controle pelo código (opcional)

```js
// eventos de negócio: podem iniciar um tour ("Após um evento")
Luumu.track("project_created");

// controle direto
Luumu.tours.start("tur_xxxxxxxx");   // ex.: botão "Fazer o tour" no menu de ajuda
Luumu.tours.next();
Luumu.tours.previous();
Luumu.tours.skip();                  // pula o passo atual
Luumu.tours.complete();
Luumu.tours.stop();
Luumu.tours.isActive();              // true | false
Luumu.tours.getCurrentStep();        // { tourId, index, total, key } | null
```

O id do tour aparece em **Tours → (tour) → Público e gatilho**.

## 5. Como o administrador monta o tour

1. No painel: **Tours → Novo tour**.
2. **Editar no produto**: o seu produto abre numa nova aba, com uma barra da Luumu no topo. O
   administrador faz login normalmente; a Luumu usa a sessão dele.
3. Modo **Selecionar**: passa o mouse, clica no elemento, escreve a mensagem e clica em
   **Adicionar ao tour**. Modo **Navegar**: usa o produto normalmente para ir a outra tela.
4. De volta ao painel: reordena os passos, ajusta a posição para desktop, tablet e mobile, e
   abre o **Preview no produto**.
5. **Publicar**. A versão nova chega aos usuários em até 1 minuto.

O acesso de edição vale só para aquele tour, por algumas horas, e só no site que usa a chave do
mesmo projeto.

## 6. Privacidade e segurança

- O SDK lê rótulos (texto visível curto, `aria-label`, `placeholder`) para identificar
  elementos. Nunca lê o valor digitado nos campos e ignora campos de senha.
- Nenhum código vindo da configuração é executado. As ações de um passo são uma lista fixa:
  navegar para uma rota, abrir um link `http(s)` ou disparar um evento.
- Se um elemento não for encontrado, o passo é pulado (ou o tour é encerrado, conforme a
  configuração). O seu produto nunca recebe um erro da Luumu.
