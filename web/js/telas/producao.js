/* GPEL - Produção (apontamento diário). */

window.GPEL = window.GPEL || {};
GPEL.telas = GPEL.telas || {};

GPEL.telas.producao = (function () {
  var ui = GPEL.ui;
  var el = ui.el;
  var TABELA = 'PRODUCAO';

  var CAMPOS = [
    { nome: 'Data' },
    { nome: 'Produto', ajuda: 'Apenas produtos de fabricação própria.' },
    { nome: 'Meta', ajuda: 'Quanto era esperado produzir.' },
    { nome: 'Produzido' },
    { nome: 'Perdas (kg)' },
    { nome: 'Horas', ajuda: 'Horas trabalhadas no turno.' },
    { nome: 'Pessoas', ajuda: 'Quantas pessoas trabalharam.' },
    { nome: 'Prod./h' },
    { nome: 'Prod./HH' },
    { nome: 'Unidade' },
    { nome: 'MP consumida (kg)', rotulo: 'Matéria-prima consumida (kg)', ajuda: 'Opcional, enquanto a medição não for confiável.' },
    { nome: 'Status', rotulo: 'Situação' },
    { nome: 'Pedido Ref.', rotulo: 'Pedido relacionado', ajuda: 'Opcional.' }
  ];

  function registros() { return GPEL.estado.tabela(TABELA); }

  function atingimento(producao) {
    var meta = Number(producao['Meta']) || 0;
    if (meta <= 0) return null;
    return (Number(producao['Produzido']) || 0) / meta;
  }

  function novo(valoresIniciais) {
    GPEL.formulario.abrir({
      titulo: 'Registrar produção',
      tabela: TABELA,
      campos: CAMPOS,
      valores: Object.assign({ Data: ui.hoje(), Status: 'Planejada', 'Perdas (kg)': 0 }, valoresIniciais || {}),
      rotuloSalvar: 'Salvar produção',
      aoSalvar: function (valores) {
        return GPEL.recurso.salvarNovo(TABELA, valores, 'Produção registrada.');
      }
    });
  }

  function editar(producao) {
    ui.fecharPainel();
    GPEL.formulario.abrir({
      titulo: 'Editar produção',
      tabela: TABELA,
      campos: CAMPOS,
      valores: producao,
      aoSalvar: function (valores) {
        return GPEL.recurso.salvarEdicao(TABELA, producao['ID Produção'], valores, 'Produção atualizada.');
      }
    });
  }

  function abrirDetalhe(producao) {
    var meta = atingimento(producao);
    GPEL.recurso.detalhe('Produção', [
      ['Data', ui.data(producao['Data'])],
      ['Produto', GPEL.estado.rotuloDe('CAD_PRODUTOS', producao['Produto'])],
      ['Meta', ui.numero(producao['Meta'], 2) + ' ' + (producao['Unidade'] || '')],
      ['Produzido', ui.numero(producao['Produzido'], 2) + ' ' + (producao['Unidade'] || '')],
      meta !== null ? ['Atingimento', ui.numero(meta * 100, 1) + '%'] : null,
      ['Perdas', ui.numero(producao['Perdas (kg)'], 2) + ' kg'],
      ['Horas', ui.numero(producao['Horas'], 2)],
      ['Pessoas', ui.numero(producao['Pessoas'], 0)],
      ['Produção por hora', ui.numero(producao['Prod./h'], 2)],
      ['Produção por hora/pessoa', ui.numero(producao['Prod./HH'], 2)],
      ['Matéria-prima consumida', producao['MP consumida (kg)'] === '' ? '—' : ui.numero(producao['MP consumida (kg)'], 2) + ' kg'],
      ['Pedido relacionado', producao['Pedido Ref.'] || '—'],
      ['Situação', ui.selo(producao['Status'])]
    ], [
      el('button', { class: 'botao', type: 'button', texto: 'Editar', onclick: function () { editar(producao); } })
    ]);
  }

  function cartao(producao) {
    var meta = atingimento(producao);
    return ui.cartao({
      titulo: GPEL.estado.rotuloDe('CAD_PRODUTOS', producao['Produto']),
      meta: ui.data(producao['Data']),
      selo: ui.selo(producao['Status']),
      linhas: [
        ['Produzido', ui.numero(producao['Produzido'], 2) + ' ' + (producao['Unidade'] || '')],
        meta !== null ? ['Meta', ui.numero(meta * 100, 0) + '% de ' + ui.numero(producao['Meta'], 2)] : null,
        ['Prod./h', ui.numero(producao['Prod./h'], 2)],
        ['Prod./HH', ui.numero(producao['Prod./HH'], 2)],
        ['Perdas', ui.numero(producao['Perdas (kg)'], 2) + ' kg']
      ],
      aoClicar: function () { abrirDetalhe(producao); }
    });
  }

  return {
    titulo: 'Produção',
    subtitulo: 'Apontamento de turno e produtividade',
    novo: novo,
    acoes: function () { return [GPEL.recurso.botaoNovo('+ Produção', function () { novo(); })]; },
    render: function () {
      return GPEL.recurso.lista({
        registros: registros,
        vazio: 'Nenhuma produção registrada.',
        placeholderBusca: 'Buscar por produto…',
        busca: function (p) { return GPEL.estado.rotuloDe('CAD_PRODUTOS', p['Produto']); },
        filtros: [
          { rotulo: 'Todas', teste: null },
          { rotulo: 'Em produção', teste: function (p) { return p['Status'] === 'Em produção'; } },
          { rotulo: 'Concluídas', teste: function (p) { return p['Status'] === 'Concluída'; } },
          { rotulo: 'Planejadas', teste: function (p) { return p['Status'] === 'Planejada'; } }
        ],
        ordenar: function (a, b) { return String(b['Data']).localeCompare(String(a['Data'])); },
        cartao: cartao,
        aoAbrir: abrirDetalhe,
        colunas: [
          { rotulo: 'Data', valor: function (p) { return ui.data(p['Data']); } },
          { rotulo: 'Produto', valor: function (p) { return GPEL.estado.rotuloDe('CAD_PRODUTOS', p['Produto']); } },
          { rotulo: 'Meta', numerico: true, valor: function (p) { return ui.numero(p['Meta'], 2); } },
          { rotulo: 'Produzido', numerico: true, valor: function (p) { return ui.numero(p['Produzido'], 2); } },
          { rotulo: 'Perdas (kg)', numerico: true, valor: function (p) { return ui.numero(p['Perdas (kg)'], 2); } },
          { rotulo: 'Horas', numerico: true, valor: function (p) { return ui.numero(p['Horas'], 2); } },
          { rotulo: 'Pessoas', numerico: true, valor: function (p) { return ui.numero(p['Pessoas'], 0); } },
          { rotulo: 'Prod./h', numerico: true, valor: function (p) { return ui.numero(p['Prod./h'], 2); } },
          { rotulo: 'Prod./HH', numerico: true, valor: function (p) { return ui.numero(p['Prod./HH'], 2); } },
          { rotulo: 'Situação', valor: function (p) { return ui.selo(p['Status']); } }
        ]
      });
    }
  };
})();
