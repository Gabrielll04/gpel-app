/* GPEL - Inventário.
   A divergência sozinha NUNCA muda o saldo. É preciso aprovar o ajuste,
   e a aprovação gera uma movimentação rastreável em MOV_ESTOQUE. */

window.GPEL = window.GPEL || {};
GPEL.telas = GPEL.telas || {};

GPEL.telas.inventario = (function () {
  var ui = GPEL.ui;
  var el = ui.el;
  var TABELA = 'INVENTARIO';

  var CAMPOS = [
    { nome: 'Data' },
    { nome: 'Classe' },
    { nome: 'Código', rotulo: 'Item' },
    { nome: 'Item' },
    { nome: 'Saldo Sistema', rotulo: 'Saldo no sistema' },
    { nome: 'Contagem Física', rotulo: 'Contagem física' },
    { nome: 'Diferença' },
    { nome: 'Responsável' },
    { nome: 'Observações' }
  ];

  function registros() { return GPEL.estado.tabela(TABELA); }

  function pendente(inventario) {
    return String(inventario['Ajuste?']) === 'Sim' && !inventario._ajusteAprovado;
  }

  function seloDe(inventario) {
    if (inventario._ajusteAprovado) return ui.selo('ajuste aprovado', 'ok');
    if (String(inventario['Ajuste?']) === 'Sim') return ui.selo('ajuste pendente', 'atencao');
    return ui.selo('sem divergência', 'neutro');
  }

  function novo(valoresIniciais) {
    GPEL.formulario.abrir({
      titulo: 'Nova contagem',
      tabela: TABELA,
      campos: CAMPOS,
      valores: Object.assign({ Data: ui.hoje(), 'Responsável': GPEL.api.usuario() }, valoresIniciais || {}),
      rotuloSalvar: 'Salvar contagem',
      extra: el('div', { class: 'aviso-configuracao', style: 'margin:0', texto: 'Salvar a contagem não altera o saldo. Se houver diferença, é preciso aprovar o ajuste depois.' }),
      aoSalvar: function (valores) {
        return GPEL.recurso.salvarNovo(TABELA, valores, 'Contagem registrada.');
      }
    });
  }

  function aprovar(inventario) {
    ui.fecharPainel();
    var diferenca = Number(inventario['Diferença']) || 0;
    ui.confirmar(
      'Aprovar ajuste',
      'Será criada uma movimentação de ' + (diferenca > 0 ? 'entrada' : 'saída') + ' de ' +
      ui.numero(Math.abs(diferenca), 2) + ' para "' + (inventario['Item'] || inventario['Código']) +
      '", deixando o saldo igual à contagem física. Essa movimentação fica registrada no histórico.',
      'Aprovar ajuste'
    ).then(function (confirmado) {
      if (!confirmado) return;
      ui.carregando(true);
      GPEL.api.aprovarAjuste(inventario['ID Inventário'])
        .then(function () {
          ui.aviso('Ajuste aprovado e estoque atualizado.', 'ok');
          return GPEL.estado.atualizar();
        })
        .catch(function (erro) { ui.aviso(erro.message, 'erro'); })
        .finally(function () { ui.carregando(false); });
    });
  }

  function abrirDetalhe(inventario) {
    var acoes = [];
    if (pendente(inventario)) {
      acoes.push(el('button', { class: 'botao', type: 'button', texto: 'Aprovar ajuste', onclick: function () { aprovar(inventario); } }));
    }
    acoes.push(el('button', {
      class: 'botao botao--fantasma', type: 'button', texto: 'Ver histórico do item',
      onclick: function () { ui.fecharPainel(); window.location.hash = '#/movimentos?codigo=' + encodeURIComponent(inventario['Código']); }
    }));

    GPEL.recurso.detalhe('Contagem', [
      ['Data', ui.data(inventario['Data'])],
      ['Item', inventario['Item'] || inventario['Código']],
      ['Classe', inventario['Classe']],
      ['Saldo no sistema (na contagem)', ui.numero(inventario['Saldo Sistema'], 2)],
      ['Saldo no sistema (agora)', ui.numero(GPEL.estado.saldoDe(inventario['Código']), 2)],
      ['Contagem física', ui.numero(inventario['Contagem Física'], 2)],
      ['Diferença', ui.numero(inventario['Diferença'], 2)],
      ['Responsável', inventario['Responsável'] || '—'],
      ['Observações', inventario['Observações'] || '—'],
      ['Situação', seloDe(inventario)]
    ], acoes);
  }

  function cartao(inventario) {
    return ui.cartao({
      titulo: inventario['Item'] || inventario['Código'],
      meta: ui.data(inventario['Data']) + ' · ' + (inventario['Responsável'] || 'sem responsável'),
      selo: seloDe(inventario),
      linhas: [
        ['Sistema', ui.numero(inventario['Saldo Sistema'], 2)],
        ['Contagem', ui.numero(inventario['Contagem Física'], 2)],
        ['Diferença', ui.numero(inventario['Diferença'], 2)]
      ],
      aoClicar: function () { abrirDetalhe(inventario); }
    });
  }

  return {
    titulo: 'Inventário',
    subtitulo: 'Contagem física e aprovação de ajustes',
    novo: novo,
    acoes: function () { return [GPEL.recurso.botaoNovo('+ Contagem', function () { novo(); })]; },
    render: function () {
      var pendentes = registros().filter(pendente).length;
      var alerta = pendentes
        ? el('div', { class: 'aviso-configuracao', texto: pendentes + (pendentes === 1 ? ' contagem está' : ' contagens estão') + ' com diferença aguardando aprovação de ajuste.' })
        : null;

      return el('div', {}, [
        alerta,
        GPEL.recurso.lista({
          registros: registros,
          vazio: 'Nenhuma contagem registrada.',
          placeholderBusca: 'Buscar item ou responsável…',
          busca: function (i) { return [i['Item'], i['Código'], i['Responsável']].join(' '); },
          filtros: [
            { rotulo: 'Todas', teste: null },
            { rotulo: 'Ajuste pendente', teste: pendente },
            { rotulo: 'Ajustadas', teste: function (i) { return !!i._ajusteAprovado; } },
            { rotulo: 'Sem diferença', teste: function (i) { return String(i['Ajuste?']) !== 'Sim'; } }
          ],
          ordenar: function (a, b) { return String(b['Data']).localeCompare(String(a['Data'])); },
          cartao: cartao,
          aoAbrir: abrirDetalhe,
          colunas: [
            { rotulo: 'Data', valor: function (i) { return ui.data(i['Data']); } },
            { rotulo: 'Item', valor: function (i) { return i['Item'] || i['Código']; } },
            { rotulo: 'Sistema', numerico: true, valor: function (i) { return ui.numero(i['Saldo Sistema'], 2); } },
            { rotulo: 'Contagem', numerico: true, valor: function (i) { return ui.numero(i['Contagem Física'], 2); } },
            { rotulo: 'Diferença', numerico: true, valor: function (i) { return ui.numero(i['Diferença'], 2); } },
            { rotulo: 'Responsável', valor: function (i) { return i['Responsável']; } },
            { rotulo: 'Situação', valor: seloDe }
          ]
        })
      ]);
    }
  };
})();
