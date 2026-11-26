# Avisos automáticos no GenieX: guia de integração (webhook por turma)

Para o time de engenharia da Jovens Gênios e para quem opera a Luumu. Este documento é o
contrato entre os dois lados. Ele explica como a funcionalidade funciona de ponta a ponta, o que
cada lado faz e como testar e colocar no ar.

> **Resumo em uma frase:** quando o GenieX libera, altera ou cancela uma Tarefa ou uma Prova
> Genial, o back-end avisa a Luumu com um POST assinado que inclui as turmas da atividade. O sino
> de cada estudante dessas turmas mostra "Nova tarefa" e, perto do prazo, "Falta 1 dia". O aviso
> some quando o estudante conclui a atividade.

---

## 1. O que o estudante vê

| Aviso | Quando aparece | Quando some |
|---|---|---|
| **Nova tarefa** / **Nova Prova Genial** | Assim que a atividade é liberada para uma turma do estudante. | Quando ele conclui a atividade, quando o prazo vence ou 7 dias depois da liberação. |
| **Falta 1 dia** | 24h antes do prazo. A antecedência é configurável no painel da Luumu: 12h, 24h ou 48h ("Faltam 12 horas", "Faltam 2 dias"). | Quando ele conclui a atividade ou quando o prazo vence. |
| **Recados** | São escritos pela equipe no painel da Luumu. Já funcionam hoje, sem nada do GenieX. | No fim definido no recado. |

Exemplo de texto no sino:

```
📋 Nova tarefa
   Matemática · Frações e decimais. Entrega até 03/12 às 23:59.
   Hoje às 10:02

⏳ Falta 1 dia
   Tarefa: Matemática · Frações e decimais. Entrega até amanhã às 23:59.
```

Clicar no aviso abre a atividade no próprio GenieX, pelo link que vocês mandarem.

As notificações só aparecem **dentro do produto**, com o estudante logado. Não há push no celular
nem e-mail.

---

## 2. Como funciona, de ponta a ponta

```
 BACK-END DO GENIEX                 LUUMU                                 NAVEGADOR DO ESTUDANTE
 ──────────────────                 ─────                                 ──────────────────────
 Professor libera a tarefa
   para as turmas 6A e 6B
        │
        │ POST /notifications/webhook
        │ (assinado com o segredo)
        └───────────────────────────▶ 1. confere a assinatura
                                      2. descarta envio repetido
                                      3. grava a atividade + turmas
                                         (uma linha por atividade)
                                                                         Luumu.identify({ id,
                                                                           class_ids: ["6A"] })
                                      GET /notifications/feed?c=6A  ◀────── 4. o sino pede a lista
                                      (cache na CDN por 2 min: a           da turma 6A
                                       turma toda lê a mesma cópia)  ──────▶ 5. o sino decide, para
                                                                              ESTE estudante:
                                                                              "Nova tarefa",
                                                                              "Falta 1 dia"…
                                                                           6. ele chega à tela de
                                                                              resultado → o aviso
                                                                              some
```

1. **O GenieX avisa.** O back-end manda um evento quando uma atividade é liberada
   (`activity.assigned`), alterada (`activity.updated`) ou cancelada (`activity.canceled`). O
   evento traz os dados da atividade e as turmas que a recebem. Não traz nenhum dado de estudante.
2. **A Luumu guarda a atividade.** É uma linha por atividade, com a lista de turmas.
3. **O sino busca a lista da turma.** A Luumu não envia nada para o estudante: é o sino que
   busca, como já acontece com os recados.
   - Ele sabe as turmas do estudante pelo `Luumu.identify` (`class_ids`).
   - Ele busca a lista de cada turma ao carregar, a cada 5 minutos com a aba visível e quando o
     estudante volta para a aba.
   - A lista fica em cache na CDN, então uma sala inteira lê a mesma cópia.
4. **O sino decide o que mostrar, no navegador.** Ele calcula o que é novo, se o prazo está perto
   e se o estudante já concluiu.
5. **A conclusão é detectada pela tela de resultado.** Quando o estudante chega a
   `/instituicao/assignments/<id>/complete` ou `/instituicao/avaliacoes/<id>/results`, a atividade
   sai do sino dele. O GenieX não precisa mandar nada para isso. É a mesma leitura de telas que o
   Analytics já faz ("Abriu / Iniciou / Concluiu").

### Quanto tempo leva

| Situação | Atraso até o aviso aparecer |
|---|---|
| Estudante que abre o GenieX depois da liberação | até ~2 minutos (cache da CDN) |
| Estudante que já está com o GenieX aberto | até ~7 minutos (cache + nova busca a cada 5 minutos) |
| Lembrete de prazo | na hora, porque é calculado no navegador a cada minuto |
| Ligar ou desligar os avisos no painel da Luumu | até ~20 minutos (cache da configuração do SDK) |

---

## 3. Quem faz o quê

### Jovens Gênios (engenharia do GenieX), cerca de 1 a 2 dias

**Back-end**

- [ ] Guardar o **segredo do webhook** no cofre de segredos do back-end. Ele é entregue pela
      Luumu por um canal seguro. Nunca o coloquem no front-end nem no repositório.
- [ ] Enviar **`activity.assigned`** quando uma Tarefa ou Prova Genial for liberada para uma ou
      mais turmas ([§4](#4-webhook-especificação)).
- [ ] Enviar **`activity.updated`** quando mudar o título, o prazo, o link ou as turmas.
- [ ] Enviar **`activity.canceled`** quando a atividade for cancelada, excluída ou despublicada.
- [ ] Assinar cada requisição ([§4.3](#43-assinatura)) e gerar um `id` único por evento.
- [ ] Tentar de novo em caso de falha (5xx, 429 ou rede), com espera crescente e **assinatura
      nova a cada tentativa** ([§4.6](#46-falhas-e-novas-tentativas)).
- [ ] Fazer a **carga inicial** no lançamento: um `activity.assigned` para cada atividade ainda em
      aberto ([§4.7](#47-carga-inicial)).

**Front-end**

- [ ] Incluir `class_ids` (todas as turmas do estudante) no `Luumu.identify`, que já existe
      ([§5.1](#51-identify-com-as-turmas)).
- [ ] Chamar `Luumu.reset()` no logout.
- [ ] Colocar `<div id="luumu-bell"></div>` no header do ambiente logado ([§5.2](#52-lugar-do-sino)).
- [ ] (Opcional) Chamar `Luumu.notifications.complete(id)` se alguma atividade puder ser concluída
      fora das telas de resultado ([§5.3](#53-conclusão)).
- [ ] (Se usarem CSP) liberar `https://luumu.com.br` em `script-src` e `connect-src`.

**Testes:** integrar primeiro em homologação e validar com a Luumu ([§7](#7-como-testar)).

### Luumu

- [x] Receber o webhook:
  - conferir a assinatura e a janela de 5 minutos;
  - descartar eventos repetidos pelo `id`;
  - respeitar a ordem dos eventos pelo `occurredAt`;
  - recusar dados inválidos dizendo o motivo.
- [x] Guardar as atividades e apagar sozinha o que encerrou ([§8](#8-dados-privacidade-e-retenção)).
- [x] Servir a lista de cada turma com cache na CDN.
- [x] Calcular no sino os avisos de "nova" e de prazo, detectar a conclusão e cuidar dos textos e
      dos ícones.
- [x] Registrar as métricas: recebido, visto e clicado, por atividade.
- [x] Oferecer no painel (Notificações → **Avisos automáticos**):
  - ligar e desligar os avisos e escolher a antecedência do prazo;
  - a URL do webhook;
  - o segredo, com troca sem parar o serviço;
  - "Ver como uma turma";
  - os últimos envios, com o erro de cada recusa;
  - as atividades recebidas, com as métricas.
- [ ] Gerar o segredo e entregá-lo à engenharia do GenieX.
- [ ] Acompanhar a homologação e o piloto, e ligar os avisos em produção.

---

## 4. Webhook: especificação

### 4.1 Endereço

```
POST https://luumu.com.br/api/v1/notifications/webhook?key=<chave pública do SDK>
Content-Type: application/json
X-Luumu-Timestamp: <segundos desde 1970, UTC>
X-Luumu-Signature: sha256=<assinatura>
```

- `key` é a mesma chave pública (`pk_...`) que o SDK já usa no GenieX. Ela diz de qual projeto é
  o envio.
- A URL completa, já com a chave, aparece em Notificações → Avisos automáticos → *Conexão com o
  produto*.
- Homologação e produção podem usar chaves diferentes, uma por projeto na Luumu. Cada projeto
  tem o próprio segredo.

### 4.2 Corpo

Cada evento é uma **fotografia completa** da atividade naquele momento, não uma lista de
diferenças. Pode ir um evento sozinho ou um lote:

```json
{
  "id": "evt_01JDX8K4R2",
  "event": "activity.assigned",
  "occurredAt": "2026-11-26T10:00:00-03:00",
  "activity": {
    "id": "t123",
    "type": "tarefa",
    "title": "Frações e decimais",
    "subject": "Matemática",
    "url": "/instituicao/assignments/t123",
    "assignedAt": "2026-11-26T10:00:00-03:00",
    "dueAt": "2026-12-03T23:59:00-03:00"
  },
  "classIds": ["6A-2026", "6B-2026"]
}
```

Lote, para a carga inicial ou para reenviar uma fila: `{ "events": [ {…}, {…} ] }`, com 1 a 100
eventos e até 512 KB.

| Campo | Obrigatório | Formato | Observação |
|---|---|---|---|
| `id` | sim | texto, até 100 caracteres | **Único por evento.** O mesmo envio repetido (nova tentativa) usa o **mesmo** `id`: a Luumu ignora o repetido. |
| `event` | sim | `activity.assigned`, `activity.updated` ou `activity.canceled` | Ver [§4.4](#44-os-três-eventos). |
| `occurredAt` | sim | ISO 8601 **com fuso** (`-03:00` ou `Z`) | Quando a mudança aconteceu no GenieX. Define a ordem ([§4.5](#45-ordem-e-repetição)). |
| `activity.id` | sim | texto, até 100 caracteres | Id estável da atividade no GenieX. Deve ser o mesmo id que aparece na URL dela. |
| `activity.type` | sim* | `"tarefa"` ou `"prova_genial"` | Define o ícone e o texto ("Nova tarefa" ou "Nova Prova Genial"). |
| `activity.title` | sim* | texto, até 120 caracteres | Mostrado ao estudante. **Sem dados pessoais** ([§8](#8-dados-privacidade-e-retenção)). |
| `activity.subject` | não | texto, até 60 caracteres | Matéria, mostrada antes do título ("Matemática · Frações…"). |
| `activity.url` | sim* | caminho começando com `/` (ou `https://…`) | Página que abre a atividade. Use a página da atividade (ex.: `/instituicao/assignments/t123`): é por ela que a Luumu reconhece a conclusão. |
| `activity.assignedAt` | não | ISO 8601 com fuso | Quando a atividade fica disponível para os estudantes. Sem ele, vale o `occurredAt`. Se for no futuro (liberação agendada), o aviso aparece só nessa hora. |
| `activity.dueAt` | não | ISO 8601 com fuso, ou `null` | Prazo. Sem prazo, não há lembrete. |
| `classIds` | sim* | lista de textos, até 500 turmas, até 100 caracteres cada | Turmas que recebem a atividade. **Os mesmos ids que o front-end manda em `class_ids`**, caractere por caractere. |

\* Obrigatório em `activity.assigned` e `activity.updated`. Em `activity.canceled` bastam `id`,
`event`, `occurredAt` e `activity.id`.

### 4.3 Assinatura

A assinatura prova que o envio veio do back-end do GenieX e que ninguém alterou o conteúdo no
caminho. É o mesmo formato que a Luumu usa nos webhooks que ela própria envia.

```
X-Luumu-Timestamp: 1764162000
X-Luumu-Signature: sha256=<hex de HMAC-SHA256(segredo, "1764162000." + corpo)>
```

- O **corpo** entra exatamente como vai na requisição: os mesmos bytes, sem reformatar o JSON.
  Serialize uma vez, assine essa string e envie essa mesma string.
- O timestamp vale por **5 minutos**. Um relógio errado no servidor causa `401`, então mantenham o
  NTP ativo.
- Numa nova tentativa, gerem **timestamp e assinatura novos**. O `id` do evento continua o mesmo.

**Node.js**

```js
import crypto from "node:crypto";

const URL = process.env.LUUMU_WEBHOOK_URL;       // https://luumu.com.br/api/v1/notifications/webhook?key=pk_...
const SECRET = process.env.LUUMU_WEBHOOK_SECRET; // whsec_...

export async function sendToLuumu(payload) {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const signature = "sha256=" + crypto.createHmac("sha256", SECRET).update(`${ts}.${body}`).digest("hex");
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Luumu-Timestamp": String(ts), "X-Luumu-Signature": signature },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
```

**Python**

```python
import hashlib, hmac, json, os, time, requests

URL = os.environ["LUUMU_WEBHOOK_URL"]
SECRET = os.environ["LUUMU_WEBHOOK_SECRET"].encode()

def send_to_luumu(payload: dict):
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    ts = str(int(time.time()))
    sig = hmac.new(SECRET, f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()
    r = requests.post(URL, data=body.encode(), timeout=10, headers={
        "Content-Type": "application/json",
        "X-Luumu-Timestamp": ts,
        "X-Luumu-Signature": f"sha256={sig}",
    })
    return r.status_code, r.json() if r.content else None
```

**PHP**

```php
$body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$ts = (string) time();
$sig = 'sha256=' . hash_hmac('sha256', $ts . '.' . $body, getenv('LUUMU_WEBHOOK_SECRET'));
// POST $body para getenv('LUUMU_WEBHOOK_URL') com os cabeçalhos
// Content-Type: application/json, X-Luumu-Timestamp: $ts, X-Luumu-Signature: $sig
```

### 4.4 Os três eventos

| Evento | Quando mandar | O que a Luumu faz |
|---|---|---|
| `activity.assigned` | A atividade foi liberada para uma ou mais turmas. `classIds` não pode ser vazio. | Grava a atividade. Os estudantes das turmas passam a ver "Nova tarefa" ou "Nova Prova Genial". |
| `activity.updated` | Mudou o título, o prazo, o link ou as turmas. Mande a fotografia **completa**, com a lista **inteira** de turmas. | Substitui tudo o que tinha. Turma que saiu da lista deixa de ver a atividade. Turma nova vê como nova. Prazo novo reprograma o lembrete. |
| `activity.canceled` | Cancelada, excluída ou despublicada. | A atividade some do sino de todos. |

Situações comuns:

- **Liberar para mais uma turma:** `activity.updated` com a lista completa (`["6A", "6B", "6C"]`).
  Só a 6C recebe "Nova tarefa".
- **Adiar o prazo:** `activity.updated` com o `dueAt` novo. Quem já tinha visto o lembrete antigo
  recebe um lembrete novo perto do novo prazo.
- **Reabrir uma atividade cancelada:** `activity.updated` (ou `activity.assigned`) com
  `occurredAt` mais recente que o do cancelamento.
- **Não sabem se a Luumu já conhece a atividade:** podem mandar `activity.updated` mesmo assim. A
  Luumu cria a atividade se ela não existir.

### 4.5 Ordem e repetição

- **Repetição:** o mesmo `id` de evento enviado de novo responde `"duplicate"` e não muda nada.
  Por isso a nova tentativa deve usar o mesmo `id`.
- **Ordem:** a Luumu guarda o `occurredAt` do último evento aplicado a cada atividade. Um evento
  com `occurredAt` **mais antigo** que chegue depois, por exemplo numa fila atrasada, responde
  `"stale"` e é ignorado. Um cancelamento não é desfeito por um `assigned` atrasado.
- Usem no `occurredAt` a hora real da mudança no GenieX, e não a hora do envio.

### 4.6 Falhas e novas tentativas

| Resposta | Significado | O que fazer |
|---|---|---|
| `200` | Todos os eventos aceitos. Em `results`, cada um vem como `applied`, `stale` ou `duplicate`. | Nada. |
| `422` | Algum evento recusado. `results` diz qual e por quê. **Os outros eventos do lote foram aplicados.** | Corrigir o dado e mandar **só** o evento recusado, com um `id` novo. Não repetir o lote. |
| `400` | JSON inválido. | Corrigir a serialização. |
| `401` | Chave inválida, segredo ainda não gerado, assinatura errada ou timestamp fora dos 5 minutos. A mensagem diz qual. | Conferir a chave, o segredo, o corpo assinado e o relógio. |
| `413` | Corpo acima de 512 KB. | Lotes menores. |
| `429` | Mais de 600 requisições por minuto no projeto. | Tentar de novo depois. |
| `5xx` ou sem resposta | Problema do lado da Luumu ou da rede. | **Tentar de novo.** |

Exemplo de resposta:

```json
{ "ok": false, "results": [
  { "id": "evt_1", "status": "applied" },
  { "id": "evt_2", "status": "invalid", "error": "\"activity.title\" é obrigatório." }
] }
```

**Novas tentativas.** Só para 5xx, 429 e falha de rede. Sugestão: 5 tentativas ao longo de ~2
horas, por exemplo depois de 1 min, 5 min, 15 min, 30 min e 1 h. Usem uma fila, como o worker
que vocês já tenham, para não segurar a requisição do professor.

- Sempre com o **mesmo `id`**.
- Sempre com **timestamp e assinatura novos**.

Esgotadas as tentativas, registrem no log de vocês. O evento pode ser reenviado depois sem risco.
**4xx não se resolve tentando de novo:** é erro de integração, e aparece no painel da Luumu em
*Últimos envios*.

### 4.7 Carga inicial

No dia de ligar, o sino precisa conhecer as atividades que já estão em aberto. Mandem um
`activity.assigned` para cada atividade **ainda em aberto**, ou seja, liberada e com prazo no
futuro (ou sem prazo, liberada nos últimos 30 dias):

- com o `assignedAt` **real**, isto é, a data em que foi liberada. Isso é importante porque a
  Luumu só trata como "nova" o que foi liberado nos últimos 7 dias, e no primeiro acesso de cada
  estudante só acende o sino com o que foi liberado nas últimas 48h. Assim ninguém recebe uma
  enxurrada de "novas" no primeiro dia;
- em lotes de até 100 eventos (`{ "events": [...] }`), respeitando as 600 requisições por minuto.
  Na prática, um lote a cada ~200 ms já fica bem abaixo do limite;
- com `id` de evento estável, por exemplo `backfill-<id da atividade>`. Assim rodar a carga duas
  vezes não duplica nada.

---

## 5. Front-end do GenieX

### 5.1 Identify com as turmas

O sino só funciona para estudante identificado e só mostra atividades das turmas informadas:

```js
// depois do login E ao reabrir o app com a sessão já ativa
Luumu.identify({
  id: String(estudante.id),                 // obrigatório: o mesmo id em todos os aparelhos
  email: estudante.email,                   // opcional
  name: estudante.nome,                     // opcional
  school_year: estudante.anoEscolar,        // opcional (segmenta recados)
  class_ids: estudante.turmas.map((t) => String(t.id)), // NOVO: todas as turmas do estudante
});

// no logout
Luumu.reset();
```

- **`class_ids` precisa usar os mesmos ids que o back-end manda em `classIds`**, caractere por
  caractere: `"6A-2026"` e `"6a-2026"` são turmas diferentes.
- Usem ids opacos, como o id da turma no banco, e não nomes com pessoas ("Turma do Prof. João").
- A Luumu usa até **10 turmas** por estudante.
- Se o estudante mudar de turma no meio da sessão, chamem o `identify` de novo com a lista nova.
  O sino troca na hora.
- No logout, `Luumu.reset()` tira o sino da tela. Num computador compartilhado da escola, o
  próximo estudante vê só as atividades e as conclusões dele: tudo é guardado por estudante.

### 5.2 Lugar do sino

No header do ambiente logado, onde o sino deve ficar (sugestão: junto dos ícones à direita, antes
do avatar):

```html
<div id="luumu-bell"></div>
```

- O elemento entra só nas telas logadas e fica vazio: a Luumu coloca o sino dentro dele (38×38 px,
  na cor do texto do header).
- O sino fica num Shadow DOM, então o CSS do GenieX não afeta o sino e vice-versa. Se o header for
  remontado numa troca de rota, o sino volta sozinho.
- Com SSR ou hidratação (Next.js e similares), use `<div id="luumu-bell" suppressHydrationWarning />`.

### 5.3 Conclusão

A atividade sai do sino do estudante quando ele chega à tela de resultado **dentro do link** da
atividade:

| Tipo | Link enviado (`activity.url`) | Tela que conta como concluída |
|---|---|---|
| Tarefa | `/instituicao/assignments/t123` | `/instituicao/assignments/t123/complete` |
| Prova Genial | `/instituicao/avaliacoes/p45` | `/instituicao/avaliacoes/p45/results` |

As variantes em inglês (`/institutions/assignments/…`, `/institutions/summative-assessments/…`)
também contam. Elas são as mesmas rotas que o Analytics da Luumu reconhece.

Se existir outro caminho de entrega, por exemplo um app ou uma tela diferente, avisem a Luumu do
lado do navegador:

```js
window.Luumu?.notifications?.complete?.("t123"); // id da atividade, o mesmo do webhook
```

A chamada com `?.` não quebra nada se o SDK ainda não carregou.

**Limitação desta versão:** a conclusão é guardada no navegador. Se o estudante concluir no
celular, o computador da escola ainda mostra o aviso até o prazo vencer ou ele abrir a tela de
resultado ali.

### 5.4 Content Security Policy (só se o GenieX usar CSP)

- `script-src`: `https://luumu.com.br` (`sdk.js`, `sdk-notifications.js`)
- `connect-src`: `https://luumu.com.br` (configuração, lista da turma e métricas)

Se o SDK já roda no GenieX, provavelmente isso já está liberado.

---

## 6. Painel da Luumu (Notificações → Avisos automáticos)

| Parte | Para que serve | Quem usa |
|---|---|---|
| **Avisos automáticos de atividades** | Ligar e desligar, avisar novas, escolher a antecedência do prazo (não avisar, 12h, 24h ou 48h). | Editores e administradores |
| **Conexão com o produto** | URL do webhook (com a chave), atividades em aberto, eventos aceitos e recusados nas últimas 24h. | Todos |
| **Segredo de assinatura** | Gerar, mostrar e copiar. **Trocar** gera outro e mantém o anterior válido por 24h, para o GenieX atualizar sem perder envios. | Donos e administradores |
| **Ver como uma turma** | Digite o id de uma turma e veja o que o sino dos estudantes dela recebe agora. | Todos |
| **Últimos envios** | Os 30 eventos mais recentes, com o resultado (Aplicado, Ignorado (mais antigo), Recusado, Assinatura inválida) e o motivo da recusa. Repetidos só aparecem na resposta (`duplicate`), não no registro. | Todos |
| **Atividades recebidas** | As 50 mais recentes, com turmas, prazo, situação (aberta, encerrada, cancelada) e métricas de cada aviso: recebidos · vistos · cliques. | Todos |

O sino precisa estar ligado na aba **Sino e instalação**, na plataforma certa (ex.:
`preparasp.jovensgenios.com`). Sem ele, os avisos não aparecem, mesmo ligados.

---

## 7. Como testar

### 7.1 Em homologação

1. **Luumu:**
   - confirmar que o domínio de homologação está na lista de domínios da chave do SDK
     (Configurações → SDK & Eventos);
   - gerar o segredo e entregá-lo ao GenieX;
   - ligar o sino e os avisos automáticos no projeto de homologação.
2. **GenieX (back-end):** liberar uma tarefa de teste para uma turma de teste, com prazo para
   daqui a menos de 24h.
   - No painel da Luumu, *Últimos envios* deve mostrar **Aplicado**.
   - *Ver como uma turma* com o id da turma deve listar a tarefa.
3. **GenieX (front-end):** entrar como um estudante dessa turma.
   - O sino mostra **Nova tarefa** e **Falta 1 dia**, em até ~2 minutos.
   - No console do navegador, `Luumu.notifications.debug()` mostra as turmas recebidas no
     identify, as atividades de cada turma e os avisos calculados.
4. **Conclusão:** fazer a tarefa até `/complete`. Os dois avisos saem do sino.
5. **Alteração:** mudar o prazo da tarefa. *Últimos envios* mostra o `activity.updated` aplicado,
   e o lembrete segue o prazo novo.
6. **Cancelamento:** cancelar a tarefa. Ela some do sino e aparece como "cancelada" em
   *Atividades recebidas*.
7. **Falhas:**
   - mandar uma assinatura errada: deve voltar `401`, e o painel mostra "Assinatura inválida";
   - mandar o mesmo evento duas vezes: o segundo volta `"duplicate"`.

### 7.2 Checklist de aceite

- [ ] Liberar, alterar e cancelar geram eventos aplicados, conforme *Últimos envios*.
- [ ] Os ids de `classIds` (back-end) e de `class_ids` (front-end) batem, conforme
      `Luumu.notifications.debug()`.
- [ ] Estudante de outra turma não vê a atividade.
- [ ] Concluir tira o aviso. Prazo vencido tira o aviso.
- [ ] Logout e login de outro estudante no mesmo computador mostra só as atividades dele.
- [ ] Nova tentativa depois de uma falha simulada não duplica, e o evento volta como `duplicate`.
- [ ] A carga inicial rodou e *Ver como uma turma* mostra as atividades em aberto.

### 7.3 Implantação

1. Homologação completa, com o checklist acima.
2. Produção com os avisos **desligados** no painel: rodar a carga inicial e confirmar no painel
   que as atividades chegaram.
3. **Piloto:** uma escola por ~1 semana, acompanhando as métricas e os envios recusados.
   - Hoje o liga/desliga vale para o projeto inteiro. Para o piloto, a forma mais simples é
     publicar o `class_ids` do identify só para os estudantes da escola piloto: sem turmas, o
     sino não busca atividades.
4. Liberar para todas as escolas, incluindo o `class_ids` para todos os estudantes.

---

## 8. Dados, privacidade e retenção

- **Nenhum dado de estudante vai para a Luumu pelo webhook.** Vão só os dados da atividade e os
  ids das turmas.
- A lista da turma é pública para quem tiver a chave pública do SDK e o id da turma, como
  qualquer conteúdo que o SDK lê. Por isso, **o título não deve ter dados pessoais**, e os ids de
  turma devem ser opacos.
- O que fica no navegador do estudante: quais avisos ele já leu e quais atividades concluiu.
- O que vai para a Luumu sobre o uso: só contadores por atividade e dia (recebido, visto,
  clicado). Não há linha por estudante. Os recados continuam com o hash do estudante, nunca o id
  ou o e-mail.
- Retenção, com limpeza automática diária:
  - atividade com prazo vencido ou cancelada: apagada 30 dias depois, junto com as métricas;
  - atividade sem prazo: apagada 60 dias depois da liberação (sai do sino com 30 dias);
  - registro de envios: 30 dias.

## 9. Limites desta versão

- **Atividade para alunos específicos**, e não para a turma toda, não é coberta. Se for comum,
  dá para adicionar depois uma lista de alunos só para esses casos.
- **A conclusão não sincroniza entre aparelhos** ([§5.3](#53-conclusão)). Se fizer falta, a
  próxima etapa é um evento `activity.completed` por estudante.
- Sem push no celular e sem e-mail: é uma decisão de produto.

## 10. Perguntas frequentes

**O que acontece se a Luumu ficar fora do ar?** O webhook falha com 5xx ou por rede, e a fila de
vocês tenta de novo. Nada se perde se as novas tentativas cobrirem a queda. O GenieX continua
funcionando normalmente: o sino só não aparece.

**E se o GenieX mandar o evento antes de ligarmos os avisos?** A Luumu aceita e guarda. Quando os
avisos forem ligados, o sino já mostra as atividades.

**Uma turma com 40 estudantes faz 40 requisições ao servidor?** Não. A lista da turma fica em
cache na CDN, então a turma inteira lê a mesma cópia. O servidor da Luumu é consultado no máximo
uma vez a cada 2 minutos por turma.

**Posso mandar `activity.updated` para tudo, em vez de `assigned`?** Pode. A diferença é que
`assigned` exige pelo menos uma turma. Os dois gravam a fotografia completa.

**O `id` do evento pode ser o id da atividade?** Não: cada mudança precisa de um `id` novo, senão
a segunda mudança é tomada por repetição. Use, por exemplo, `<id da atividade>-<versão>` ou um
UUID gravado junto com o evento na fila.
