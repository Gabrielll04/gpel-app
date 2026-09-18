/* GPEL - comunicação com o Apps Script.
   Toda ida ao servidor passa por aqui. */

window.GPEL = window.GPEL || {};

GPEL.api = (function () {
  var cfg = GPEL.config;
  var prefs = GPEL.preferencias;

  function url() {
    return prefs.ler(cfg.CHAVE_URL, cfg.URL_API_PADRAO) || '';
  }

  function token() {
    return prefs.ler(cfg.CHAVE_TOKEN, cfg.TOKEN_PADRAO) || '';
  }

  function usuario() {
    return prefs.ler(cfg.CHAVE_USUARIO, '') || '';
  }

  /* O aplicativo funciona de dois jeitos:
     1. servido pelo próprio Apps Script (com login do Google) -> google.script.run;
     2. hospedado fora (GitHub Pages, Cloudflare) -> fetch para a URL do Web App.
     O resto do código não precisa saber qual dos dois está valendo. */
  function dentroDoAppsScript() {
    return typeof google !== 'undefined' && !!google.script && !!google.script.run;
  }

  function configurada() {
    return dentroDoAppsScript() || !!url();
  }

  function definirUrl(novaUrl) { prefs.gravar(cfg.CHAVE_URL, (novaUrl || '').trim()); }
  function definirToken(novoToken) { prefs.gravar(cfg.CHAVE_TOKEN, (novoToken || '').trim()); }
  function definirUsuario(nome) { prefs.gravar(cfg.CHAVE_USUARIO, (nome || '').trim()); }

  function exigirConfiguracao() {
    if (!configurada()) {
      throw new Error('O endereço do servidor ainda não foi informado. Abra Configurações e cole a URL do aplicativo.');
    }
  }

  function interpretar(texto) {
    var dados;
    try {
      dados = JSON.parse(texto);
    } catch (e) {
      throw new Error('O servidor respondeu em um formato inesperado. Confira se a URL termina em /exec e se o acesso está liberado.');
    }
    if (!dados.ok) throw new Error(dados.erro || 'Não foi possível concluir a operação.');
    return dados.dados;
  }

  function tratarResposta(resposta) {
    return resposta.text().then(interpretar);
  }

  /** Chamada pela ponte do Apps Script (quando a página é servida por ele). */
  function pelaPonte(funcao, argumento) {
    return new Promise(function (resolver, rejeitar) {
      google.script.run
        .withSuccessHandler(function (texto) {
          try { resolver(interpretar(texto)); } catch (erro) { rejeitar(erro); }
        })
        .withFailureHandler(function (erro) {
          rejeitar(new Error(erro && erro.message ? erro.message : 'Falha ao falar com o servidor.'));
        })[funcao](argumento);
    });
  }

  /** Leitura. */
  function buscar(parametros) {
    if (dentroDoAppsScript()) {
      return pelaPonte('apiGet', Object.assign({}, parametros, { token: token() }));
    }
    exigirConfiguracao();
    var query = Object.keys(parametros)
      .filter(function (chave) { return parametros[chave] !== undefined && parametros[chave] !== null && parametros[chave] !== ''; })
      .map(function (chave) { return encodeURIComponent(chave) + '=' + encodeURIComponent(parametros[chave]); });
    if (token()) query.push('token=' + encodeURIComponent(token()));
    return fetch(url() + '?' + query.join('&'), { method: 'GET', redirect: 'follow' })
      .then(tratarResposta);
  }

  /** Gravação (POST).
     O Content-Type é "text/plain" de propósito: evita a requisição de
     verificação (preflight) do navegador, que o Apps Script não responde.
     O corpo continua sendo JSON e é lido normalmente no doPost. */
  function enviar(corpo) {
    corpo = Object.assign({}, corpo, { token: token(), usuario: corpo.usuario || usuario() });
    if (dentroDoAppsScript()) return pelaPonte('apiPost', corpo);
    exigirConfiguracao();
    return fetch(url(), {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(corpo)
    }).then(tratarResposta);
  }

  return {
    url: url, token: token, usuario: usuario, configurada: configurada, dentroDoAppsScript: dentroDoAppsScript,
    definirUrl: definirUrl, definirToken: definirToken, definirUsuario: definirUsuario,
    buscar: buscar, enviar: enviar,

    /* atalhos usados pelas telas */
    ping: function () { return buscar({ action: 'ping' }); },
    carregarTudo: function () { return buscar({ action: 'tudo' }); },
    listar: function (tabela, filtro) {
      return buscar({ action: 'list', table: tabela, filtro: filtro ? JSON.stringify(filtro) : '' })
        .then(function (d) { return d.registros; });
    },
    historico: function (codigo) {
      return buscar({ action: 'historico', codigo: codigo }).then(function (d) { return d.registros; });
    },
    estoque: function () { return buscar({ action: 'estoque' }).then(function (d) { return d.registros; }); },
    criar: function (tabela, valores) { return enviar({ action: 'criar', table: tabela, valores: valores }); },
    atualizar: function (tabela, id, valores) { return enviar({ action: 'atualizar', table: tabela, id: id, valores: valores }); },
    excluir: function (tabela, id) { return enviar({ action: 'excluir', table: tabela, id: id }); },
    definirEstoqueMinimo: function (codigo, minimo) { return enviar({ action: 'estoqueMinimo', codigo: codigo, minimo: minimo }); },
    aprovarAjuste: function (id) { return enviar({ action: 'aprovarAjuste', id: id }); }
  };
})();
