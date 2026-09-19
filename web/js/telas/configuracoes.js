/* GPEL - Configurações.
   Onde se informa o endereço do servidor (Web App do Apps Script),
   a senha (se houver) e o nome de quem está usando o aplicativo. */

window.GPEL = window.GPEL || {};
GPEL.telas = GPEL.telas || {};

GPEL.telas.configuracoes = (function () {
  var ui = GPEL.ui;
  var el = ui.el;

  function campo(rotulo, valor, ajuda, tipo) {
    var entrada = el('input', { type: tipo || 'text' });
    entrada.value = valor || '';
    var caixa = el('div', { class: 'campo' }, [
      el('label', { texto: rotulo }),
      entrada,
      ajuda ? el('div', { class: 'campo__ajuda', texto: ajuda }) : null
    ]);
    return { caixa: caixa, entrada: entrada };
  }

  return {
    titulo: 'Configurações',
    subtitulo: 'Sua conta e o acesso ao aplicativo',
    render: function () {
      var marcaApenas = ui.marca();

      /* Servido pelo Apps Script, não há endereço nem senha para configurar:
         quem identifica a pessoa é o login do Google. */
      if (GPEL.api.dentroDoAppsScript()) {
        var quem = (GPEL.estado.dados && GPEL.estado.dados.usuario) || {};
        return el('div', { class: 'formulario' }, [
          marcaApenas,
          el('div', { class: 'cartao' }, [
            el('div', { class: 'cartao__titulo', texto: 'Sua conta' }),
            el('div', { class: 'cartao__linhas' }, [
              el('div', { class: 'cartao__linha' }, [
                el('span', { texto: 'Conectada como' }),
                el('span', { texto: quem.email || 'conta Google' })
              ]),
              el('div', { class: 'cartao__linha' }, [
                el('span', { texto: 'Acesso' }),
                el('span', {}, [ui.selo(quem.listaAtiva ? 'restrito por e-mail' : 'liberado', quem.listaAtiva ? 'ok' : 'atencao')])
              ])
            ]),
            el('div', { class: 'campo__ajuda', style: 'margin-top:10px', texto: quem.listaAtiva
              ? 'Só os e-mails autorizados abrem este aplicativo. Suas movimentações são assinadas com esta conta.'
              : 'Nenhuma lista de e-mails foi definida no Apps Script: quem conseguir abrir o endereço entra.' })
          ]),
          el('div', { class: 'cartao' }, [
            el('div', { class: 'cartao__titulo', texto: 'Quem pode usar o aplicativo' }),
            el('p', { class: 'campo__ajuda', style: 'margin-top:8px', texto:
              'Para incluir ou tirar alguém: abra a planilha, Extensões > Apps Script, edite a lista USUARIOS_AUTORIZADOS em Config.gs, compartilhe a planilha com o novo e-mail e publique uma nova versão do aplicativo.' })
          ])
        ]);
      }

      var url = campo('Endereço do aplicativo (Web App)', GPEL.api.url(),
        'Cole aqui a URL que termina em /exec, gerada ao publicar o Apps Script.', 'url');
      var token = campo('Senha de acesso', GPEL.api.token(),
        'Só é necessária se você preencheu TOKEN_ACESSO no Apps Script.', 'password');
      var usuario = campo('Seu nome', GPEL.api.usuario(),
        'Usado como responsável nas movimentações de estoque.');

      var situacao = el('div', { class: 'cartao' }, [
        el('div', { class: 'cartao__titulo', texto: 'Situação da conexão' }),
        el('div', { class: 'cartao__meta', id: 'situacao-conexao', texto: GPEL.api.configurada() ? 'Endereço configurado.' : 'Endereço ainda não informado.' })
      ]);

      var botoes = el('div', { class: 'formulario__acoes' }, [
        el('button', {
          class: 'botao botao--fantasma', type: 'button', texto: 'Testar conexão',
          onclick: function () {
            GPEL.api.definirUrl(url.entrada.value);
            GPEL.api.definirToken(token.entrada.value);
            ui.carregando(true);
            GPEL.api.ping()
              .then(function (resposta) {
                situacao.querySelector('#situacao-conexao').textContent = 'Conectado: ' + resposta.mensagem;
                ui.aviso('Conexão funcionando.', 'ok');
              })
              .catch(function (erro) {
                situacao.querySelector('#situacao-conexao').textContent = 'Falhou: ' + erro.message;
                ui.aviso(erro.message, 'erro');
              })
              .finally(function () { ui.carregando(false); });
          }
        }),
        el('button', {
          class: 'botao', type: 'button', texto: 'Salvar',
          onclick: function () {
            GPEL.api.definirUrl(url.entrada.value);
            GPEL.api.definirToken(token.entrada.value);
            GPEL.api.definirUsuario(usuario.entrada.value);
            ui.aviso('Configurações salvas.', 'ok');
            GPEL.estado.atualizar().catch(function (erro) { ui.aviso(erro.message, 'erro'); });
          }
        })
      ]);

      var ajuda = el('div', { class: 'cartao' }, [
        el('div', { class: 'cartao__titulo', texto: 'Como publicar o aplicativo' }),
        el('ol', { style: 'margin:10px 0 0;padding-left:18px;color:var(--texto-suave);font-size:13.5px;line-height:1.7' }, [
          el('li', { texto: 'Abra a planilha da GPEL e vá em Extensões > Apps Script.' }),
          el('li', { texto: 'Cole os arquivos da pasta apps-script e salve.' }),
          el('li', { texto: 'Execute uma vez a função instalarPlanilha, autorizando o acesso.' }),
          el('li', { texto: 'Clique em Implantar > Nova implantação > Aplicativo da Web.' }),
          el('li', { texto: 'Em "Executar como" escolha Eu; em "Quem pode acessar" escolha Qualquer pessoa.' }),
          el('li', { texto: 'Copie a URL gerada e cole no campo acima.' })
        ])
      ]);

      return el('div', { class: 'formulario' }, [marcaApenas, situacao, url.caixa, token.caixa, usuario.caixa, botoes, ajuda]);
    }
  };
})();
