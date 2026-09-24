# GPEL — aplicativo de produção e estoque

Aplicativo web que substitui a interface do AppSheet, mantendo o **Google Sheets como banco de dados**.

- **Frontend:** HTML, CSS e JavaScript puro (sem React/Vue/Angular, sem build).
- **Backend:** Google Apps Script publicado como Web App, lendo e gravando nas abas da planilha.
- **Uso:** pensado primeiro para o celular; no computador, as listas viram tabelas com filtros.

```
apps-script/   → backend (colar no editor de Apps Script da planilha)
web/           → aplicativo (abrir index.html; pode ir para o GitHub Pages)
testes/        → testes das regras e da interface (rodam no computador)
```

---

## 1. Antes de começar

Duas informações são necessárias:

1. **ID da planilha do Google Sheets** (o trecho do meio da URL:
   `docs.google.com/spreadsheets/d/`**`ESTE_PEDAÇO`**`/edit`).
2. **URL do Apps Script publicado**, se já existir uma.

Se o Apps Script for criado a partir da própria planilha (Extensões → Apps Script), o ID é
opcional: o script usa a planilha em que está. Se for um projeto separado, preencha
`ID_PLANILHA` no arquivo `apps-script/Config.gs`.

## 2. Instalar o backend

1. Abra a planilha da GPEL → **Extensões → Apps Script**.
2. Crie um arquivo para cada `.gs` da pasta `apps-script/` e cole o conteúdo
   (`Config.gs`, `Planilha.gs`, `Regras.gs`, `Acesso.gs`, `Estoque.gs`, `Automacoes.gs`,
   `Pagina.gs`, `Codigo.gs`).
3. Crie um arquivo **HTML** chamado `Interface` e cole o conteúdo de
   `apps-script/Interface.html` (é o aplicativo inteiro num arquivo só — veja a seção
   *Publicar uma versão nova*). O nome `Interface` é reservado para esse HTML: o script que
   o entrega se chama `Pagina.gs` justamente porque o Apps Script não aceita dois arquivos
   com o mesmo nome.
4. Em `Config.gs`, preencha `ID_PLANILHA` se necessário e escreva os e-mails autorizados em
   `USUARIOS_AUTORIZADOS`.
5. Execute uma vez a função **`instalarPlanilha`** e autorize o acesso. Ela cria as abas
   que faltarem e acerta os cabeçalhos — **não apaga nada do que já existe**.
6. **Implantar → Nova implantação → Aplicativo da Web**, com as opções da seção
   *Quem pode entrar* logo abaixo.
7. Copie a URL gerada (termina em `/exec`). É por ela que a usuária abre o aplicativo.

> Sempre que alterar o código, faça **Implantar → Gerenciar implantações → editar → Nova versão**,
> senão a URL continua servindo a versão antiga.

## 3. Quem pode entrar

O aplicativo tem duas formas de ser entregue, e elas mudam o que é possível em segurança.
Não dá para ter as duas ao mesmo tempo: **um Web App que exige login não responde a
chamadas vindas de outro site.**

| | Servido pelo Apps Script | Hospedado fora (Pages/Cloudflare) |
|---|---|---|
| Publicação | Qualquer pessoa **com Conta do Google** | Qualquer pessoa (**anônimo**) |
| Quem entra | Só os e-mails de `USUARIOS_AUTORIZADOS` | Quem tiver o link (e a senha, se houver) |
| Se o link vazar | Nada acontece: sem login, não passa | Problema: o link é a chave |
| Endereço | URL do Google (`.../exec`) | Seu domínio |

### Configuração recomendada (login do Google)

Na publicação do Web App:

- *Executar como:* **Usuário que acessa o aplicativo da Web**
- *Quem pode acessar:* **Qualquer pessoa com Conta do Google**

E então:

1. Em `Config.gs`, escreva os e-mails autorizados:
   ```js
   var USUARIOS_AUTORIZADOS = [
     'empresaria@gmail.com',
     'voce@gmail.com'
   ];
   ```
2. **Compartilhe a planilha** com cada um desses e-mails como **Editor**. Com "executar como
   usuário que acessa", cada pessoa lê e grava com a permissão dela — quem não tem acesso à
   planilha não consegue usar o aplicativo nem por acidente.
3. Mande para a usuária a URL que termina em `/exec`. No celular: abrir no Chrome →
   menu → *Adicionar à tela inicial*.

Quem abrir com outra conta vê uma tela dizendo que aquele e-mail não tem acesso, e
**nenhum dado é devolvido** — a checagem acontece no servidor, em toda leitura e toda
gravação, não só na tela.

Para incluir ou tirar alguém: edite a lista, compartilhe (ou tire) o acesso à planilha e
publique uma versão nova. Nada mais muda.

### Por que o `Responsável` fica mais confiável

Com login, quem assina a movimentação é a conta que entrou, não o nome digitado. O campo
`Responsável` em branco é preenchido sozinho com o usuário da vez.

### Senha (`TOKEN_ACESSO`)

Continua existindo e funciona junto com o login. Ela é a única proteção possível quando o
aplicativo está hospedado fora do Google — nesse caso, use também um repositório privado,
já que a URL do Web App fica no código.

## 4. Abrir o aplicativo

**Servido pelo Apps Script (recomendado):** basta abrir a URL que termina em `/exec`. Não há
endereço nem senha para configurar — o aplicativo reconhece a conta que fez login.

**Hospedado fora:** abra `web/index.html` (no navegador, num servidor simples, no GitHub Pages
ou no Cloudflare), vá em **Configurações**, cole a URL do Web App e toque em **Testar conexão**.

Para já entregar o aplicativo configurado para todo mundo, preencha `URL_API_PADRAO`
em `web/js/config.js`.

### Onde hospedar

O site tem 172 KB em 20 arquivos: qualquer hospedagem estática dá conta.

**GitHub Pages:** Settings → Pages → Branch, pasta `/root`; o endereço fica
`https://<usuario>.github.io/gpel-app/web/`.

**Cloudflare Pages** (pelo painel, conectado ao GitHub):

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** →
   aba **Pages** → **Connect to Git**.
2. Autorize o GitHub e escolha o repositório `gpel-app`.
3. Configure assim:
   - *Production branch:* a branch onde está o código (ex.: `main`).
   - *Framework preset:* **None**.
   - *Build command:* **deixe vazio** (não existe build neste projeto).
   - *Build output directory:* **`web`** ← é o único campo que costuma ser preenchido errado.
4. **Save and Deploy**. Em cerca de um minuto sai um endereço
   `https://gpel-app.pages.dev`. Cada push na branch de produção republica sozinho.
5. Domínio próprio (opcional): aba **Custom domains** → **Set up a domain**.

**Cloudflare Pages pela linha de comando**, sem conectar o GitHub:

```bash
npx wrangler pages deploy web --project-name=gpel-app
```

O arquivo `web/_headers` já vai com as regras de cache (HTML sempre revalidado, CSS e JS com
cache curto). Como os arquivos não têm versão no nome, cache longo faria a usuária continuar
vendo a versão antiga depois de uma correção.

> **Importante:** trocar de hospedagem não muda o tempo de resposta do Apps Script.
> Se o aplicativo estiver demorando para mostrar os dados, o problema está na planilha,
> não no site — veja a seção *Se estiver lento*.

## 5. Antes de usar com dados de verdade

- **Tire as fórmulas das colunas calculadas da planilha.** Quem calcula agora é o código
  (`apps-script/Regras.gs` e `Estoque.gs`). Manter fórmula na planilha *e* cálculo no código
  cria duas versões da mesma regra — é a receita de número divergente.
  Colunas calculadas: `Valor Total` (PEDIDOS e COMPRAS), `Prod./h`, `Prod./HH`,
  `Qtd. Assinada`, `Saldo Sistema`, `Diferença`, `Ajuste?` e toda a aba `ESTOQUE_ATUAL`.
- Confira se cada produto e insumo tem **Unidade** preenchida: é ela que aparece
  automaticamente nos pedidos, na produção e nas movimentações.

**Sobre o formato das abas.** Não é preciso arrumar a planilha para o aplicativo: ele procura
o cabeçalho nas primeiras linhas de cada aba, então faixas de título e linhas em branco no
topo não atrapalham. Os nomes das colunas também não precisam ser idênticos — acento,
pontuação e maiúsculas são ignorados, e os nomes equivalentes ficam em `SINONIMOS`
(`Config.gs`): é lá que está escrito, por exemplo, que `Unid. Estoque` é a coluna de unidade.
Colunas próprias da planilha (`Categoria`, `Ativo?`, `Observações`…) são preservadas.

Nomes compostos também são entendidos: `Cliente / Razão Social` é reconhecida como a coluna
`Razão Social`. Isso vale para nomes longos o bastante para não haver confusão — `Data` nunca
captura `Data de Entrega`, por exemplo.

Se um item da planilha aparecer no aplicativo com todos os campos vazios ("—"), execute
`diagnosticarPlanilha` pelo editor do Apps Script: o relatório mostra, para cada aba, a linha
do cabeçalho, as colunas reconhecidas e as que faltaram.

---

### Dados de teste

Para ver o aplicativo com movimento antes de lançar dados reais, execute
**`carregarDadosDeTeste`** pelo editor do Apps Script. Ele monta cerca de 40 dias de operação:
13 pedidos em todas as situações (dois atrasados), 10 produções, 10 compras, entregas, uma
perda, estoque de abertura por inventário e uma contagem aguardando aprovação.

Tudo passa pelas mesmas funções do aplicativo — cada entrada e saída vira linha em
`MOV_ESTOQUE`, nada é escrito direto no saldo. Produtos e insumos que já existem são
reaproveitados; clientes e fornecedores de teste levam "(TESTE)" no nome.

**`apagarDadosDeTeste`** remove exatamente o que a carga criou (os IDs ficam anotados nas
propriedades do script). Dados reais, inclusive os lançados depois da carga, não são tocados.
Rode a limpeza antes de começar a usar de verdade.

## 6. Como o sistema funciona

### Saldo de estoque

`MOV_ESTOQUE` é o livro-razão e a única fonte de verdade.
`ESTOQUE_ATUAL` é recalculado a partir dele (entradas − saídas) e regravado com valores.
O único campo digitado nessa aba é **Estoque Mín.**, que é preservado no recálculo.

Saldo **nunca** é digitado, e movimentação **nunca** é apagada: correção é sempre uma nova
movimentação. Por isso a tela de movimentações não tem editar nem excluir.

### Compra → entrada no estoque (automação ativa)

Ao **criar** uma compra, o sistema gera uma entrada em `MOV_ESTOQUE`
(Origem = `Compra`, Documento = NF, observação `Entrada automática - Compra / NF: ...`).

A compra guarda o ID dessa movimentação na coluna técnica **`Mov. Gerado`**. É esse controle
que garante **uma compra = uma entrada**: editar a compra depois não gera outra entrada.
Se a quantidade da compra estiver errada no estoque, o caminho é registrar uma movimentação
de correção — assim o histórico continua explicando o saldo.

### Inventário → ajuste (com aprovação)

Salvar uma contagem **não muda o saldo**, mesmo havendo diferença. É preciso abrir a contagem
e tocar em **Aprovar ajuste**. A aprovação:

1. recalcula a diferença contra o saldo do momento (a contagem pode ser de ontem);
2. gera uma movimentação `Inventário +` ou `Inventário -` com `Documento Ref.` = ID do inventário;
3. recalcula o estoque.

Aprovar duas vezes é recusado — a própria movimentação já gerada serve de trava.

### Saídas do dia a dia (como lançar hoje)

Enquanto as automações abaixo não estiverem ligadas, **marcar um pedido como Entregue ou uma
produção como Concluída não mexe no estoque**. A saída da entrega, a entrada da produção e o
consumo de bobina são lançados em **Estoque → Movimentar**, informando o pedido ou a produção
em *Documento*. É assim que a carga de teste faz, e é o que mantém o histórico explicando o
saldo.

O aplicativo aceita saída maior que o saldo — o saldo fica negativo. É proposital: o físico
existe, faltou lançar a entrada. Saldo negativo na conferência é sinal de entrada esquecida.

### Automações previstas (ainda não ligadas)

Produção concluída → entrada de produto acabado; consumo de matéria-prima → saída;
entrega confirmada → saída e atualização do pedido. O caminho está documentado em
`apps-script/Automacoes.gs`, com a função de idempotência pronta (`movimentoPorDocumento_`).
Não foram ligadas porque dependem de apontamento confiável, conforme combinado no projeto.

---

## 7. Se estiver lento

O aplicativo tem duas partes bem diferentes, e só uma costuma ser o problema:

| Parte | Peso | Sinal |
|---|---|---|
| Site (HTML/CSS/JS) | 172 KB, uma vez só | Se a tela aparece rápido, está tudo bem aqui |
| `?action=tudo` (Apps Script) | Onde a demora acontece | A tela abre mas os dados demoram |

**Como saber onde está o tempo.** Toda resposta traz o campo `ms`: é o tempo gasto *dentro*
do Apps Script. Abra a URL do Web App com `?action=tudo` no navegador e olhe o final do JSON.

- `ms` alto (vários segundos) → é a planilha. Veja abaixo.
- `ms` baixo mas a requisição demora → é a partida do script (o Apps Script "dorme" quando
  fica sem uso) mais os dois saltos de rede: o `/exec` responde 302 e o conteúdo vem de
  `script.googleusercontent.com`. Isso é do Google e não tem como remover.

**O que já foi feito para acelerar:**

- Abrir o aplicativo **não escreve mais na planilha**. Antes, cada abertura regravava a aba
  `ESTOQUE_ATUAL` inteira só para mostrar o saldo — e escrever no Sheets custa segundos.
  Agora a leitura só calcula; a gravação acontece quando o saldo muda.
- Cada aba é lida **uma vez por requisição**, com cabeçalho e dados na mesma ida.
  Antes a mesma aba era lida várias vezes (cada validação relia os cadastros inteiros).
- Resultado medido numa carga com 30 pedidos e 30 compras:
  **de 42 leituras e 2 escritas para 3 leituras e nenhuma escrita.**
- O aplicativo guarda a última carga no próprio aparelho: da segunda vez em diante ele
  **abre na hora** com os dados de antes e atualiza por trás, sem tela de espera.

**Se ainda estiver lento** (planilha com muito histórico):

1. Arquive o que é antigo: `MOV_ESTOQUE` e `VENDAS_HISTORICO` são as abas que crescem.
   O aplicativo já traz só as últimas 500 movimentações, mas a leitura passa pela aba inteira.
2. Apague abas e colunas vazias sobrando — o Sheets lê até a última célula usada.
3. Confira se sobrou fórmula nas colunas calculadas: cada fórmula é recalculada a cada
   gravação do script.

## 8. Publicar uma versão nova

O aplicativo mora em `web/` (vários arquivos). O Apps Script serve **uma página só**, então
existe um empacotador que junta tudo num arquivo:

```bash
node ferramentas/empacotar.js     # gera apps-script/Interface.html
```

`Interface.html` é gerado — não edite por lá, senão a mudança se perde na próxima geração.
`npm test` avisa se ele estiver atrasado em relação a `web/`.

### Marca de versão (arquivos da mesma entrega)

Cada `.gs` traz na primeira linha uma marca tirada do próprio conteúdo, e o `Versoes.gs`
(gerado) diz quais marcas formam uma entrega completa. Se um arquivo colado no editor for de
outra entrega, **o servidor recusa trabalhar e diz qual arquivo está desatualizado** — em vez
de quebrar no meio de uma gravação. Arquivo que não mudou mantém a marca, então o empacotador
lista exatamente o que precisa ser colado:

```
Marcas de versão atualizadas. Arquivos para colar no Apps Script: Estoque.gs, Versoes.gs
```

Cole sempre o `Versoes.gs` junto com os arquivos listados. As marcas são gravadas pelo
empacotador: não edite a primeira linha dos `.gs` nem o `Versoes.gs` na mão.

A partir daí há dois caminhos para levar isso até o Google.

### Caminho curto: um comando (clasp)

O `clasp` é a ferramenta oficial do Google para enviar código ao Apps Script. Configura-se
uma vez:

```bash
npx --yes @google/clasp login      # abre o navegador e entra na sua conta Google
```

Pegue o ID do projeto em **Apps Script → Configurações do projeto → ID do script**, copie
`.clasp.json.exemplo` para `.clasp.json` e cole o ID ali. Daí em diante:

```bash
npm run publicar                   # empacota e envia tudo (.gs, Interface.html, manifesto)
```

Só falta então **Implantar → Gerenciar implantações → editar → Nova versão** no editor.

> **Atenção:** `npm run publicar` **sobrescreve** os arquivos que estão no Apps Script.
> Se você editar `Config.gs` direto no editor do Google (a lista de e-mails, por exemplo),
> a próxima publicação apaga essa edição. Mantenha as mudanças aqui no repositório, ou puxe
> antes com `npx @google/clasp pull`.

O arquivo `apps-script/appsscript.json` já vai com a configuração certa do Web App
(*executar como usuário que acessa* e *qualquer pessoa com Conta do Google*). Confira no
painel depois do primeiro envio.

### Caminho manual: copiar e colar

Sem instalar nada: abra `apps-script/Interface.html`, selecione tudo (Ctrl+A), copie e cole
no arquivo HTML `Interface` dentro do editor do Apps Script. Mesma coisa para os `.gs` que
tiverem mudado. Depois, **Implantar → Gerenciar implantações → editar → Nova versão**.

## 9. Quando algo dá errado

**"has been blocked by CORS policy" no endereço do GitHub Pages / Cloudflare.**
É o esperado depois de restringir o acesso a contas Google: o Google responde com um desvio
para a tela de login, que não traz cabeçalho de CORS. Um site de fora não consegue fazer login
por você. Abra o aplicativo pela URL que termina em `/exec`. Quem tiver o atalho antigo no
celular vê uma tela explicando isso, com um botão que leva ao endereço certo.

**"Os arquivos do Apps Script são de entregas diferentes".**
Algum arquivo colado no editor é de uma versão anterior. A mensagem diz qual. Cole a versão
atual dele (e o `Versoes.gs`) e publique uma nova versão. O `diagnosticarPlanilha` também
mostra essa conferência na primeira linha do relatório.

**A aba ESTOQUE_ATUAL ficou sem cabeçalho.**
Versões antigas do código limpavam a aba a partir da segunda linha e apagavam o cabeçalho de
quem o tinha mais abaixo. O código atual só limpa da linha seguinte ao cabeçalho, e recria o
cabeçalho quando a aba está sem nenhum — na faixa pintada que a planilha reservou para ele.
Se sobrou alguma coluna solta na linha do título (por exemplo `Estoque Mín.` na linha 1),
pode apagar: é resto da versão antiga.

**Os itens aparecem na lista, mas todos os campos mostram "—".**
O cabeçalho daquela aba não foi reconhecido e o aplicativo leu outra linha no lugar dele.
Execute **`diagnosticarPlanilha`** pelo editor do Apps Script (menu de funções → Executar) e
veja no registro de execução, aba por aba: em que linha o cabeçalho foi achado, quantos
registros foram lidos e quais colunas não foram encontradas. Se o nome que você usa não
estiver sendo reconhecido, acrescente-o em `SINONIMOS`, no `Config.gs`.

**"Já existe um arquivo com esse nome" ao criar um script.**
O arquivo HTML da página se chama `Interface`, e o Apps Script não aceita dois arquivos com o
mesmo nome, mesmo sendo de tipos diferentes. O script correspondente se chama `Pagina.gs`.

**A URL `/exec` devolve `{"ok":true,"dados":{"mensagem":"API GPEL no ar"...}}` em vez do aplicativo.**
O `Codigo.gs` publicado é anterior ao controle de acesso: sem `action`, ele respondia o ping.
Atualize `Codigo.gs`, `Config.gs` e acrescente `Acesso.gs` e `Interface.gs`; depois publique uma
versão nova. Para conferir qual versão está no ar, abra `/exec?action=ping`: a atual traz um
campo `usuario` na resposta.

**"No HTML file named Interface was found" ao abrir a URL `/exec`.**
Falta criar o arquivo HTML `Interface` no projeto do Apps Script. Crie um arquivo **HTML** chamado `Interface`
no editor e cole o conteúdo de `apps-script/Interface.html` (ele já vem pronto no repositório).
Outra saída é preencher `URL_INTERFACE` em `Config.gs`: assim o Apps Script baixa a página do
GitHub sozinho e não é preciso colar nada.

**A página abre, mas diz "Acesso restrito".**
A conta que fez login não está em `USUARIOS_AUTORIZADOS`. A tela mostra qual e-mail foi
recusado. Se você usa mais de uma conta Google no navegador, veja se entrou com a certa.

**"Você não tem permissão para acessar a planilha" ou erro ao gravar.**
Com *Executar como: Usuário que acessa o aplicativo*, cada pessoa usa a própria permissão.
Compartilhe a planilha como **Editor** com cada e-mail autorizado.

**Mudei o código e nada mudou.**
Toda alteração exige **Implantar → Gerenciar implantações → editar → Nova versão**. Se mexeu
em algo de `web/`, rode antes `node ferramentas/empacotar.js` e cole o `Interface.html` novo.

**Criei uma implantação nova e a URL mudou.**
Prefira *editar* a implantação existente: assim a URL continua a mesma e ninguém precisa
trocar o atalho.

## 10. Organização do código

**Backend** (`apps-script/`)

| Arquivo | Para que serve |
|---|---|
| `Config.gs` | Planilha, tabelas, colunas, listas fixas, nomes equivalentes de coluna e **quem pode entrar**. |
| `Acesso.gs` | Identifica a conta logada e barra quem não está na lista. |
| `Pagina.gs` | Entrega a página do aplicativo e faz a ponte com ela. |
| `DadosDeTeste.gs` | Carga e limpeza do cenário de teste. Opcional. |
| `Versoes.gs` | **Gerado.** Confere se todos os arquivos são da mesma entrega. |
| `Interface.html` | **Gerado** por `ferramentas/empacotar.js`. Não editar. |
| `Planilha.gs` | Ler e gravar linhas. Sem regra de negócio. |
| `Regras.gs` | Validação e **todos** os cálculos. |
| `Estoque.gs` | Saldo, recálculo, movimentações, automação da compra e ajuste de inventário. |
| `Automacoes.gs` | Automação ativa documentada e as previstas. |
| `Codigo.gs` | Endereços da API (`doGet`/`doPost`) e ações de criar/editar/excluir. |

**Frontend** (`web/js/`)

| Arquivo | Para que serve |
|---|---|
| `config.js` | URL do servidor e preferências guardadas no aparelho. |
| `api.js` | Conversa com o Apps Script, pelos dois caminhos: `google.script.run` quando a página é servida pelo Google, `fetch` quando está hospedada fora. |
| `estado.js` | Guarda em memória o que veio do servidor. |
| `ui.js` | Peças visuais: cartões, selos, tabelas, avisos, painéis, formatação. |
| `formulario.js` | Monta formulários a partir da definição das tabelas. |
| `recurso.js` | Lista genérica com busca e filtros (cartões no celular, tabela no computador). |
| `rotas.js` | Navegação por `#/pedidos`, `#/estoque`, etc. |
| `telas/*.js` | Uma tela por arquivo. |

Os nomes das colunas ficam **só** em `apps-script/Config.gs`: o aplicativo lê essa definição
pelo endereço `?action=meta`. Para acrescentar um campo, mexa em um lugar só.

### API

| Chamada | O que faz |
|---|---|
| `GET ?action=ping` | Testa a conexão. |
| `GET ?action=meta` | Estrutura das tabelas e listas fixas. |
| `GET ?action=tudo` | Carga inicial (tudo de uma vez). |
| `GET ?action=list&table=PEDIDOS` | Lista uma tabela. |
| `GET ?action=historico&codigo=MP001` | Movimentações de um item. |
| `POST {action:'recalcularEstoque'}` | Força a regravação da aba `ESTOQUE_ATUAL`. |
| `POST {action:'criar', table, valores}` | Cria (gera o ID e dispara a automação da compra). |
| `POST {action:'atualizar', table, id, valores}` | Edita. |
| `POST {action:'excluir', table, id}` | Exclui (só cadastros que não estejam em uso). |
| `POST {action:'estoqueMinimo', codigo, minimo}` | Define o estoque mínimo. |
| `POST {action:'aprovarAjuste', id}` | Aprova o ajuste de um inventário. |

Toda resposta traz `ok`, `dados` (ou `erro`) e `ms` — o tempo gasto dentro do Apps Script.

O POST usa `Content-Type: text/plain` de propósito: assim o navegador não faz a requisição de
verificação (preflight CORS), que o Apps Script não responde. O corpo continua sendo JSON.

---

## 11. Testes

```bash
npm test                       # regras do backend + conferência do pacote
node testes/testes.js          # só as regras do backend (39 testes, sem precisar da planilha)
npm install -D playwright      # só para o teste de interface
node testes/teste-navegador.js # abre o aplicativo num navegador com o backend simulado
```

Os testes cobrem inclusão, edição, erro e repetição das automações: compra gerando uma única
entrada, edição de compra não duplicando, ajuste de inventário aprovado uma vez só, saldo
saindo da soma das movimentações, validações recusando dados inválidos.

O controle de acesso também é testado: conta de fora barrada na leitura e na gravação,
página do aplicativo não entregue para quem não está na lista, senha valendo junto com o
login e `Responsável` assinado pela conta que entrou. O teste de interface roda o aplicativo
nos dois modos — hospedado fora e servido pelo Apps Script (com a ponte simulada).

`testes/simulador.js` imita o Google Apps Script no computador; não vai para produção.

---

## 12. O que já está pronto

- Cadastros de produtos, insumos, clientes e fornecedores.
- Pedidos com acompanhamento de situação até a entrega.
- Produção com Prod./h e Prod./HH.
- Compras com entrada automática e sem duplicidade.
- Estoque com saldo calculado, estoque mínimo e sinal de reposição.
- Inventário com aprovação de ajuste rastreável.
- Histórico de movimentações por item, documento, data ou responsável.
- Gestão: pedidos em aberto/atrasados, produtividade, perdas, estoque crítico e curva ABC.

**Curva ABC:** usa `VENDAS_HISTORICO` quando a aba tiver colunas de produto e valor
(reconhecidas pelo nome). Enquanto ela estiver vazia, a curva é montada com os pedidos
entregues — e a tela diz qual fonte está usando.

**Rendimento (%)** continua sendo digitado, não calculado: falta base dimensional confiável
(kg de produto por kg de matéria-prima), como combinado.

`PARAMETROS` não aparece em lugar nenhum da navegação: é aba técnica.
