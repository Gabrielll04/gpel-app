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

  /* Falha ao carregar os dados. Um aviso que some em segundos não ajuda
     ninguém a entender o que houve: esta tela fica, mostra a mensagem do
     servidor e diz por qual caminho o aplicativo tentou falar com ele. */
  /* Traduz as falhas mais comuns em uma causa provável, para não deixar a
     pessoa sozinha com uma mensagem técnica do Google. */
  function causaProvavel(mensagem) {
    var texto = String(mensagem || '');
    if (/permiss|permission/i.test(texto)) {
      return 'A conta que entrou provavelmente não tem acesso à planilha. Compartilhe a planilha com esse e-mail, como Editor.';
    }
    if (/ID_PLANILHA|Planilha não configurada/i.test(texto)) {
      return 'O Apps Script não sabe qual planilha usar. Preencha ID_PLANILHA no Config.gs, ou crie o script a partir da própria planilha.';
    }
    if (/não tem acesso ao aplicativo/i.test(texto)) {
      return 'Este e-mail não está na lista USUARIOS_AUTORIZADOS do Config.gs.';
    }
    if (/Ação desconhecida/i.test(texto)) {
      return 'O Codigo.gs publicado está desatualizado: publique uma nova versão.';
    }
    if (/Senha de acesso/i.test(texto)) {
      return 'O Config.gs tem TOKEN_ACESSO preenchido. Informe a mesma senha em Configurações ou deixe o campo vazio no Apps Script.';
    }
    return '';
  }

  function telaDeFalha(erro) {
    var area = ui.limpar(document.getElementById('tela'));
    document.getElementById('titulo-tela').textContent = 'GPEL';
    document.getElementById('subtitulo-tela').textContent = 'Não consegui carregar os dados';
    ui.limpar(document.getElementById('acoes-tela'));

    var caminho = GPEL.api.dentroDoAppsScript()
      ? 'servidor do Google (página publicada pelo Apps Script)'
      : 'endereço configurado: ' + (GPEL.api.url() || 'nenhum');

    area.appendChild(ui.marca());
    area.appendChild(ui.el('div', { class: 'cartao' }, [
      ui.el('div', { class: 'cartao__titulo', texto: 'O aplicativo abriu, mas os dados não vieram' }),
      ui.el('p', { class: 'cartao__meta', style: 'margin-top:8px', texto: 'Mensagem do servidor:' }),
      ui.el('div', { class: 'aviso-configuracao', style: 'margin:8px 0 0', texto: erro && erro.message ? erro.message : String(erro) }),
      causaProvavel(erro && erro.message) ? ui.el('p', { class: 'campo__ajuda', style: 'margin-top:10px', texto: 'Causa provável: ' + causaProvavel(erro.message) }) : null
    ]));
    area.appendChild(ui.el('div', { class: 'cartao' }, [
      ui.el('div', { class: 'cartao__titulo', texto: 'Para quem for investigar' }),
      ui.el('div', { class: 'cartao__linhas' }, [
        ui.el('div', { class: 'cartao__linha' }, [
          ui.el('span', { texto: 'Caminho usado' }),
          ui.el('span', { texto: caminho })
        ]),
        ui.el('div', { class: 'cartao__linha' }, [
          ui.el('span', { texto: 'Conta' }),
          ui.el('span', { texto: (GPEL.estado.dados && GPEL.estado.dados.usuario && GPEL.estado.dados.usuario.email) || 'não identificada' })
        ])
      ])
    ]));
    area.appendChild(ui.el('button', {
      class: 'botao botao--bloco', type: 'button', texto: 'Tentar de novo',
      onclick: function () { window.location.reload(); }
    }));
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
        else if (abertura.temCache) ui.aviso(erro.message, 'erro'); // já há dados na tela
        else telaDeFalha(erro);
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
