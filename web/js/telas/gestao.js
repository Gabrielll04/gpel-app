/* GPEL - Gestão (visão gerencial).
   Só leitura: indicadores calculados a partir do que já foi registrado. */

window.GPEL = window.GPEL || {};
GPEL.telas = GPEL.telas || {};

GPEL.telas.gestao = (function () {
  var ui = GPEL.ui;
  var el = ui.el;

  var PERIODOS = [
    { rotulo: '30 dias', dias: 30 },
    { rotulo: '90 dias', dias: 90 },
    { rotulo: 'Ano', dias: 365 },
    { rotulo: 'Tudo', dias: null }
  ];
  var periodoEscolhido = 0;

  function dentroDoPeriodo(dataTexto) {
    var dias = PERIODOS[periodoEscolhido].dias;
    if (!dias) return true;
    if (!dataTexto) return false;
    var diferenca = ui.diasEntre(dataTexto, ui.hoje());
    return diferenca !== null && diferenca >= 0 && diferenca <= dias;
  }

  function soma(lista, pegar) {
    return lista.reduce(function (total, item) { return total + (Number(pegar(item)) || 0); }, 0);
  }

  /* --------------------------------------------------------- Pedidos */

  function blocoPedidos() {
    var pedidos = GPEL.estado.tabela('PEDIDOS').filter(function (p) { return dentroDoPeriodo(p['Data']); });
    var abertos = pedidos.filter(GPEL.telas.pedidos.emAberto);
    var atrasados = pedidos.filter(GPEL.telas.pedidos.atrasado);
    var entregues = pedidos.filter(function (p) { return p['Status'] === 'Entregue'; });
    return el('div', {}, [
      el('div', { class: 'secao__titulo', texto: 'Pedidos' }),
      el('div', { class: 'indicadores' }, [
        ui.indicador('Pedidos no período', ui.numero(pedidos.length, 0)),
        ui.indicador('Em aberto', ui.numero(abertos.length, 0), ui.dinheiro(soma(abertos, function (p) { return p['Valor Total']; })) + ' a faturar'),
        ui.indicador('Atrasados', ui.numero(atrasados.length, 0), 'prazo vencido', atrasados.length > 0),
        ui.indicador('Entregues', ui.numero(entregues.length, 0), ui.dinheiro(soma(entregues, function (p) { return p['Valor Total']; })) + ' entregues')
      ])
    ]);
  }

  /* -------------------------------------------------------- Produção */

  function blocoProducao() {
    var producoes = GPEL.estado.tabela('PRODUCAO').filter(function (p) {
      return dentroDoPeriodo(p['Data']) && p['Status'] !== 'Cancelada';
    });

    var produzido = soma(producoes, function (p) { return p['Produzido']; });
    var horas = soma(producoes, function (p) { return p['Horas']; });
    var horasHomem = soma(producoes, function (p) { return (Number(p['Horas']) || 0) * (Number(p['Pessoas']) || 0); });
    var perdas = soma(producoes, function (p) { return p['Perdas (kg)']; });
    // Atingimento só mede produção que já terminou: concluída, ou parada no
    // meio (essa conta contra a meta). Planejada e em andamento ainda não
    // tiveram chance de cumprir a meta — contá-las como zero puxa o indicador
    // para baixo sem motivo.
    var ENCERRADAS = ['Concluída', 'Parada'];
    var comMeta = producoes.filter(function (p) {
      return (Number(p['Meta']) || 0) > 0 && ENCERRADAS.indexOf(String(p['Status'])) !== -1;
    });
    var metaTotal = soma(comMeta, function (p) { return p['Meta']; });
    var produzidoComMeta = soma(comMeta, function (p) { return p['Produzido']; });

    var porProduto = {};
    producoes.forEach(function (p) {
      var chave = String(p['Produto'] || '');
      if (!chave) return;
      if (!porProduto[chave]) porProduto[chave] = { produzido: 0, horas: 0, perdas: 0 };
      porProduto[chave].produzido += Number(p['Produzido']) || 0;
      porProduto[chave].horas += Number(p['Horas']) || 0;
      porProduto[chave].perdas += Number(p['Perdas (kg)']) || 0;
    });

    var linhas = Object.keys(porProduto).map(function (codigo) {
      var dados = porProduto[codigo];
      return {
        produto: GPEL.estado.rotuloDe('CAD_PRODUTOS', codigo),
        produzido: dados.produzido,
        horas: dados.horas,
        perdas: dados.perdas,
        porHora: dados.horas > 0 ? dados.produzido / dados.horas : null
      };
    }).sort(function (a, b) { return b.produzido - a.produzido; });

    return el('div', {}, [
      el('div', { class: 'secao__titulo', texto: 'Produção' }),
      el('div', { class: 'indicadores' }, [
        ui.indicador('Produzido', ui.numero(produzido, 0), producoes.length + ' apontamentos'),
        ui.indicador('Produção por hora', horas > 0 ? ui.numero(produzido / horas, 2) : '—', 'média do período'),
        ui.indicador('Produção por hora/pessoa', horasHomem > 0 ? ui.numero(produzido / horasHomem, 2) : '—', 'média do período'),
        ui.indicador('Atingimento da meta', metaTotal > 0 ? ui.numero((produzidoComMeta / metaTotal) * 100, 1) + '%' : '—',
          comMeta.length + ' produções encerradas · perdas: ' + ui.numero(perdas, 2) + ' kg', metaTotal > 0 && produzidoComMeta < metaTotal)
      ]),
      linhas.length
        ? el('div', { style: 'margin-top:12px' }, [ui.tabela([
            { rotulo: 'Produto', valor: function (l) { return l.produto; } },
            { rotulo: 'Produzido', numerico: true, valor: function (l) { return ui.numero(l.produzido, 2); } },
            { rotulo: 'Horas', numerico: true, valor: function (l) { return ui.numero(l.horas, 2); } },
            { rotulo: 'Prod./h', numerico: true, valor: function (l) { return l.porHora === null ? '—' : ui.numero(l.porHora, 2); } },
            { rotulo: 'Perdas (kg)', numerico: true, valor: function (l) { return ui.numero(l.perdas, 2); } }
          ], linhas)])
        : ui.vazio('Sem apontamentos de produção no período.')
    ]);
  }

  /* --------------------------------------------------------- Estoque */

  function blocoEstoque() {
    var criticos = GPEL.estado.tabela('ESTOQUE_ATUAL').filter(function (l) { return String(l['Status']) === 'REPOR'; });
    return el('div', {}, [
      el('div', { class: 'secao__titulo', texto: 'Estoque crítico' }),
      criticos.length
        ? ui.tabela([
            { rotulo: 'Item', valor: function (l) { return l['Item'] || l['Código']; } },
            { rotulo: 'Classe', valor: function (l) { return l['Classe']; } },
            { rotulo: 'Saldo', numerico: true, valor: function (l) { return ui.numero(l['Saldo Atual'], 2); } },
            { rotulo: 'Mínimo', numerico: true, valor: function (l) { return ui.numero(l['Estoque Mín.'], 2); } }
          ], criticos, function (l) { window.location.hash = '#/movimentos?codigo=' + encodeURIComponent(l['Código']); })
        : ui.vazio('Nenhum item abaixo do estoque mínimo.')
    ]);
  }

  /* ------------------------------------------------------------- ABC */

  /** Descobre em VENDAS_HISTORICO qual coluna é o produto e qual é o valor. */
  function colunasDeVendas(registros) {
    if (!registros.length) return null;
    var colunas = Object.keys(registros[0]).filter(function (c) { return c !== '_linha'; });
    function achar(padrao) {
      for (var i = 0; i < colunas.length; i++) if (padrao.test(colunas[i])) return colunas[i];
      return null;
    }
    var produto = achar(/produto|item/i);
    var valor = achar(/valor total/i) || achar(/valor|faturamento|total/i);
    var data = achar(/data/i);
    return produto && valor ? { produto: produto, valor: valor, data: data } : null;
  }

  function dadosABC() {
    var vendas = GPEL.estado.tabela('VENDAS_HISTORICO');
    var colunas = colunasDeVendas(vendas);

    var itens = [];
    var fonte = '';
    if (colunas) {
      fonte = 'Histórico de vendas';
      vendas.filter(function (v) { return !colunas.data || dentroDoPeriodo(v[colunas.data]); })
        .forEach(function (v) { itens.push({ chave: String(v[colunas.produto] || ''), valor: Number(v[colunas.valor]) || 0 }); });
    } else {
      fonte = 'Pedidos entregues';
      GPEL.estado.tabela('PEDIDOS')
        .filter(function (p) { return p['Status'] === 'Entregue' && dentroDoPeriodo(p['Data']); })
        .forEach(function (p) {
          itens.push({ chave: GPEL.estado.rotuloDe('CAD_PRODUTOS', p['Produto']), valor: Number(p['Valor Total']) || 0 });
        });
    }

    var agrupado = {};
    itens.forEach(function (item) {
      if (!item.chave) return;
      agrupado[item.chave] = (agrupado[item.chave] || 0) + item.valor;
    });

    var linhas = Object.keys(agrupado).map(function (chave) {
      return { produto: chave, valor: agrupado[chave] };
    }).sort(function (a, b) { return b.valor - a.valor; });

    var total = soma(linhas, function (l) { return l.valor; });
    var acumulado = 0;
    linhas.forEach(function (linha) {
      acumulado += linha.valor;
      linha.participacao = total > 0 ? linha.valor / total : 0;
      linha.acumulado = total > 0 ? acumulado / total : 0;
      linha.classe = linha.acumulado <= 0.8 ? 'A' : (linha.acumulado <= 0.95 ? 'B' : 'C');
    });

    return { fonte: fonte, linhas: linhas, total: total };
  }

  function blocoABC() {
    var abc = dadosABC();
    return el('div', {}, [
      el('div', { class: 'secao__titulo', texto: 'Curva ABC de vendas · fonte: ' + abc.fonte }),
      abc.linhas.length
        ? ui.tabela([
            { rotulo: 'Produto', valor: function (l) { return l.produto; } },
            { rotulo: 'Faturamento', numerico: true, valor: function (l) { return ui.dinheiro(l.valor); } },
            { rotulo: 'Participação', numerico: true, valor: function (l) { return ui.numero(l.participacao * 100, 1) + '%'; } },
            { rotulo: 'Acumulado', numerico: true, valor: function (l) { return ui.numero(l.acumulado * 100, 1) + '%'; } },
            { rotulo: 'Classe', valor: function (l) { return ui.selo(l.classe, l.classe === 'A' ? 'ok' : (l.classe === 'B' ? 'info' : 'neutro')); } }
          ], abc.linhas)
        : ui.vazio('Ainda não há vendas registradas para montar a curva ABC.')
    ]);
  }

  return {
    titulo: 'Gestão',
    subtitulo: 'Indicadores de pedidos, produção, estoque e vendas',
    render: function () {
      var caixa = el('div', {});

      var filtros = el('div', { class: 'filtros' }, PERIODOS.map(function (periodo, indice) {
        return el('button', {
          type: 'button',
          class: 'filtro' + (periodoEscolhido === indice ? ' ativo' : ''),
          texto: periodo.rotulo,
          onclick: function () { periodoEscolhido = indice; GPEL.rotas.redesenhar(); }
        });
      }));

      caixa.appendChild(filtros);
      caixa.appendChild(blocoPedidos());
      caixa.appendChild(blocoProducao());
      caixa.appendChild(blocoEstoque());
      caixa.appendChild(blocoABC());
      return caixa;
    }
  };
})();
