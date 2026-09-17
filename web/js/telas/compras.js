/* GPEL - Compras.
   Ao salvar uma compra nova, o sistema gera automaticamente UMA entrada em
   MOV_ESTOQUE. Editar a compra depois não gera outra entrada. */

window.GPEL = window.GPEL || {};
GPEL.telas = GPEL.telas || {};

GPEL.telas.compras = (function () {
  var ui = GPEL.ui;
  var el = ui.el;
  var TABELA = 'COMPRAS';

  var CAMPOS = [
    { nome: 'Data' },
    { nome: 'NF', rotulo: 'Nota fiscal', ajuda: 'Pode começar com zero. Deixe em branco se não houver.' },
    { nome: 'Fornecedor' },
    { nome: 'Tipo Compra', rotulo: 'Tipo de compra' },
    { nome: 'Classe', ajuda: 'Produto (revenda) ou Insumo (matéria-prima, embalagem).' },
    { nome: 'Código Item', rotulo: 'Item' },
    { nome: 'Item' },
    { nome: 'Unidade' },
    { nome: 'Quantidade' },
    { nome: 'Valor Unit.', rotulo: 'Valor unitário (R$)' },
    { nome: 'Valor Total' },
    { nome: 'Observações' }
  ];

  function registros() { return GPEL.estado.tabela(TABELA); }

  function novo(valoresIniciais) {
    GPEL.formulario.abrir({
      titulo: 'Nova compra',
      tabela: TABELA,
      campos: CAMPOS,
      valores: Object.assign({ Data: ui.hoje(), Classe: 'Insumo' }, valoresIniciais || {}),
      rotuloSalvar: 'Salvar compra',
      extra: el('div', { class: 'aviso-configuracao', style: 'margin:0' , texto: 'Ao salvar, a entrada no estoque é feita automaticamente.' }),
      aoSalvar: function (valores) {
        return GPEL.recurso.salvarNovo(TABELA, valores, 'Compra registrada e estoque atualizado.');
      }
    });
  }

  function editar(compra) {
    ui.fecharPainel();
    GPEL.formulario.abrir({
      titulo: 'Editar compra',
      tabela: TABELA,
      campos: CAMPOS,
      valores: compra,
      extra: el('div', { class: 'aviso-configuracao', style: 'margin:0', texto: 'A entrada de estoque desta compra já foi feita e não será repetida. Para corrigir quantidade no estoque, registre uma movimentação de ajuste.' }),
      aoSalvar: function (valores) {
        return GPEL.recurso.salvarEdicao(TABELA, compra['ID Compra'], valores, 'Compra atualizada.');
      }
    });
  }

  function abrirDetalhe(compra) {
    GPEL.recurso.detalhe('Compra', [
      ['Data', ui.data(compra['Data'])],
      ['Nota fiscal', compra['NF'] || '—'],
      ['Fornecedor', GPEL.estado.rotuloDe('CAD_FORNECEDORES', compra['Fornecedor'])],
      ['Tipo', compra['Tipo Compra']],
      ['Item', compra['Item'] || compra['Código Item']],
      ['Quantidade', ui.numero(compra['Quantidade'], 2) + ' ' + (compra['Unidade'] || '')],
      ['Valor unitário', ui.dinheiro(compra['Valor Unit.'])],
      ['Valor total', ui.dinheiro(compra['Valor Total'])],
      ['Entrada no estoque', compra['Mov. Gerado'] ? ui.selo('registrada', 'ok') : ui.selo('não registrada', 'atencao')],
      ['Observações', compra['Observações'] || '—']
    ], [
      el('button', { class: 'botao botao--fantasma', type: 'button', texto: 'Editar', onclick: function () { editar(compra); } }),
      el('button', {
        class: 'botao', type: 'button', texto: 'Ver no estoque',
        onclick: function () { ui.fecharPainel(); window.location.hash = '#/movimentos?codigo=' + encodeURIComponent(compra['Código Item']); }
      })
    ]);
  }

  function cartao(compra) {
    return ui.cartao({
      titulo: compra['Item'] || compra['Código Item'],
      meta: GPEL.estado.rotuloDe('CAD_FORNECEDORES', compra['Fornecedor']) + ' · ' + ui.data(compra['Data']),
      selo: ui.selo(compra['Tipo Compra'], 'neutro'),
      linhas: [
        ['Quantidade', ui.numero(compra['Quantidade'], 2) + ' ' + (compra['Unidade'] || '')],
        ['Valor total', ui.dinheiro(compra['Valor Total'])],
        ['Nota fiscal', compra['NF'] || '—']
      ],
      aoClicar: function () { abrirDetalhe(compra); }
    });
  }

  return {
    titulo: 'Compras',
    subtitulo: 'Entradas de insumos e revenda',
    novo: novo,
    acoes: function () { return [GPEL.recurso.botaoNovo('+ Compra', function () { novo(); })]; },
    render: function () {
      return GPEL.recurso.lista({
        registros: registros,
        vazio: 'Nenhuma compra registrada.',
        placeholderBusca: 'Buscar por item, fornecedor ou NF…',
        busca: function (c) {
          return [c['Item'], c['NF'], GPEL.estado.rotuloDe('CAD_FORNECEDORES', c['Fornecedor'])].join(' ');
        },
        filtros: [
          { rotulo: 'Todas', teste: null },
          { rotulo: 'Matéria-prima', teste: function (c) { return c['Tipo Compra'] === 'Matéria-prima'; } },
          { rotulo: 'Embalagem', teste: function (c) { return c['Tipo Compra'] === 'Embalagem'; } },
          { rotulo: 'Revenda', teste: function (c) { return c['Tipo Compra'] === 'Revenda'; } }
        ],
        ordenar: function (a, b) { return String(b['Data']).localeCompare(String(a['Data'])); },
        cartao: cartao,
        aoAbrir: abrirDetalhe,
        colunas: [
          { rotulo: 'Data', valor: function (c) { return ui.data(c['Data']); } },
          { rotulo: 'NF', valor: function (c) { return c['NF']; } },
          { rotulo: 'Fornecedor', valor: function (c) { return GPEL.estado.rotuloDe('CAD_FORNECEDORES', c['Fornecedor']); } },
          { rotulo: 'Item', valor: function (c) { return c['Item'] || c['Código Item']; } },
          { rotulo: 'Qtde', numerico: true, valor: function (c) { return ui.numero(c['Quantidade'], 2); } },
          { rotulo: 'Unitário', numerico: true, valor: function (c) { return ui.dinheiro(c['Valor Unit.']); } },
          { rotulo: 'Total', numerico: true, valor: function (c) { return ui.dinheiro(c['Valor Total']); } },
          { rotulo: 'Estoque', valor: function (c) { return c['Mov. Gerado'] ? ui.selo('ok', 'ok') : ui.selo('pendente', 'atencao'); } }
        ]
      });
    }
  };
})();
