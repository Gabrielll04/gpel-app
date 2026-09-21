/* GPEL - testes das regras do backend.
   Rodar com:  node testes/testes.js
   Cobre inclusão, edição, erro e repetição das automações, como pede a
   diretriz de desenvolvimento do projeto. */

const { carregarBackend } = require('./simulador');

let total = 0;
let falhas = 0;

function teste(nome, funcao) {
  total++;
  try {
    funcao();
    console.log('  ok   ' + nome);
  } catch (erro) {
    falhas++;
    console.log('  FALHA ' + nome + '\n        ' + erro.message);
  }
}

function conferir(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem || 'condição falsa');
}

function conferirIgual(obtido, esperado, mensagem) {
  if (obtido !== esperado) {
    throw new Error((mensagem || 'valores diferentes') + ' — esperado: ' + esperado + ' / obtido: ' + obtido);
  }
}

function esperarErro(funcao, trecho) {
  let lancou = false;
  try {
    funcao();
  } catch (erro) {
    lancou = true;
    if (trecho && erro.message.indexOf(trecho) === -1) {
      throw new Error('mensagem inesperada: ' + erro.message);
    }
  }
  if (!lancou) throw new Error('esperava um erro e nada aconteceu');
}

/** Ambiente novo, com cadastros básicos, para cada bloco de teste. */
function ambiente() {
  const { contexto } = carregarBackend();
  contexto.instalarPlanilha();
  contexto.criar_('CAD_PRODUTOS', { 'Código': 'PA001', 'Produto': 'Papel higiênico 300 m', 'Tipo': 'Fabricação', 'Unidade': 'rolo' });
  contexto.criar_('CAD_INSUMOS', { 'Código': 'MP001', 'Item': 'Bobina de papel', 'Unidade': 'kg' });
  contexto.criar_('CAD_CLIENTES', { 'Código': 'CL001', 'Razão Social': 'Unidade Prisional' });
  contexto.criar_('CAD_FORNECEDORES', { 'Código': 'FO001', 'Razão Social': 'Papelaria Central' });
  return contexto;
}

/* ---------------------------------------------------------- Cadastros */

console.log('\nCadastros');

teste('cria cadastro e gera código quando vem em branco', () => {
  const g = ambiente();
  const resposta = g.criar_('CAD_CLIENTES', { 'Código': '', 'Razão Social': 'Cliente Sem Código' });
  conferir(resposta.registro['Código'].indexOf('CLI-') === 0, 'deveria gerar código com prefixo CLI');
});

teste('recusa código duplicado', () => {
  const g = ambiente();
  esperarErro(() => g.criar_('CAD_PRODUTOS', { 'Código': 'PA001', 'Produto': 'Outro', 'Tipo': 'Revenda', 'Unidade': 'un' }), 'Já existe');
});

teste('recusa tipo de produto fora da lista', () => {
  const g = ambiente();
  esperarErro(() => g.criar_('CAD_PRODUTOS', { 'Código': 'PA002', 'Produto': 'X', 'Tipo': 'Inventado', 'Unidade': 'un' }), 'não é uma opção válida');
});

teste('não exclui cadastro em uso', () => {
  const g = ambiente();
  g.criar_('PEDIDOS', { 'Data': '2026-01-10', 'Cliente': 'CL001', 'Produto': 'PA001', 'Quantidade': 10, 'Valor Unit.': 5, 'Status': 'Recebido' });
  esperarErro(() => g.excluir_('CAD_CLIENTES', 'CL001'), 'não pode ser excluído');
});

/* ------------------------------------------------------------ Pedidos */

console.log('\nPedidos');

teste('calcula valor total e preenche a unidade pelo produto', () => {
  const g = ambiente();
  const pedido = g.criar_('PEDIDOS', {
    'Data': '2026-01-10', 'Cliente': 'CL001', 'Produto': 'PA001',
    'Quantidade': 12, 'Valor Unit.': 3.5, 'Status': 'Recebido', 'Origem comercial': 'WhatsApp'
  }).registro;
  conferirIgual(pedido['Valor Total'], 42, 'valor total');
  conferirIgual(pedido['Unidade'], 'rolo', 'unidade');
  conferir(pedido['ID Pedido'].indexOf('PED-') === 0, 'id do pedido');
});

teste('recusa quantidade zerada', () => {
  const g = ambiente();
  esperarErro(() => g.criar_('PEDIDOS', {
    'Data': '2026-01-10', 'Cliente': 'CL001', 'Produto': 'PA001', 'Quantidade': 0, 'Valor Unit.': 3, 'Status': 'Recebido'
  }), 'maior que zero');
});

teste('recusa entrega anterior ao pedido', () => {
  const g = ambiente();
  esperarErro(() => g.criar_('PEDIDOS', {
    'Data': '2026-01-10', 'Cliente': 'CL001', 'Produto': 'PA001', 'Quantidade': 5,
    'Valor Unit.': 3, 'Prazo / Data Entrega': '2026-01-05', 'Status': 'Recebido'
  }), 'não pode ser anterior');
});

teste('editar pedido recalcula o total e mantém o mesmo ID', () => {
  const g = ambiente();
  const criado = g.criar_('PEDIDOS', {
    'Data': '2026-01-10', 'Cliente': 'CL001', 'Produto': 'PA001', 'Quantidade': 10, 'Valor Unit.': 2, 'Status': 'Recebido'
  }).registro;
  const editado = g.atualizar_('PEDIDOS', criado['ID Pedido'], { 'Quantidade': 20, 'Status': 'Entregue' }).registro;
  conferirIgual(editado['ID Pedido'], criado['ID Pedido'], 'id preservado');
  conferirIgual(editado['Valor Total'], 40, 'valor total recalculado');
  conferirIgual(editado['Status'], 'Entregue', 'status');
});

/* ----------------------------------------------------------- Produção */

console.log('\nProdução');

teste('calcula produção por hora e por hora/pessoa', () => {
  const g = ambiente();
  const producao = g.criar_('PRODUCAO', {
    'Data': '2026-01-10', 'Produto': 'PA001', 'Meta': 1000, 'Produzido': 900,
    'Perdas (kg)': 5, 'Horas': 9, 'Pessoas': 3, 'Status': 'Concluída'
  }).registro;
  conferirIgual(producao['Prod./h'], 100, 'prod./h');
  conferirIgual(producao['Prod./HH'], 33.33, 'prod./HH');
  conferirIgual(producao['Unidade'], 'rolo', 'unidade do produto');
});

teste('sem horas informadas, não inventa produtividade', () => {
  const g = ambiente();
  const producao = g.criar_('PRODUCAO', {
    'Data': '2026-01-10', 'Produto': 'PA001', 'Produzido': 500, 'Horas': '', 'Pessoas': '', 'Status': 'Planejada'
  }).registro;
  conferirIgual(producao['Prod./h'], '', 'prod./h vazio');
  conferirIgual(producao['Prod./HH'], '', 'prod./HH vazio');
});

/* ------------------------------------------- Compras e automação      */

console.log('\nCompras (automação de entrada no estoque)');

function comprarPadrao(g, extras) {
  return g.criar_('COMPRAS', Object.assign({
    'Data': '2026-01-12', 'NF': '000123', 'Fornecedor': 'FO001', 'Tipo Compra': 'Matéria-prima',
    'Classe': 'Insumo', 'Código Item': 'MP001', 'Quantidade': 100, 'Valor Unit.': 4.5
  }, extras || {}));
}

teste('compra gera exatamente uma entrada em MOV_ESTOQUE', () => {
  const g = ambiente();
  const resposta = comprarPadrao(g);
  const movimentos = g.listar('MOV_ESTOQUE');
  conferirIgual(movimentos.length, 1, 'quantidade de movimentações');
  conferirIgual(movimentos[0]['Entrada/Saída'], 'Entrada', 'tipo do movimento');
  conferirIgual(movimentos[0]['Origem'], 'Compra', 'origem');
  conferirIgual(movimentos[0]['Quantidade'], 100, 'quantidade');
  conferirIgual(movimentos[0]['Documento Ref.'], '000123', 'documento');
  conferirIgual(movimentos[0]['Item'], 'Bobina de papel', 'item buscado no cadastro');
  conferirIgual(movimentos[0]['Qtd. Assinada'], 100, 'quantidade assinada');
  conferir(resposta.extras.movimentoGerado, 'deveria devolver o movimento gerado');
  conferirIgual(resposta.registro['Valor Total'], 450, 'valor total da compra');
});

teste('editar a compra NÃO duplica a entrada no estoque', () => {
  const g = ambiente();
  const compra = comprarPadrao(g).registro;
  const idCompra = compra['ID Compra'];
  g.atualizar_('COMPRAS', idCompra, { 'Quantidade': 250, 'Observações': 'corrigido' });
  g.atualizar_('COMPRAS', idCompra, { 'Valor Unit.': 5 });
  conferirIgual(g.listar('MOV_ESTOQUE').length, 1, 'continua com uma única movimentação');
  conferirIgual(g.saldoDoItem('MP001'), 100, 'saldo não muda por edição da compra');
});

teste('duas compras iguais geram duas entradas (repetição legítima)', () => {
  const g = ambiente();
  comprarPadrao(g);
  comprarPadrao(g);
  conferirIgual(g.listar('MOV_ESTOQUE').length, 2, 'duas movimentações');
  conferirIgual(g.saldoDoItem('MP001'), 200, 'saldo somado');
});

teste('compra com item inexistente é recusada e não movimenta estoque', () => {
  const g = ambiente();
  esperarErro(() => comprarPadrao(g, { 'Código Item': 'NAO_EXISTE' }), 'não encontrado');
  conferirIgual(g.listar('MOV_ESTOQUE').length, 0, 'nenhuma movimentação criada');
});

teste('NF com zeros à esquerda é preservada', () => {
  const g = ambiente();
  const compra = comprarPadrao(g, { 'NF': '000987' }).registro;
  conferirIgual(compra['NF'], '000987', 'NF preservada');
});

/* ------------------------------------------------------------ Estoque */

console.log('\nEstoque');

teste('saldo é a soma das movimentações, com entradas e saídas', () => {
  const g = ambiente();
  comprarPadrao(g); // +100
  g.criar_('MOV_ESTOQUE', {
    'Data': '2026-01-13', 'Classe': 'Insumo', 'Código Item': 'MP001',
    'Entrada/Saída': 'Saída', 'Origem': 'Consumo Produção', 'Quantidade': 30, 'Responsável': 'Ana'
  });
  const linha = g.listar('ESTOQUE_ATUAL').filter((l) => l['Código'] === 'MP001')[0];
  conferirIgual(linha['Entradas'], 100, 'entradas');
  conferirIgual(linha['Saídas'], 30, 'saídas');
  conferirIgual(linha['Saldo Atual'], 70, 'saldo');
  conferirIgual(linha['Status'], 'DEFINIR MÍNIMO', 'status sem mínimo definido');
});

teste('status muda para REPOR quando o saldo fica no mínimo ou abaixo', () => {
  const g = ambiente();
  comprarPadrao(g, { 'Quantidade': 10 });
  g.definirEstoqueMinimo('MP001', 10);
  let linha = g.listar('ESTOQUE_ATUAL').filter((l) => l['Código'] === 'MP001')[0];
  conferirIgual(linha['Status'], 'REPOR', 'saldo igual ao mínimo já é REPOR');
  comprarPadrao(g, { 'Quantidade': 50 });
  linha = g.listar('ESTOQUE_ATUAL').filter((l) => l['Código'] === 'MP001')[0];
  conferirIgual(linha['Status'], 'OK', 'acima do mínimo volta para OK');
});

teste('estoque mínimo é preservado ao recalcular', () => {
  const g = ambiente();
  comprarPadrao(g);
  g.definirEstoqueMinimo('MP001', 40);
  g.recalcularEstoque();
  const linha = g.listar('ESTOQUE_ATUAL').filter((l) => l['Código'] === 'MP001')[0];
  conferirIgual(linha['Estoque Mín.'], 40, 'mínimo preservado');
});

teste('ler o estoque não regrava a planilha (leitura é só cálculo)', () => {
  const g = ambiente();
  comprarPadrao(g);
  g.gravarEstoqueAtual_([]); // esvazia a aba de propósito
  const calculado = g.calcularEstoque();
  conferir(calculado.length > 0, 'o cálculo devolve os itens');
  conferirIgual(g.listar('ESTOQUE_ATUAL').length, 0, 'a aba continua sem ser regravada');
  const resposta = JSON.parse(g.doGet({ parameter: { action: 'tudo' } }).getContent());
  conferir(resposta.dados.ESTOQUE_ATUAL.length > 0, 'a carga do aplicativo traz o saldo');
  conferirIgual(g.listar('ESTOQUE_ATUAL').length, 0, 'abrir o aplicativo não escreve na planilha');
});

teste('movimentar o estoque regrava a aba ESTOQUE_ATUAL', () => {
  const g = ambiente();
  g.gravarEstoqueAtual_([]);
  comprarPadrao(g);
  const linha = g.listar('ESTOQUE_ATUAL').filter((l) => l['Código'] === 'MP001')[0];
  conferir(linha, 'item gravado na aba depois da movimentação');
  conferirIgual(linha['Saldo Atual'], 100, 'saldo gravado');
});

teste('movimentação não pode ser alterada nem excluída', () => {
  const g = ambiente();
  comprarPadrao(g);
  const movimento = g.listar('MOV_ESTOQUE')[0];
  esperarErro(() => g.atualizar_('MOV_ESTOQUE', movimento['ID Movimento'], { 'Quantidade': 1 }), 'não podem ser alteradas');
  esperarErro(() => g.excluir_('MOV_ESTOQUE', movimento['ID Movimento']), 'não pode ser excluído');
});

teste('movimentação com quantidade zero é recusada', () => {
  const g = ambiente();
  esperarErro(() => g.criar_('MOV_ESTOQUE', {
    'Data': '2026-01-13', 'Classe': 'Insumo', 'Código Item': 'MP001',
    'Entrada/Saída': 'Entrada', 'Origem': 'Compra', 'Quantidade': 0
  }), 'maior que zero');
});

/* --------------------------------------------------------- Inventário */

console.log('\nInventário');

teste('contagem com diferença NÃO altera o saldo sozinha', () => {
  const g = ambiente();
  comprarPadrao(g); // saldo 100
  g.criar_('INVENTARIO', {
    'Data': '2026-01-14', 'Classe': 'Insumo', 'Código': 'MP001',
    'Contagem Física': 90, 'Responsável': 'Ana'
  });
  conferirIgual(g.saldoDoItem('MP001'), 100, 'saldo intocado');
  const inventario = g.listar('INVENTARIO')[0];
  conferirIgual(inventario['Saldo Sistema'], 100, 'saldo do sistema registrado');
  conferirIgual(inventario['Diferença'], -10, 'diferença');
  conferirIgual(inventario['Ajuste?'], 'Sim', 'marcado para ajuste');
});

teste('aprovar ajuste gera movimentação rastreável e acerta o saldo', () => {
  const g = ambiente();
  comprarPadrao(g);
  const inventario = g.criar_('INVENTARIO', {
    'Data': '2026-01-14', 'Classe': 'Insumo', 'Código': 'MP001', 'Contagem Física': 90, 'Responsável': 'Ana'
  }).registro;
  g.aprovarAjusteInventario(inventario['ID Inventário'], 'Ana');
  conferirIgual(g.saldoDoItem('MP001'), 90, 'saldo ajustado para a contagem');
  const ajuste = g.listar('MOV_ESTOQUE').filter((m) => m['Origem'] === 'Inventário -')[0];
  conferir(ajuste, 'deveria existir um movimento de Inventário -');
  conferirIgual(ajuste['Quantidade'], 10, 'quantidade do ajuste');
  conferirIgual(ajuste['Documento Ref.'], inventario['ID Inventário'], 'documento aponta para o inventário');
});

teste('aprovar o mesmo ajuste duas vezes é recusado', () => {
  const g = ambiente();
  comprarPadrao(g);
  const inventario = g.criar_('INVENTARIO', {
    'Data': '2026-01-14', 'Classe': 'Insumo', 'Código': 'MP001', 'Contagem Física': 120, 'Responsável': 'Ana'
  }).registro;
  g.aprovarAjusteInventario(inventario['ID Inventário'], 'Ana');
  esperarErro(() => g.aprovarAjusteInventario(inventario['ID Inventário'], 'Ana'), 'já foi aprovado');
  conferirIgual(g.listar('MOV_ESTOQUE').filter((m) => m['Origem'] === 'Inventário +').length, 1, 'apenas um ajuste');
  conferirIgual(g.saldoDoItem('MP001'), 120, 'saldo permanece igual à contagem');
});

teste('aprovar ajuste sem diferença é recusado', () => {
  const g = ambiente();
  comprarPadrao(g);
  const inventario = g.criar_('INVENTARIO', {
    'Data': '2026-01-14', 'Classe': 'Insumo', 'Código': 'MP001', 'Contagem Física': 100, 'Responsável': 'Ana'
  }).registro;
  esperarErro(() => g.aprovarAjusteInventario(inventario['ID Inventário'], 'Ana'), 'Não há diferença');
  conferirIgual(g.listar('MOV_ESTOQUE').length, 1, 'nenhuma movimentação extra');
});

teste('listarInventarios mostra quais ajustes já foram aprovados', () => {
  const g = ambiente();
  comprarPadrao(g);
  const inventario = g.criar_('INVENTARIO', {
    'Data': '2026-01-14', 'Classe': 'Insumo', 'Código': 'MP001', 'Contagem Física': 80, 'Responsável': 'Ana'
  }).registro;
  conferirIgual(g.listarInventarios()[0]._ajusteAprovado, false, 'ainda não aprovado');
  g.aprovarAjusteInventario(inventario['ID Inventário'], 'Ana');
  conferirIgual(g.listarInventarios()[0]._ajusteAprovado, true, 'aprovado depois da ação');
});

/* ------------------------------------------------------------- Acesso */

console.log('\nControle de acesso');

/** Ambiente com lista de e-mails autorizados ligada. */
function ambienteComLista(autorizados) {
  const g = ambiente();
  g.USUARIOS_AUTORIZADOS.length = 0;
  (autorizados || ['dona@gpel.com']).forEach((e) => g.USUARIOS_AUTORIZADOS.push(e));
  return g;
}

teste('conta autorizada entra normalmente', () => {
  const g = ambienteComLista(['dona@gpel.com']);
  const resposta = JSON.parse(g.doGet({ parameter: { action: 'tudo' } }).getContent());
  conferir(resposta.ok, 'leitura liberada');
  conferirIgual(resposta.dados.usuario.email, 'dona@gpel.com', 'e-mail identificado');
});

teste('conta de fora é recusada na leitura', () => {
  const g = ambienteComLista(['dona@gpel.com']);
  g.__definirUsuario('estranho@outro.com');
  const resposta = JSON.parse(g.doGet({ parameter: { action: 'tudo' } }).getContent());
  conferirIgual(resposta.ok, false, 'leitura bloqueada');
  conferir(resposta.erro.indexOf('não tem acesso') !== -1, 'mensagem explica o motivo');
});

teste('conta de fora é recusada na gravação', () => {
  const g = ambienteComLista(['dona@gpel.com']);
  g.__definirUsuario('estranho@outro.com');
  const antes = g.listar('CAD_CLIENTES').length;
  const resposta = JSON.parse(g.doPost({ postData: { contents: JSON.stringify({
    action: 'criar', table: 'CAD_CLIENTES', valores: { 'Código': 'X1', 'Razão Social': 'Invasor' }
  }) } }).getContent());
  conferirIgual(resposta.ok, false, 'gravação bloqueada');
  conferirIgual(g.listar('CAD_CLIENTES').length, antes, 'nada foi gravado');
});

teste('maiúsculas e espaços no e-mail não barram a entrada', () => {
  const g = ambienteComLista(['  Dona@GPEL.com ']);
  g.__definirUsuario('dona@gpel.com');
  conferirIgual(g.usuarioAutorizado(), true, 'comparação sem diferenciar caixa');
});

teste('abrir o endereço sem parâmetros entrega a página, não a resposta da API', () => {
  const g = ambiente();
  const saida = g.doGet({ parameter: {} }).getContent();
  conferir(saida.indexOf('API GPEL no ar') === -1, 'não devolve o JSON do ping');
  conferir(saida.indexOf('Interface') !== -1, 'devolve a página do aplicativo');
});

teste('sem página nenhuma, explica o que falta em vez de dar erro seco', () => {
  const g = ambiente();
  g.HtmlService.createHtmlOutputFromFile = () => { throw new Error('No HTML file named Interface was found.'); };
  const saida = g.doGet({ parameter: {} }).getContent();
  conferir(saida.indexOf('Falta a página do aplicativo') !== -1, 'mostra o aviso');
  conferir(saida.indexOf('URL_INTERFACE') !== -1, 'diz onde configurar');
});

teste('Config.gs antigo não derruba o aplicativo (falta URL_INTERFACE)', () => {
  const { contexto } = carregarBackend({ configAntigo: ['URL_INTERFACE', 'MINUTOS_DE_CACHE_DA_PAGINA'] });
  contexto.instalarPlanilha();
  const saida = contexto.doGet({ parameter: {} }).getContent();
  conferir(saida.indexOf('Interface') !== -1, 'a página é entregue mesmo assim');
});

teste('Config.gs antigo não derruba o controle de acesso (falta a lista)', () => {
  const { contexto } = carregarBackend({ configAntigo: ['USUARIOS_AUTORIZADOS'] });
  contexto.instalarPlanilha();
  conferirIgual(contexto.usuarioAutorizado(), true, 'segue o padrão de lista vazia');
  conferirIgual(contexto.dadosDoUsuario_().listaAtiva, false, 'e avisa que não há lista ativa');
});

teste('a página do aplicativo não é servida para conta de fora', () => {
  const g = ambienteComLista(['dona@gpel.com']);
  g.__definirUsuario('estranho@outro.com');
  const pagina = g.doGet({ parameter: {} }).getContent();
  conferir(pagina.indexOf('Acesso restrito') !== -1, 'mostra o aviso de acesso restrito');
  conferir(pagina.indexOf('estranho@outro.com') !== -1, 'diz qual conta foi recusada');
});

teste('lista vazia mantém o comportamento antigo (a trava é a publicação)', () => {
  const g = ambiente();
  g.__definirUsuario('qualquer@pessoa.com');
  conferirIgual(g.usuarioAutorizado(), true, 'sem lista, não bloqueia');
});

teste('a senha opcional continua valendo junto com o login', () => {
  const g = ambienteComLista(['dona@gpel.com']);
  g.TOKEN_ACESSO = 'segredo';
  let resposta = JSON.parse(g.doGet({ parameter: { action: 'ping' } }).getContent());
  conferirIgual(resposta.ok, false, 'sem senha não passa');
  resposta = JSON.parse(g.doGet({ parameter: { action: 'ping', token: 'segredo' } }).getContent());
  conferirIgual(resposta.ok, true, 'com a senha certa passa');
});

teste('responsável em branco é preenchido com quem está logado', () => {
  const g = ambienteComLista(['dona@gpel.com']);
  g.criar_('MOV_ESTOQUE', {
    'Data': '2026-01-20', 'Classe': 'Insumo', 'Código Item': 'MP001',
    'Entrada/Saída': 'Entrada', 'Origem': 'Devolução', 'Quantidade': 5
  }, g.nomeDoUsuario());
  conferirIgual(g.listar('MOV_ESTOQUE')[0]['Responsável'], 'dona', 'assinado por quem fez login');
});

teste('responsável digitado pela usuária é respeitado', () => {
  const g = ambienteComLista(['dona@gpel.com']);
  g.criar_('MOV_ESTOQUE', {
    'Data': '2026-01-20', 'Classe': 'Insumo', 'Código Item': 'MP001',
    'Entrada/Saída': 'Entrada', 'Origem': 'Devolução', 'Quantidade': 5, 'Responsável': 'Ana'
  }, g.nomeDoUsuario());
  conferirIgual(g.listar('MOV_ESTOQUE')[0]['Responsável'], 'Ana', 'nome informado prevalece');
});

/* ---------------------------------------------------------------- API */

console.log('\nAPI');

teste('doGet devolve a estrutura das tabelas', () => {
  const g = ambiente();
  const resposta = JSON.parse(g.doGet({ parameter: { action: 'meta' } }).getContent());
  conferir(resposta.ok, 'resposta ok');
  conferir(resposta.dados.tabelas.PEDIDOS, 'tabela PEDIDOS na resposta');
  conferir(resposta.dados.enums.STATUS_PEDIDO.length > 0, 'lista de status');
});

teste('doPost com ação desconhecida devolve erro tratado, não quebra', () => {
  const g = ambiente();
  const resposta = JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ action: 'voar' }) } }).getContent());
  conferirIgual(resposta.ok, false, 'resposta de erro');
  conferir(resposta.erro.indexOf('Ação desconhecida') === 0, 'mensagem clara');
});

teste('carga inicial traz todas as tabelas de uma vez', () => {
  const g = ambiente();
  comprarPadrao(g);
  const resposta = JSON.parse(g.doGet({ parameter: { action: 'tudo' } }).getContent());
  conferir(resposta.ok, 'resposta ok');
  conferirIgual(resposta.dados.COMPRAS.length, 1, 'compras carregadas');
  conferirIgual(resposta.dados.ESTOQUE_ATUAL.length >= 2, true, 'estoque carregado');
});

/* --------------------------------------------------------------- Fim */

console.log('\n' + (total - falhas) + ' de ' + total + ' testes passaram.');
process.exit(falhas ? 1 : 0);
