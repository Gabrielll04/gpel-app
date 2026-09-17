/* GPEL - Início: atalhos do dia a dia e o que precisa de atenção. */

window.GPEL = window.GPEL || {};
GPEL.telas = GPEL.telas || {};

GPEL.telas.inicio = (function () {
  var ui = GPEL.ui;
  var el = ui.el;

  function acaoRapida(icone, titulo, descricao, aoClicar) {
    return el('a', { class: 'acao-rapida', href: '#', onclick: function (evento) { evento.preventDefault(); aoClicar(); } }, [
      el('div', { class: 'acao-rapida__icone' }, [ui.icone(icone)]),
      el('strong', { texto: titulo }),
      el('span', { texto: descricao })
    ]);
  }

  return {
    titulo: 'Início',
    subtitulo: 'O que fazer hoje',
    render: function () {
      var pedidos = GPEL.estado.tabela('PEDIDOS');
      var abertos = pedidos.filter(GPEL.telas.pedidos.emAberto);
      var atrasados = pedidos.filter(GPEL.telas.pedidos.atrasado);
      var repor = GPEL.estado.tabela('ESTOQUE_ATUAL').filter(function (l) { return String(l['Status']) === 'REPOR'; });
      var ajustesPendentes = GPEL.estado.tabela('INVENTARIO').filter(function (i) {
        return String(i['Ajuste?']) === 'Sim' && !i._ajusteAprovado;
      });
      var producaoHoje = GPEL.estado.tabela('PRODUCAO').filter(function (p) {
        return String(p['Data']).slice(0, 10) === ui.hoje();
      });

      var caixa = el('div', {});

      caixa.appendChild(el('div', { class: 'acoes-rapidas' }, [
        acaoRapida('pedidos', 'Novo pedido', 'Registrar pedido de cliente', function () { GPEL.telas.pedidos.novo(); }),
        acaoRapida('producao', 'Registrar produção', 'Apontar o turno', function () { GPEL.telas.producao.novo(); }),
        acaoRapida('compras', 'Nova compra', 'Entrada automática no estoque', function () { GPEL.telas.compras.novo(); }),
        acaoRapida('estoque', 'Estoque', 'Consultar saldo dos itens', function () { window.location.hash = '#/estoque'; }),
        acaoRapida('inventario', 'Inventário', 'Contar e ajustar', function () { GPEL.telas.inventario.novo(); }),
        acaoRapida('gestao', 'Gestão', 'Indicadores do período', function () { window.location.hash = '#/gestao'; })
      ]));

      caixa.appendChild(el('div', { class: 'secao__titulo', texto: 'Resumo de hoje' }));
      caixa.appendChild(el('div', { class: 'indicadores' }, [
        ui.indicador('Pedidos em aberto', ui.numero(abertos.length, 0)),
        ui.indicador('Pedidos atrasados', ui.numero(atrasados.length, 0), atrasados.length ? 'verificar prazos' : 'tudo no prazo', atrasados.length > 0),
        ui.indicador('Itens para repor', ui.numero(repor.length, 0), repor.length ? 'abaixo do mínimo' : 'estoque ok', repor.length > 0),
        ui.indicador('Produções hoje', ui.numero(producaoHoje.length, 0))
      ]));

      if (atrasados.length) {
        caixa.appendChild(el('div', { class: 'secao__titulo', texto: 'Pedidos atrasados' }));
        atrasados.slice(0, 5).forEach(function (pedido) {
          caixa.appendChild(ui.cartao({
            titulo: GPEL.estado.rotuloDe('CAD_CLIENTES', pedido['Cliente']),
            meta: GPEL.estado.rotuloDe('CAD_PRODUTOS', pedido['Produto']),
            selo: ui.selo('entrega ' + ui.data(pedido['Prazo / Data Entrega']), 'erro'),
            linhas: [['Situação', pedido['Status']], ['Quantidade', ui.numero(pedido['Quantidade'], 2) + ' ' + (pedido['Unidade'] || '')]],
            aoClicar: function () { window.location.hash = '#/pedidos'; }
          }));
        });
      }

      if (repor.length) {
        caixa.appendChild(el('div', { class: 'secao__titulo', texto: 'Itens abaixo do mínimo' }));
        repor.slice(0, 5).forEach(function (linha) {
          caixa.appendChild(ui.cartao({
            titulo: linha['Item'] || linha['Código'],
            meta: linha['Classe'],
            selo: ui.selo('REPOR'),
            linhas: [
              ['Saldo', ui.numero(linha['Saldo Atual'], 2) + ' ' + (linha['Unidade'] || '')],
              ['Mínimo', ui.numero(linha['Estoque Mín.'], 2)]
            ],
            aoClicar: function () { window.location.hash = '#/estoque'; }
          }));
        });
      }

      if (ajustesPendentes.length) {
        caixa.appendChild(el('div', { class: 'secao__titulo', texto: 'Inventário aguardando decisão' }));
        caixa.appendChild(ui.cartao({
          titulo: ajustesPendentes.length + (ajustesPendentes.length === 1 ? ' contagem com diferença' : ' contagens com diferença'),
          meta: 'O saldo só muda depois que o ajuste for aprovado.',
          selo: ui.selo('pendente', 'atencao'),
          linhas: [],
          aoClicar: function () { window.location.hash = '#/inventario'; }
        }));
      }

      return caixa;
    }
  };
})();
