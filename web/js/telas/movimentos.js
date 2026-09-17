/* GPEL - Histórico de movimentações (MOV_ESTOQUE).
   Tela de referência: chega-se a ela pelo item em Estoque.
   Movimentação não se edita nem se apaga — correção é uma nova movimentação. */

window.GPEL = window.GPEL || {};
GPEL.telas = GPEL.telas || {};

GPEL.telas.movimentos = (function () {
  var ui = GPEL.ui;
  var el = ui.el;
  var TABELA = 'MOV_ESTOQUE';

  var CAMPOS = [
    { nome: 'Data' },
    { nome: 'Classe' },
    { nome: 'Código Item', rotulo: 'Item' },
    { nome: 'Item' },
    { nome: 'Entrada/Saída', rotulo: 'Tipo' },
    { nome: 'Origem', ajuda: 'De onde vem essa movimentação.' },
    { nome: 'Quantidade' },
    { nome: 'Unidade' },
    { nome: 'Documento Ref.', rotulo: 'Documento', ajuda: 'NF, pedido, produção ou outra referência.' },
    { nome: 'Responsável' },
    { nome: 'Observações' }
  ];

  function registros(codigo) {
    var todos = GPEL.estado.tabela(TABELA);
    if (!codigo) return todos;
    return todos.filter(function (m) { return String(m['Código Item']).trim() === String(codigo).trim(); });
  }

  function novo(valoresIniciais) {
    GPEL.formulario.abrir({
      titulo: 'Nova movimentação',
      tabela: TABELA,
      campos: CAMPOS,
      valores: Object.assign({ Data: ui.hoje(), 'Responsável': GPEL.api.usuario() }, valoresIniciais || {}),
      rotuloSalvar: 'Registrar movimentação',
      aoSalvar: function (valores) {
        return GPEL.recurso.salvarNovo(TABELA, valores, 'Movimentação registrada.');
      }
    });
  }

  function abrirDetalhe(movimento) {
    GPEL.recurso.detalhe('Movimentação', [
      ['Data', ui.data(movimento['Data'])],
      ['Item', movimento['Item'] || movimento['Código Item']],
      ['Classe', movimento['Classe']],
      ['Tipo', ui.selo(movimento['Entrada/Saída'], movimento['Entrada/Saída'] === 'Entrada' ? 'ok' : 'atencao')],
      ['Origem', movimento['Origem']],
      ['Quantidade', ui.numero(movimento['Quantidade'], 2) + ' ' + (movimento['Unidade'] || '')],
      ['Documento', movimento['Documento Ref.'] || '—'],
      ['Responsável', movimento['Responsável'] || '—'],
      ['Observações', movimento['Observações'] || '—']
    ], []);
  }

  function cartao(movimento) {
    return ui.cartao({
      titulo: movimento['Item'] || movimento['Código Item'],
      meta: ui.data(movimento['Data']) + ' · ' + movimento['Origem'],
      selo: ui.selo(movimento['Entrada/Saída'], movimento['Entrada/Saída'] === 'Entrada' ? 'ok' : 'atencao'),
      linhas: [
        ['Quantidade', (movimento['Entrada/Saída'] === 'Entrada' ? '+' : '−') + ui.numero(movimento['Quantidade'], 2) + ' ' + (movimento['Unidade'] || '')],
        ['Documento', movimento['Documento Ref.'] || '—'],
        ['Responsável', movimento['Responsável'] || '—']
      ],
      aoClicar: function () { abrirDetalhe(movimento); }
    });
  }

  return {
    titulo: 'Movimentações',
    subtitulo: 'Histórico de entradas e saídas',
    novo: novo,
    acoes: function () { return [GPEL.recurso.botaoNovo('+ Movimentação', function () { novo(); })]; },
    render: function (parametros) {
      var codigo = parametros && parametros.codigo ? parametros.codigo : '';
      var cabecalho = null;

      if (codigo) {
        var linhaEstoque = GPEL.estado.tabela('ESTOQUE_ATUAL').filter(function (l) {
          return String(l['Código']).trim() === String(codigo).trim();
        })[0];
        if (linhaEstoque) {
          cabecalho = el('div', { class: 'indicadores', style: 'margin-bottom:16px' }, [
            ui.indicador('Item', linhaEstoque['Item'] || codigo),
            ui.indicador('Saldo atual', ui.numero(linhaEstoque['Saldo Atual'], 2) + ' ' + (linhaEstoque['Unidade'] || '')),
            ui.indicador('Entradas', ui.numero(linhaEstoque['Entradas'], 2)),
            ui.indicador('Saídas', ui.numero(linhaEstoque['Saídas'], 2))
          ]);
        }
      }

      return el('div', {}, [
        cabecalho,
        GPEL.recurso.lista({
          registros: function () { return registros(codigo); },
          vazio: 'Nenhuma movimentação encontrada.',
          placeholderBusca: 'Buscar por item, documento ou responsável…',
          busca: function (m) {
            return [m['Item'], m['Código Item'], m['Documento Ref.'], m['Responsável'], m['Origem']].join(' ');
          },
          filtros: [
            { rotulo: 'Todas', teste: null },
            { rotulo: 'Entradas', teste: function (m) { return m['Entrada/Saída'] === 'Entrada'; } },
            { rotulo: 'Saídas', teste: function (m) { return m['Entrada/Saída'] === 'Saída'; } },
            { rotulo: 'Hoje', teste: function (m) { return String(m['Data']).slice(0, 10) === ui.hoje(); } }
          ],
          ordenar: function (a, b) {
            var porData = String(b['Data']).localeCompare(String(a['Data']));
            return porData !== 0 ? porData : (b._linha || 0) - (a._linha || 0);
          },
          cartao: cartao,
          aoAbrir: abrirDetalhe,
          colunas: [
            { rotulo: 'Data', valor: function (m) { return ui.data(m['Data']); } },
            { rotulo: 'Item', valor: function (m) { return m['Item'] || m['Código Item']; } },
            { rotulo: 'Tipo', valor: function (m) { return ui.selo(m['Entrada/Saída'], m['Entrada/Saída'] === 'Entrada' ? 'ok' : 'atencao'); } },
            { rotulo: 'Origem', valor: function (m) { return m['Origem']; } },
            { rotulo: 'Qtde', numerico: true, valor: function (m) { return ui.numero(m['Quantidade'], 2); } },
            { rotulo: 'Documento', valor: function (m) { return m['Documento Ref.']; } },
            { rotulo: 'Responsável', valor: function (m) { return m['Responsável']; } }
          ]
        })
      ]);
    }
  };
})();
