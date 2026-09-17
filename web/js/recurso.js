/* GPEL - lista genérica de registros.
   Usada por Pedidos, Produção, Compras, Inventário e pelos cadastros.
   No celular mostra cartões; no computador, tabela. */

window.GPEL = window.GPEL || {};

GPEL.recurso = (function () {
  var ui = GPEL.ui;
  var el = ui.el;

  function ehDesktop() { return window.innerWidth >= 900; }

  /**
   * config: {
   *   tabela, registros(), busca(r), filtros:[{rotulo, teste(r)}], ordenar(a,b),
   *   cartao(r), colunas:[{rotulo, valor(r), numerico}], aoAbrir(r), vazio
   * }
   */
  function lista(config) {
    var estadoFiltro = { filtro: 0, termo: '' };
    var caixa = el('div', {});
    desenhar();
    return caixa;

    function desenhar() {
      ui.limpar(caixa);

      if (config.busca) {
        var campoBusca = el('input', { type: 'search', placeholder: config.placeholderBusca || 'Buscar…' });
        campoBusca.value = estadoFiltro.termo;
        campoBusca.addEventListener('input', function () {
          estadoFiltro.termo = campoBusca.value;
          desenharResultado();
        });
        caixa.appendChild(el('div', { class: 'busca' }, [campoBusca]));
      }

      if (config.filtros && config.filtros.length) {
        var barra = el('div', { class: 'filtros' });
        config.filtros.forEach(function (filtro, indice) {
          barra.appendChild(el('button', {
            type: 'button',
            class: 'filtro' + (estadoFiltro.filtro === indice ? ' ativo' : ''),
            texto: filtro.rotulo,
            onclick: function () { estadoFiltro.filtro = indice; desenhar(); }
          }));
        });
        caixa.appendChild(barra);
      }

      caixa.appendChild(el('div', { id: 'resultado-lista' }));
      desenharResultado();
    }

    function desenharResultado() {
      var alvo = caixa.querySelector('#resultado-lista');
      ui.limpar(alvo);

      var registros = config.registros().slice();
      var filtroAtual = config.filtros && config.filtros[estadoFiltro.filtro];
      if (filtroAtual && filtroAtual.teste) registros = registros.filter(filtroAtual.teste);

      var termo = estadoFiltro.termo.trim().toLowerCase();
      if (termo && config.busca) {
        registros = registros.filter(function (r) {
          return String(config.busca(r) || '').toLowerCase().indexOf(termo) !== -1;
        });
      }

      if (config.ordenar) registros.sort(config.ordenar);

      alvo.appendChild(el('div', { class: 'secao__titulo', texto: registros.length + (registros.length === 1 ? ' registro' : ' registros') }));

      if (!registros.length) {
        alvo.appendChild(ui.vazio(config.vazio || 'Nada por aqui ainda.'));
        return;
      }

      if (ehDesktop() && config.colunas) {
        alvo.appendChild(ui.tabela(config.colunas, registros, config.aoAbrir));
      } else {
        registros.forEach(function (r) { alvo.appendChild(config.cartao(r)); });
      }
    }
  }

  /** Botão de ação principal do cabeçalho. */
  function botaoNovo(rotulo, aoClicar) {
    return el('button', { class: 'botao botao--pequeno', type: 'button', texto: rotulo, onclick: aoClicar });
  }

  /** Cria um registro e recarrega os dados. */
  function salvarNovo(tabela, valores, mensagem) {
    return GPEL.api.criar(tabela, valores).then(function (resposta) {
      ui.aviso(mensagem || 'Registro salvo.', 'ok');
      return GPEL.estado.atualizar().then(function () { return resposta; });
    });
  }

  /** Atualiza um registro e recarrega os dados. */
  function salvarEdicao(tabela, id, valores, mensagem) {
    return GPEL.api.atualizar(tabela, id, valores).then(function (resposta) {
      ui.aviso(mensagem || 'Alterações salvas.', 'ok');
      return GPEL.estado.atualizar().then(function () { return resposta; });
    });
  }

  /** Painel de detalhe padrão: lista de rótulo/valor + ações. */
  function detalhe(titulo, linhas, acoes) {
    var conteudo = el('div', {}, [
      el('div', { class: 'lista-detalhe' }, linhas.filter(Boolean).map(function (par) {
        return ui.linhaDetalhe(par[0], par[1]);
      })),
      acoes && acoes.length ? el('div', { class: 'formulario__acoes' }, acoes) : null
    ]);
    return ui.abrirPainel(titulo, conteudo);
  }

  return {
    lista: lista,
    botaoNovo: botaoNovo,
    salvarNovo: salvarNovo,
    salvarEdicao: salvarEdicao,
    detalhe: detalhe,
    ehDesktop: ehDesktop
  };
})();
