/* GPEL - Pedidos. */

window.GPEL = window.GPEL || {};
GPEL.telas = GPEL.telas || {};

GPEL.telas.pedidos = (function () {
  var ui = GPEL.ui;
  var el = ui.el;
  var TABELA = 'PEDIDOS';

  var CAMPOS = [
    { nome: 'Data' },
    { nome: 'Cliente' },
    { nome: 'Produto' },
    { nome: 'Quantidade', exemplo: '0' },
    { nome: 'Valor Unit.', rotulo: 'Valor unitário (R$)', exemplo: '0,00' },
    { nome: 'Valor Total' },
    { nome: 'Unidade' },
    { nome: 'Prazo / Data Entrega', rotulo: 'Entrega' },
    { nome: 'Status', rotulo: 'Situação' },
    { nome: 'Origem comercial', ajuda: 'Como o pedido chegou até a GPEL.' }
  ];

  var ENCERRADOS = ['Entregue', 'Cancelado'];

  function emAberto(pedido) { return ENCERRADOS.indexOf(String(pedido['Status'])) === -1; }

  function atrasado(pedido) {
    if (!emAberto(pedido) || !pedido['Prazo / Data Entrega']) return false;
    return String(pedido['Prazo / Data Entrega']).slice(0, 10) < ui.hoje();
  }

  function registros() {
    return GPEL.estado.tabela(TABELA);
  }

  function novo(valoresIniciais) {
    GPEL.formulario.abrir({
      titulo: 'Novo pedido',
      tabela: TABELA,
      campos: CAMPOS,
      valores: Object.assign({ Data: ui.hoje(), Status: 'Recebido' }, valoresIniciais || {}),
      rotuloSalvar: 'Salvar pedido',
      aoSalvar: function (valores) {
        return GPEL.recurso.salvarNovo(TABELA, valores, 'Pedido registrado.');
      }
    });
  }

  function editar(pedido) {
    ui.fecharPainel();
    GPEL.formulario.abrir({
      titulo: 'Editar pedido',
      tabela: TABELA,
      campos: CAMPOS,
      valores: pedido,
      aoSalvar: function (valores) {
        return GPEL.recurso.salvarEdicao(TABELA, pedido['ID Pedido'], valores, 'Pedido atualizado.');
      }
    });
  }

  /** Troca rápida de situação, sem abrir o formulário inteiro. */
  function mudarStatus(pedido) {
    ui.fecharPainel();
    var selecao = el('select', {});
    GPEL.estado.enumDe('STATUS_PEDIDO').forEach(function (status) {
      var opcao = el('option', { value: status, texto: status });
      if (status === pedido['Status']) opcao.selected = true;
      selecao.appendChild(opcao);
    });

    var conteudo = el('div', {}, [
      el('div', { class: 'campo' }, [el('label', { texto: 'Situação do pedido' }), selecao]),
      el('div', { class: 'formulario__acoes', style: 'margin-top:16px' }, [
        el('button', { class: 'botao botao--fantasma', type: 'button', texto: 'Cancelar', onclick: ui.fecharPainel }),
        el('button', {
          class: 'botao', type: 'button', texto: 'Salvar',
          onclick: function () {
            ui.carregando(true);
            GPEL.recurso.salvarEdicao(TABELA, pedido['ID Pedido'], Object.assign({}, pedido, { 'Status': selecao.value }), 'Situação atualizada.')
              .then(function () { ui.fecharPainel(); })
              .catch(function (erro) { ui.aviso(erro.message, 'erro'); })
              .finally(function () { ui.carregando(false); });
          }
        })
      ])
    ]);
    ui.abrirPainel('Situação do pedido', conteudo);
  }

  function abrirDetalhe(pedido) {
    GPEL.recurso.detalhe('Pedido', [
      ['Cliente', GPEL.estado.rotuloDe('CAD_CLIENTES', pedido['Cliente'])],
      ['Produto', GPEL.estado.rotuloDe('CAD_PRODUTOS', pedido['Produto'])],
      ['Quantidade', ui.numero(pedido['Quantidade'], 2) + ' ' + (pedido['Unidade'] || '')],
      ['Valor unitário', ui.dinheiro(pedido['Valor Unit.'])],
      ['Valor total', ui.dinheiro(pedido['Valor Total'])],
      ['Data do pedido', ui.data(pedido['Data'])],
      ['Entrega', ui.data(pedido['Prazo / Data Entrega']) + (atrasado(pedido) ? ' (em atraso)' : '')],
      ['Origem', pedido['Origem comercial'] || '—'],
      ['Situação', ui.selo(pedido['Status'])]
    ], [
      el('button', { class: 'botao botao--fantasma', type: 'button', texto: 'Editar', onclick: function () { editar(pedido); } }),
      el('button', { class: 'botao', type: 'button', texto: 'Mudar situação', onclick: function () { mudarStatus(pedido); } })
    ]);
  }

  function cartao(pedido) {
    return ui.cartao({
      titulo: GPEL.estado.rotuloDe('CAD_CLIENTES', pedido['Cliente']),
      meta: GPEL.estado.rotuloDe('CAD_PRODUTOS', pedido['Produto']),
      selo: ui.selo(pedido['Status']),
      linhas: [
        ['Quantidade', ui.numero(pedido['Quantidade'], 2) + ' ' + (pedido['Unidade'] || '')],
        ['Valor total', ui.dinheiro(pedido['Valor Total'])],
        ['Entrega', atrasado(pedido)
          ? ui.selo(ui.data(pedido['Prazo / Data Entrega']) + ' · atrasado', 'erro')
          : ui.data(pedido['Prazo / Data Entrega'])]
      ],
      aoClicar: function () { abrirDetalhe(pedido); }
    });
  }

  return {
    titulo: 'Pedidos',
    subtitulo: 'Do recebimento até a entrega',
    novo: novo,
    acoes: function () { return [GPEL.recurso.botaoNovo('+ Pedido', function () { novo(); })]; },
    render: function () {
      return GPEL.recurso.lista({
        registros: registros,
        vazio: 'Nenhum pedido encontrado.',
        placeholderBusca: 'Buscar por cliente ou produto…',
        busca: function (p) {
          return GPEL.estado.rotuloDe('CAD_CLIENTES', p['Cliente']) + ' ' + GPEL.estado.rotuloDe('CAD_PRODUTOS', p['Produto']);
        },
        filtros: [
          { rotulo: 'Em aberto', teste: emAberto },
          { rotulo: 'Atrasados', teste: atrasado },
          { rotulo: 'Entregues', teste: function (p) { return p['Status'] === 'Entregue'; } },
          { rotulo: 'Todos', teste: null }
        ],
        ordenar: function (a, b) { return String(b['Data']).localeCompare(String(a['Data'])); },
        cartao: cartao,
        aoAbrir: abrirDetalhe,
        colunas: [
          { rotulo: 'Data', valor: function (p) { return ui.data(p['Data']); } },
          { rotulo: 'Cliente', valor: function (p) { return GPEL.estado.rotuloDe('CAD_CLIENTES', p['Cliente']); } },
          { rotulo: 'Produto', valor: function (p) { return GPEL.estado.rotuloDe('CAD_PRODUTOS', p['Produto']); } },
          { rotulo: 'Qtde', numerico: true, valor: function (p) { return ui.numero(p['Quantidade'], 2); } },
          { rotulo: 'Total', numerico: true, valor: function (p) { return ui.dinheiro(p['Valor Total']); } },
          { rotulo: 'Entrega', valor: function (p) { return atrasado(p) ? ui.selo(ui.data(p['Prazo / Data Entrega']) + ' · atrasado', 'erro') : ui.data(p['Prazo / Data Entrega']); } },
          { rotulo: 'Situação', valor: function (p) { return ui.selo(p['Status']); } }
        ]
      });
    },
    emAberto: emAberto,
    atrasado: atrasado
  };
})();
