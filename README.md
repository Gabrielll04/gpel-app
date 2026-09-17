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
   (`Config.gs`, `Planilha.gs`, `Regras.gs`, `Estoque.gs`, `Automacoes.gs`, `Codigo.gs`).
3. Em `Config.gs`, preencha `ID_PLANILHA` se necessário. `TOKEN_ACESSO` é opcional
   (senha simples pedida ao aplicativo).
4. Execute uma vez a função **`instalarPlanilha`** e autorize o acesso. Ela cria as abas
   que faltarem e acerta os cabeçalhos — **não apaga nada do que já existe**.
5. **Implantar → Nova implantação → Aplicativo da Web**:
   - *Executar como:* **Eu**
   - *Quem pode acessar:* **Qualquer pessoa**
6. Copie a URL gerada (termina em `/exec`).

> Sempre que alterar o código, faça **Implantar → Gerenciar implantações → editar → Nova versão**,
> senão a URL continua servindo a versão antiga.

## 3. Abrir o aplicativo

Abra `web/index.html` (direto no navegador, num servidor simples ou no GitHub Pages),
vá em **Configurações**, cole a URL do Web App, informe seu nome e toque em **Testar conexão**.

Para já entregar o aplicativo configurado para todo mundo, preencha `URL_API_PADRAO`
em `web/js/config.js`.

Publicando no GitHub Pages: Settings → Pages → Branch `main`, pasta `/root`; o endereço
fica `https://<usuario>.github.io/gpel-app/web/`.

## 4. Antes de usar com dados de verdade

- **Tire as fórmulas das colunas calculadas da planilha.** Quem calcula agora é o código
  (`apps-script/Regras.gs` e `Estoque.gs`). Manter fórmula na planilha *e* cálculo no código
  cria duas versões da mesma regra — é a receita de número divergente.
  Colunas calculadas: `Valor Total` (PEDIDOS e COMPRAS), `Prod./h`, `Prod./HH`,
  `Qtd. Assinada`, `Saldo Sistema`, `Diferença`, `Ajuste?` e toda a aba `ESTOQUE_ATUAL`.
- Confira se cada produto e insumo tem **Unidade** preenchida: é ela que aparece
  automaticamente nos pedidos, na produção e nas movimentações.

---

## 5. Como o sistema funciona

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

### Automações previstas (ainda não ligadas)

Produção concluída → entrada de produto acabado; consumo de matéria-prima → saída;
entrega confirmada → saída e atualização do pedido. O caminho está documentado em
`apps-script/Automacoes.gs`, com a função de idempotência pronta (`movimentoPorDocumento_`).
Não foram ligadas porque dependem de apontamento confiável, conforme combinado no projeto.

---

## 6. Organização do código

**Backend** (`apps-script/`)

| Arquivo | Para que serve |
|---|---|
| `Config.gs` | Planilha, tabelas, colunas e listas fixas. Mexa aqui para acrescentar coluna ou opção. |
| `Planilha.gs` | Ler e gravar linhas. Sem regra de negócio. |
| `Regras.gs` | Validação e **todos** os cálculos. |
| `Estoque.gs` | Saldo, recálculo, movimentações, automação da compra e ajuste de inventário. |
| `Automacoes.gs` | Automação ativa documentada e as previstas. |
| `Codigo.gs` | Endereços da API (`doGet`/`doPost`) e ações de criar/editar/excluir. |

**Frontend** (`web/js/`)

| Arquivo | Para que serve |
|---|---|
| `config.js` | URL do servidor e preferências guardadas no aparelho. |
| `api.js` | Conversa com o Apps Script. |
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
| `POST {action:'criar', table, valores}` | Cria (gera o ID e dispara a automação da compra). |
| `POST {action:'atualizar', table, id, valores}` | Edita. |
| `POST {action:'excluir', table, id}` | Exclui (só cadastros que não estejam em uso). |
| `POST {action:'estoqueMinimo', codigo, minimo}` | Define o estoque mínimo. |
| `POST {action:'aprovarAjuste', id}` | Aprova o ajuste de um inventário. |

O POST usa `Content-Type: text/plain` de propósito: assim o navegador não faz a requisição de
verificação (preflight CORS), que o Apps Script não responde. O corpo continua sendo JSON.

---

## 7. Testes

```bash
node testes/testes.js          # regras do backend (28 testes, sem precisar da planilha)
npm install -D playwright      # só para o teste de interface
node testes/teste-navegador.js # abre o aplicativo num navegador com o backend simulado
```

Os testes cobrem inclusão, edição, erro e repetição das automações: compra gerando uma única
entrada, edição de compra não duplicando, ajuste de inventário aprovado uma vez só, saldo
saindo da soma das movimentações, validações recusando dados inválidos.

`testes/simulador.js` imita o Google Apps Script no computador; não vai para produção.

---

## 8. O que já está pronto

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
