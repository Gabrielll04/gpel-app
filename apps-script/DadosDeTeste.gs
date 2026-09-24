/**
 * GPEL - Dados de teste.
 *
 * Monta um cenário realista de ~40 dias de operação para mostrar o aplicativo
 * funcionando: pedidos em várias situações (inclusive atrasados), produções,
 * compras de matéria-prima e revenda, entregas, perdas e inventário.
 *
 * COMO USAR (no editor do Apps Script, menu de funções > Executar):
 *   carregarDadosDeTeste  -> cria o cenário
 *   apagarDadosDeTeste    -> remove exatamente o que foi criado, nada mais
 *
 * GARANTIAS
 *   - Tudo passa pelas mesmas funções que o aplicativo usa. O saldo nunca é
 *     escrito: cada entrada e saída vira uma linha em MOV_ESTOQUE, como na
 *     operação real.
 *   - O ID de cada registro criado fica anotado nas propriedades do script.
 *     A limpeza apaga só esses registros: dados reais nunca são tocados,
 *     mesmo que tenham sido lançados depois da carga.
 *   - Produtos e insumos que já existem na planilha são reaproveitados, e não
 *     são apagados na limpeza. Clientes e fornecedores de teste levam
 *     "(TESTE)" no nome.
 *   - A limpeza é a ÚNICA exceção à regra de nunca apagar movimentações: ela
 *     só remove movimentações que nasceram da própria carga de teste.
 *
 * Rode apagarDadosDeTeste ANTES de começar a lançar dados de verdade.
 */

var CHAVE_TESTE = 'GPEL_TESTE';
var MARCA_TESTE = '[TESTE] ';

/* ---------------------------------------------------------------------- */
/* Catálogo da GPEL (reaproveitado se já existir na planilha)             */
/* ---------------------------------------------------------------------- */

var CATALOGO_PRODUTOS = [
  { 'Código': 'FAB-LEN',   'Produto': 'Lençol hospitalar',       'Tipo': 'Fabricação', 'Unidade': 'rolo' },
  { 'Código': 'FAB-PTB',   'Produto': 'Papel toalha bobina',     'Tipo': 'Fabricação', 'Unidade': 'fardo' },
  { 'Código': 'FAB-PH300', 'Produto': 'Papel higiênico 300m',    'Tipo': 'Fabricação', 'Unidade': 'fardo' },
  { 'Código': 'FAB-PH200', 'Produto': 'Papel higiênico 200m',    'Tipo': 'Fabricação', 'Unidade': 'fardo' },
  { 'Código': 'FAB-PH150', 'Produto': 'Papel higiênico 150m',    'Tipo': 'Fabricação', 'Unidade': 'fardo' },
  { 'Código': 'REV-PH30',  'Produto': 'Papel higiênico 30m',     'Tipo': 'Revenda',    'Unidade': 'fardo' },
  { 'Código': 'REV-INTER', 'Produto': 'Papel toalha interfolha', 'Tipo': 'Revenda',    'Unidade': 'fardo' },
  { 'Código': 'REV-SAB',   'Produto': 'Sabonete líquido',        'Tipo': 'Revenda',    'Unidade': 'L' },
  { 'Código': 'REV-DES',   'Produto': 'Desinfetante',            'Tipo': 'Revenda',    'Unidade': 'L' },
  { 'Código': 'REV-COPO',  'Produto': 'Copo descartável',        'Tipo': 'Revenda',    'Unidade': 'pacote' }
];

var CATALOGO_INSUMOS = [
  { 'Código': 'MP-BOB-LEN', 'Item': 'Bobina para lençol hospitalar', 'Unidade': 'kg' },
  { 'Código': 'MP-BOB-PT',  'Item': 'Bobina para papel toalha',      'Unidade': 'kg' },
  { 'Código': 'MP-BOB-PH',  'Item': 'Bobina para papel higiênico',   'Unidade': 'kg' },
  { 'Código': 'MP-TUB-01',  'Item': 'Tubete tipo 1',                 'Unidade': 'un.' },
  { 'Código': 'EMB-LEN',    'Item': 'Embalagem Lençol Hospitalar',   'Unidade': 'un.' },
  { 'Código': 'EMB-PH300',  'Item': 'Embalagem PH 300m',             'Unidade': 'un.' }
];

var CLIENTES_TESTE = [
  { 'Código': 'TESTE-CLI-01', 'Razão Social': 'Hospital Municipal São Lucas (TESTE)' },
  { 'Código': 'TESTE-CLI-02', 'Razão Social': 'Prefeitura de Santa Rita - Saúde (TESTE)' },
  { 'Código': 'TESTE-CLI-03', 'Razão Social': 'Clínica Vida Plena (TESTE)' },
  { 'Código': 'TESTE-CLI-04', 'Razão Social': 'Distribuidora Limpa Bem (TESTE)' },
  { 'Código': 'TESTE-CLI-05', 'Razão Social': 'Escola Estadual Monteiro Lobato (TESTE)' }
];

var FORNECEDORES_TESTE = [
  { 'Código': 'TESTE-FOR-01', 'Razão Social': 'Papéis Sul Bobinas (TESTE)' },
  { 'Código': 'TESTE-FOR-02', 'Razão Social': 'Tubetes Paraná (TESTE)' },
  { 'Código': 'TESTE-FOR-03', 'Razão Social': 'Embalagens Rio (TESTE)' },
  { 'Código': 'TESTE-FOR-04', 'Razão Social': 'Química Limpax (TESTE)' },
  { 'Código': 'TESTE-FOR-05', 'Razão Social': 'Atacado Descartáveis Brasil (TESTE)' }
];

/** Estoque mínimo usado no cenário (só aplicado onde ainda não há mínimo). */
var MINIMOS_TESTE = {
  'MP-BOB-PH': 1500, 'MP-BOB-LEN': 150, 'MP-BOB-PT': 500, 'MP-TUB-01': 2000, 'EMB-PH300': 300,
  'FAB-PH300': 80, 'FAB-LEN': 40, 'FAB-PTB': 40, 'FAB-PH200': 40, 'FAB-PH150': 30,
  'REV-SAB': 30, 'REV-DES': 50, 'REV-INTER': 25, 'REV-PH30': 10, 'REV-COPO': 50
};

/* ---------------------------------------------------------------------- */
/* Carga                                                                  */
/* ---------------------------------------------------------------------- */

function carregarDadosDeTeste() {
  if (estadoDoTeste_()) {
    throw new Error('Os dados de teste já estão carregados. Rode apagarDadosDeTeste antes de carregar de novo.');
  }

  var criados = {};       // tabela -> [id]
  var minimosAplicados = [];

  function anotar(tabela, id) {
    if (!criados[tabela]) criados[tabela] = [];
    criados[tabela].push(id);
  }

  // Anota o progresso a cada passo: se a execução parar no meio (tempo
  // esgotado, por exemplo), a limpeza ainda sabe o que precisa remover.
  function salvarProgresso() {
    guardarEstadoDoTeste_({ criados: criados, minimos: minimosAplicados, carregadoEm: new Date().toISOString() });
  }

  function criar(tabela, valores) {
    var resposta = criar_(tabela, valores, 'Dados de teste');
    var def = TABELAS[tabela];
    anotar(tabela, resposta.registro[def.chave]);
    if (resposta.extras && resposta.extras.movimentoGerado) anotar('MOV_ESTOQUE', resposta.extras.movimentoGerado);
    salvarProgresso();
    return resposta.registro;
  }

  function movimentar(valores) {
    valores['Responsável'] = valores['Responsável'] || 'Dados de teste';
    valores['Observações'] = MARCA_TESTE + (valores['Observações'] || '');
    return criar('MOV_ESTOQUE', valores);
  }

  function inventariar(dias, classe, codigo, contagem, aprovar) {
    var inventario = criar('INVENTARIO', {
      'Data': dia_(dias), 'Classe': classe, 'Código': codigo,
      'Contagem Física': contagem, 'Responsável': 'Dados de teste',
      'Observações': MARCA_TESTE + (aprovar ? 'Contagem de abertura' : 'Contagem de conferência')
    });
    if (aprovar) {
      var ajuste = aprovarAjusteInventario(inventario['ID Inventário'], 'Dados de teste');
      anotar('MOV_ESTOQUE', ajuste.movimento['ID Movimento']);
      salvarProgresso();
    }
    return inventario;
  }

  _adiarRecalculo = true; // recalcula uma vez só, no fim
  try {
    // 1. Cadastros: reaproveita o que existe, cria o que falta
    CATALOGO_PRODUTOS.forEach(function (p) {
      if (!buscarPorId('CAD_PRODUTOS', p['Código'])) criar('CAD_PRODUTOS', p);
    });
    CATALOGO_INSUMOS.forEach(function (i) {
      if (!buscarPorId('CAD_INSUMOS', i['Código'])) criar('CAD_INSUMOS', i);
    });
    CLIENTES_TESTE.forEach(function (c) { criar('CAD_CLIENTES', c); });
    FORNECEDORES_TESTE.forEach(function (f) { criar('CAD_FORNECEDORES', f); });

    // 2. Estoque de abertura por inventário: é o jeito rastreável de lançar
    //    o que já existia no depósito antes do sistema.
    inventariar(-40, 'Insumo', 'MP-BOB-LEN', 150, true);
    inventariar(-40, 'Insumo', 'EMB-LEN', 300, true);

    // 3. Compras (cada uma gera sua entrada em MOV_ESTOQUE sozinha)
    var compras = [
      [-38, 'TESTE-FOR-01', '000463', 'Matéria-prima', 'Insumo',  'MP-BOB-PH',  2500, 5.90],
      [-37, 'TESTE-FOR-01', '000471', 'Matéria-prima', 'Insumo',  'MP-BOB-LEN',  400, 6.80],
      [-36, 'TESTE-FOR-01', '000472', 'Matéria-prima', 'Insumo',  'MP-BOB-PT',  1400, 6.20],
      [-35, 'TESTE-FOR-02', '001182', 'Matéria-prima', 'Insumo',  'MP-TUB-01',  5000, 0.18],
      [-34, 'TESTE-FOR-03', '002231', 'Embalagem',     'Insumo',  'EMB-PH300',   800, 0.95],
      [-33, 'TESTE-FOR-04', '005540', 'Revenda',       'Produto', 'REV-SAB',     120, 7.50],
      [-33, 'TESTE-FOR-04', '005541', 'Revenda',       'Produto', 'REV-DES',     200, 4.20],
      [-31, 'TESTE-FOR-05', '088120', 'Revenda',       'Produto', 'REV-COPO',    300, 3.10],
      [-31, 'TESTE-FOR-05', '088121', 'Revenda',       'Produto', 'REV-INTER',    50, 38.00],
      [-16, 'TESTE-FOR-01', '000512', 'Matéria-prima', 'Insumo',  'MP-BOB-PH',  1500, 6.05]
    ];
    compras.forEach(function (c) {
      criar('COMPRAS', {
        'Data': dia_(c[0]), 'Fornecedor': c[1], 'NF': c[2], 'Tipo Compra': c[3],
        'Classe': c[4], 'Código Item': c[5], 'Quantidade': c[6], 'Valor Unit.': c[7],
        'Observações': MARCA_TESTE + 'Compra de teste'
      });
    });

    // 4. Pedidos em todas as situações, alguns atrasados
    var pedidos = {};
    var listaPedidos = [
      ['p01', -30, 'TESTE-CLI-01', 'FAB-LEN',   40, 28.00, -24, 'Entregue',               'Licitação'],
      ['p02', -28, 'TESTE-CLI-02', 'FAB-PH300', 60, 95.00, -20, 'Entregue',               'Licitação'],
      ['p03', -25, 'TESTE-CLI-04', 'REV-SAB',   40, 12.00, -21, 'Entregue',               'WhatsApp'],
      ['p04', -22, 'TESTE-CLI-03', 'REV-INTER', 30, 52.00, -18, 'Entregue',               'Telefone'],
      ['p05', -18, 'TESTE-CLI-05', 'FAB-PH200', 25, 70.00, -12, 'Entregue',               'E-mail'],
      ['p06', -15, 'TESTE-CLI-04', 'REV-DES',   80,  7.00, -10, 'Entregue',               'WhatsApp'],
      ['p07', -12, 'TESTE-CLI-01', 'FAB-PTB',   30, 72.00,  -5, 'Separado',               'Licitação'],
      ['p08',  -8, 'TESTE-CLI-02', 'FAB-PH300', 50, 95.00,  -2, 'Em produção',            'Licitação'],
      ['p09',  -6, 'TESTE-CLI-03', 'REV-COPO',  60,  5.50,   2, 'Pronto',                 'Telefone'],
      ['p10',  -4, 'TESTE-CLI-05', 'FAB-PH150', 20, 58.00,   6, 'Programado',             'E-mail'],
      ['p11',  -2, 'TESTE-CLI-04', 'REV-PH30',  15, 62.00,   8, 'Aguardando programação', 'WhatsApp'],
      ['p12',  -1, 'TESTE-CLI-01', 'FAB-LEN',   30, 28.00,  10, 'Recebido',               'Presencial'],
      ['p13',  -9, 'TESTE-CLI-05', 'REV-SAB',   10, 12.00,  -3, 'Cancelado',              'WhatsApp']
    ];
    listaPedidos.forEach(function (p) {
      pedidos[p[0]] = criar('PEDIDOS', {
        'Data': dia_(p[1]), 'Cliente': p[2], 'Produto': p[3], 'Quantidade': p[4],
        'Valor Unit.': p[5], 'Prazo / Data Entrega': dia_(p[6]), 'Status': p[7], 'Origem comercial': p[8]
      });
    });

    // 5. Produção. Concluída = entrada do produto acabado + saída da bobina
    //    consumida, lançadas em MOV_ESTOQUE como a usuária faria hoje.
    var producoes = [
      [-29, 'FAB-PH300', 120, 112, 18, 8, 4, 820, 'MP-BOB-PH',  'Concluída',   ''],
      [-27, 'FAB-LEN',    60,  58,  6, 6, 3,  95, 'MP-BOB-LEN', 'Concluída',   ''],
      [-24, 'FAB-PTB',    80,  74, 11, 7, 3, 460, 'MP-BOB-PT',  'Concluída',   ''],
      [-21, 'FAB-PH200', 100,  96, 12, 8, 4, 520, 'MP-BOB-PH',  'Concluída',   ''],
      [-17, 'FAB-PH150',  90,  81, 15, 7, 4, 380, 'MP-BOB-PH',  'Concluída',   ''],
      [-13, 'FAB-PH300', 120, 118,  9, 8, 4, 850, 'MP-BOB-PH',  'Concluída',   ''],
      [-10, 'FAB-LEN',    60,  49, 14, 6, 3,  88, 'MP-BOB-LEN', 'Concluída',   ''],
      [ -6, 'FAB-PTB',    80,   0,  0, 2, 3,  '', '',           'Parada',      ''],
      [ -2, 'FAB-PH300', 120,  60,  4, 4, 4,  '', '',           'Em produção', 'p08'],
      [  0, 'FAB-PH200', 100,  '', '', '', '', '', '',          'Planejada',   '']
    ];
    producoes.forEach(function (p) {
      var producao = criar('PRODUCAO', {
        'Data': dia_(p[0]), 'Produto': p[1], 'Meta': p[2], 'Produzido': p[3], 'Perdas (kg)': p[4],
        'Horas': p[5], 'Pessoas': p[6], 'MP consumida (kg)': p[7], 'Status': p[9],
        'Pedido Ref.': p[10] ? pedidos[p[10]]['ID Pedido'] : ''
      });
      if (p[9] !== 'Concluída') return;
      movimentar({
        'Data': dia_(p[0]), 'Classe': 'Produto', 'Código Item': p[1], 'Entrada/Saída': 'Entrada',
        'Origem': 'Produção', 'Quantidade': p[3], 'Documento Ref.': producao['ID Produção'],
        'Observações': 'Entrada da produção'
      });
      movimentar({
        'Data': dia_(p[0]), 'Classe': 'Insumo', 'Código Item': p[8], 'Entrada/Saída': 'Saída',
        'Origem': 'Consumo Produção', 'Quantidade': p[7], 'Documento Ref.': producao['ID Produção'],
        'Observações': 'Bobina consumida na produção'
      });
    });

    // 6. Entregas: cada pedido entregue vira uma saída de estoque
    listaPedidos.forEach(function (p) {
      if (p[7] !== 'Entregue') return;
      movimentar({
        'Data': dia_(p[6]), 'Classe': 'Produto', 'Código Item': p[3], 'Entrada/Saída': 'Saída',
        'Origem': 'Venda/Expedição', 'Quantidade': p[4], 'Documento Ref.': pedidos[p[0]]['ID Pedido'],
        'Observações': 'Expedição do pedido'
      });
    });

    // 7. Uma perda registrada, para aparecer no histórico
    movimentar({
      'Data': dia_(-8), 'Classe': 'Produto', 'Código Item': 'FAB-PH300', 'Entrada/Saída': 'Saída',
      'Origem': 'Perda', 'Quantidade': 5, 'Documento Ref.': 'OCORRÊNCIA-01',
      'Observações': 'Fardos molhados no depósito'
    });

    // 8. Inventário de conferência: um com divergência (aguardando aprovação)
    //    e um sem divergência
    inventariar(-3, 'Produto', 'FAB-PH300', saldoDoItem('FAB-PH300') - 3, false);
    inventariar(-1, 'Insumo', 'MP-TUB-01', saldoDoItem('MP-TUB-01'), false);
  } finally {
    _adiarRecalculo = false;
  }

  // 9. Estoque recalculado uma vez e mínimos aplicados onde ainda não havia
  recalcularEstoque();
  listar('ESTOQUE_ATUAL').forEach(function (linha) {
    var codigo = textoLimpo_(linha['Código']);
    if (!MINIMOS_TESTE.hasOwnProperty(codigo)) return;
    if (linha['Estoque Mín.'] !== '' && linha['Estoque Mín.'] !== undefined) return;
    definirEstoqueMinimo(codigo, MINIMOS_TESTE[codigo]);
    minimosAplicados.push(codigo);
  });
  salvarProgresso();

  var resumo = resumoDoTeste_(criados);
  Logger.log('Dados de teste carregados.\n' + resumo);
  return resumo;
}

/* ---------------------------------------------------------------------- */
/* Limpeza                                                                */
/* ---------------------------------------------------------------------- */

function apagarDadosDeTeste() {
  var estado = estadoDoTeste_();
  if (!estado) return 'Não há dados de teste carregados.';

  // Ordem: primeiro o que depende dos cadastros, depois os cadastros.
  var ordem = ['MOV_ESTOQUE', 'INVENTARIO', 'COMPRAS', 'PRODUCAO', 'PEDIDOS',
               'CAD_CLIENTES', 'CAD_FORNECEDORES', 'CAD_PRODUTOS', 'CAD_INSUMOS'];
  var removidos = {};

  ordem.forEach(function (tabela) {
    var ids = (estado.criados && estado.criados[tabela]) || [];
    if (!ids.length) return;
    var alvo = {};
    ids.forEach(function (id) { alvo[textoLimpo_(id)] = true; });

    var chave = TABELAS[tabela].chave;
    var linhas = listar(tabela)
      .filter(function (r) { return alvo[textoLimpo_(r[chave])]; })
      .map(function (r) { return r._linha; })
      .sort(function (a, b) { return b - a; }); // de baixo para cima: não desloca as de cima

    linhas.forEach(function (linha) { excluirLinha(tabela, linha); });
    removidos[tabela] = linhas.length;
  });

  // Tira os mínimos que a carga aplicou (os que já existiam ficam)
  var minimos = estado.minimos || [];
  if (minimos.length) {
    recalcularEstoque();
    minimos.forEach(function (codigo) {
      try { definirEstoqueMinimo(codigo, ''); } catch (e) { /* item saiu do estoque */ }
    });
  }

  recalcularEstoque();
  PropertiesService.getScriptProperties().deleteProperty(CHAVE_TESTE);

  var texto = 'Dados de teste removidos: ' + Object.keys(removidos).map(function (t) {
    return t + ' (' + removidos[t] + ')';
  }).join(', ') + '.';
  Logger.log(texto);
  return texto;
}

/* ---------------------------------------------------------------------- */
/* Apoio                                                                  */
/* ---------------------------------------------------------------------- */

/** Data de hoje deslocada em dias, no formato da planilha (aaaa-mm-dd). */
function dia_(deslocamento) {
  var data = new Date();
  data.setDate(data.getDate() + deslocamento);
  return Utilities.formatDate(data, FUSO, 'yyyy-MM-dd');
}

function estadoDoTeste_() {
  var bruto = PropertiesService.getScriptProperties().getProperty(CHAVE_TESTE);
  return bruto ? JSON.parse(bruto) : null;
}

function guardarEstadoDoTeste_(estado) {
  PropertiesService.getScriptProperties().setProperty(CHAVE_TESTE, JSON.stringify(estado));
}

function resumoDoTeste_(criados) {
  return Object.keys(criados).map(function (tabela) {
    return tabela + ': ' + criados[tabela].length;
  }).join(' | ');
}
