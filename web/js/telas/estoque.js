/* GPEL - Estoque (consulta de saldo).
   O saldo mostrado aqui é sempre a soma das movimentações: nunca é digitado. */

window.GPEL = window.GPEL || {};
GPEL.telas = GPEL.telas || {};

GPEL.telas.estoque = (function () {
  var ui = GPEL.ui;
  var el = ui.el;

  function registros() { return GPEL.estado.tabela('ESTOQUE_ATUAL'); }

  function precisaRepor(linha) { return String(linha['Status']) === 'REPOR'; }

  function definirMinimo(linha) {
    ui.fecharPainel();
    var entrada = el('input', { type: 'number', step: '0.01', inputmode: 'decimal' });
    entrada.value = linha['Estoque Mín.'] === '' ? '' : linha['Estoque Mín.'];

    var conteudo = el('div', {}, [
      el('div', { class: 'campo' }, [
        el('label', { texto: 'Estoque mínimo de ' + linha['Item'] }),
        entrada,
        el('div', { class: 'campo__ajuda', texto: 'Quando o saldo ficar igual ou abaixo desse número, o item aparece como REPOR.' })
      ]),
      el('div', { class: 'formulario__acoes', style: 'margin-top:16px' }, [
        el('button', { class: 'botao botao--fantasma', type: 'button', texto: 'Cancelar', onclick: ui.fecharPainel }),
        el('button', {
          class: 'botao', type: 'button', texto: 'Salvar',
          onclick: function () {
            ui.carregando(true);
            GPEL.api.definirEstoqueMinimo(linha['Código'], entrada.value)
              .then(function () {
                ui.aviso('Estoque mínimo atualizado.', 'ok');
                return GPEL.estado.atualizar();
              })
              .then(function () { ui.fecharPainel(); })
              .catch(function (erro) { ui.aviso(erro.message, 'erro'); })
              .finally(function () { ui.carregando(false); });
          }
        })
      ])
    ]);
    ui.abrirPainel('Estoque mínimo', conteudo);
  }

  function abrirDetalhe(linha) {
    GPEL.recurso.detalhe(linha['Item'] || linha['Código'], [
      ['Classe', linha['Classe']],
      ['Unidade', linha['Unidade'] || '—'],
      ['Entradas', ui.numero(linha['Entradas'], 2)],
      ['Saídas', ui.numero(linha['Saídas'], 2)],
      ['Saldo atual', ui.numero(linha['Saldo Atual'], 2)],
      ['Estoque mínimo', linha['Estoque Mín.'] === '' ? 'não definido' : ui.numero(linha['Estoque Mín.'], 2)],
      ['Situação', ui.selo(linha['Status'])]
    ], [
      el('button', {
        class: 'botao botao--fantasma', type: 'button', texto: 'Ver histórico',
        onclick: function () { ui.fecharPainel(); window.location.hash = '#/movimentos?codigo=' + encodeURIComponent(linha['Código']); }
      }),
      el('button', { class: 'botao botao--secundario', type: 'button', texto: 'Estoque mínimo', onclick: function () { definirMinimo(linha); } }),
      el('button', {
        class: 'botao', type: 'button', texto: 'Movimentar',
        onclick: function () {
          ui.fecharPainel();
          GPEL.telas.movimentos.novo({ 'Classe': linha['Classe'], 'Código Item': linha['Código'] });
        }
      })
    ]);
  }

  function cartao(linha) {
    return ui.cartao({
      titulo: linha['Item'] || linha['Código'],
      meta: linha['Classe'] + (linha['Unidade'] ? ' · ' + linha['Unidade'] : ''),
      selo: ui.selo(linha['Status']),
      linhas: [
        ['Saldo atual', ui.numero(linha['Saldo Atual'], 2)],
        ['Estoque mínimo', linha['Estoque Mín.'] === '' ? '—' : ui.numero(linha['Estoque Mín.'], 2)],
        ['Entradas / Saídas', ui.numero(linha['Entradas'], 2) + ' / ' + ui.numero(linha['Saídas'], 2)]
      ],
      aoClicar: function () { abrirDetalhe(linha); }
    });
  }

  return {
    titulo: 'Estoque',
    subtitulo: 'Saldo calculado pelas movimentações',
    acoes: function () {
      return [GPEL.recurso.botaoNovo('+ Movimentação', function () { GPEL.telas.movimentos.novo(); })];
    },
    render: function () {
      var linhas = registros();
      var repor = linhas.filter(precisaRepor).length;
      var semMinimo = linhas.filter(function (l) { return String(l['Status']) === 'DEFINIR MÍNIMO'; }).length;

      var resumo = el('div', { class: 'indicadores', style: 'margin-bottom:16px' }, [
        ui.indicador('Itens cadastrados', ui.numero(linhas.length, 0)),
        ui.indicador('Precisam de reposição', ui.numero(repor, 0), null, repor > 0),
        ui.indicador('Sem mínimo definido', ui.numero(semMinimo, 0)),
        ui.indicador('Movimentações', ui.numero(GPEL.estado.tabela('MOV_ESTOQUE').length, 0))
      ]);

      return el('div', {}, [
        resumo,
        GPEL.recurso.lista({
          registros: registros,
          vazio: 'Nenhum item no estoque ainda. Cadastre produtos e insumos em Administração.',
          placeholderBusca: 'Buscar item…',
          busca: function (l) { return (l['Item'] || '') + ' ' + (l['Código'] || ''); },
          filtros: [
            { rotulo: 'Todos', teste: null },
            { rotulo: 'Repor', teste: precisaRepor },
            { rotulo: 'Produtos', teste: function (l) { return l['Classe'] === 'Produto'; } },
            { rotulo: 'Insumos', teste: function (l) { return l['Classe'] === 'Insumo'; } }
          ],
          ordenar: function (a, b) {
            if (precisaRepor(a) !== precisaRepor(b)) return precisaRepor(a) ? -1 : 1;
            return String(a['Item']).localeCompare(String(b['Item']), 'pt-BR');
          },
          cartao: cartao,
          aoAbrir: abrirDetalhe,
          colunas: [
            { rotulo: 'Item', valor: function (l) { return l['Item'] || l['Código']; } },
            { rotulo: 'Classe', valor: function (l) { return l['Classe']; } },
            { rotulo: 'Unid.', valor: function (l) { return l['Unidade']; } },
            { rotulo: 'Entradas', numerico: true, valor: function (l) { return ui.numero(l['Entradas'], 2); } },
            { rotulo: 'Saídas', numerico: true, valor: function (l) { return ui.numero(l['Saídas'], 2); } },
            { rotulo: 'Saldo', numerico: true, valor: function (l) { return ui.numero(l['Saldo Atual'], 2); } },
            { rotulo: 'Mínimo', numerico: true, valor: function (l) { return l['Estoque Mín.'] === '' ? '—' : ui.numero(l['Estoque Mín.'], 2); } },
            { rotulo: 'Situação', valor: function (l) { return ui.selo(l['Status']); } }
          ]
        })
      ]);
    }
  };
})();
