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

  /* Tela mostrada quando o endereço atual não consegue mais falar com a
     planilha porque o aplicativo passou a exigir login do Google.
     Acontece com quem guardou o link antigo (GitHub Pages, Cloudflare). */
  function avisarParaAbrirNoGoogle() {
    var endereco = GPEL.api.url();
    var area = ui.limpar(document.getElementById('tela'));
    document.getElementById('titulo-tela').textContent = 'GPEL';
    document.getElementById('subtitulo-tela').textContent = 'Abrir pelo endereço certo';
    ui.limpar(document.getElementById('acoes-tela'));

    area.appendChild(ui.marca());
    area.appendChild(ui.el('div', { class: 'aviso-configuracao' }, [
      ui.el('strong', { texto: 'O aplicativo mudou de endereço. ' }),
      ui.el('span', { texto: 'Agora ele pede login com a sua conta Google, e por isso precisa ser aberto pelo endereço do próprio Google. Este atalho antigo não funciona mais.' })
    ]));
    if (endereco) {
      area.appendChild(ui.el('a', {
        class: 'botao botao--bloco', href: endereco, target: '_top', rel: 'noopener',
        texto: 'Abrir o aplicativo'
      }));
      area.appendChild(ui.el('p', {
        class: 'campo__ajuda', style: 'margin-top:12px;text-align:center',
        texto: 'Dica: depois de abrir, use o menu do navegador e escolha "Adicionar à tela inicial" para trocar o atalho antigo.'
      }));
    }
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
        if (erro.precisaAbrirNoGoogle) avisarParaAbrirNoGoogle();
        else ui.aviso(erro.message, 'erro');
      });
  }

  document.getElementById('botao-atualizar').addEventListener('click', function () {
    GPEL.estado.atualizar()
      .then(mostrarSincronizacao)
      .catch(function (erro) {
        if (erro.precisaAbrirNoGoogle) avisarParaAbrirNoGoogle();
        else ui.aviso(erro.message, 'erro');
      });
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
