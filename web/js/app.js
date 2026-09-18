/* GPEL - inicialização do aplicativo. */

(function () {
  var ui = GPEL.ui;

  function mostrarSincronizacao() {
    var rotulo = document.getElementById('rotulo-sincronizacao');
    if (!rotulo) return;
    var quando = GPEL.estado.carregadoEm;
    var partes = [];
    var quem = GPEL.estado.dados && GPEL.estado.dados.usuario;
    if (quem && quem.email) partes.push(quem.email);
    if (quando) partes.push('atualizado às ' + quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    rotulo.textContent = partes.join(' · ');
  }

  /* Abre a tela o quanto antes: se houver dados guardados no aparelho, a
     interface aparece na hora e a busca ao servidor termina por trás. */
  function abrir() {
    if (!GPEL.api.configurada()) {
      GPEL.rotas.iniciar();
      if (window.location.hash.indexOf('configuracoes') === -1) {
        ui.aviso('Informe o endereço do servidor em Configurações.', 'erro');
      }
      return;
    }

    var abertura = GPEL.estado.iniciar();
    if (abertura.temCache) {
      GPEL.rotas.iniciar();
      mostrarSincronizacao();
    }

    abertura.promessa
      .then(function () {
        if (abertura.temCache) GPEL.rotas.redesenhar();
        else GPEL.rotas.iniciar();
        mostrarSincronizacao();
      })
      .catch(function (erro) {
        if (!abertura.temCache) GPEL.rotas.iniciar();
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

  abrir();
})();
