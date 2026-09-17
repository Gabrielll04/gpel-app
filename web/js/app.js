/* GPEL - inicialização do aplicativo. */

(function () {
  var ui = GPEL.ui;

  function mostrarSincronizacao() {
    var rotulo = document.getElementById('rotulo-sincronizacao');
    if (!rotulo) return;
    var quando = GPEL.estado.carregadoEm;
    rotulo.textContent = quando
      ? 'Atualizado às ' + quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '';
  }

  function carregarDados() {
    if (!GPEL.api.configurada()) return Promise.resolve();
    return GPEL.estado.carregar(true)
      .then(function () { mostrarSincronizacao(); })
      .catch(function (erro) {
        ui.aviso(erro.message, 'erro');
      });
  }

  document.getElementById('botao-atualizar').addEventListener('click', function () {
    GPEL.estado.atualizar()
      .then(mostrarSincronizacao)
      .catch(function (erro) { ui.aviso(erro.message, 'erro'); });
  });

  // Redesenha ao virar o aparelho ou redimensionar (cartões <-> tabela).
  var larguraAnterior = window.innerWidth >= 900;
  window.addEventListener('resize', function () {
    var agora = window.innerWidth >= 900;
    if (agora !== larguraAnterior) {
      larguraAnterior = agora;
      GPEL.rotas.redesenhar();
    }
  });

  carregarDados().then(function () {
    GPEL.rotas.iniciar();
    if (!GPEL.api.configurada() && window.location.hash.indexOf('configuracoes') === -1) {
      ui.aviso('Informe o endereço do servidor em Configurações.', 'erro');
    }
  });
})();
