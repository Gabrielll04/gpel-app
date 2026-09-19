/* GPEL - navegação por endereço (#/pedidos, #/estoque?codigo=INS001, ...). */

window.GPEL = window.GPEL || {};

GPEL.rotas = (function () {
  var ui = GPEL.ui;
  var el = ui.el;

  /* Menu principal: uso diário (barra inferior no celular). */
  var PRINCIPAIS = [
    { rota: 'inicio', rotulo: 'Início', icone: 'inicio' },
    { rota: 'pedidos', rotulo: 'Pedidos', icone: 'pedidos' },
    { rota: 'producao', rotulo: 'Produção', icone: 'producao' },
    { rota: 'estoque', rotulo: 'Estoque', icone: 'estoque' },
    { rota: 'compras', rotulo: 'Compras', icone: 'compras' }
  ];

  /* Menu secundário: uso esporádico / gerencial. */
  var SECUNDARIAS = [
    { rota: 'inventario', rotulo: 'Inventário', icone: 'inventario' },
    { rota: 'gestao', rotulo: 'Gestão', icone: 'gestao' },
    { rota: 'administracao', rotulo: 'Administração', icone: 'administracao' },
    { rota: 'configuracoes', rotulo: 'Configurações', icone: 'configuracoes' }
  ];

  /* Telas de referência: abertas por navegação, sem item de menu próprio. */
  var REFERENCIA = ['movimentos'];

  var atual = { rota: 'inicio', parametros: {} };

  function lerEndereco() {
    var hash = window.location.hash.replace(/^#\/?/, '') || 'inicio';
    var partes = hash.split('?');
    var rota = partes[0] || 'inicio';
    var parametros = {};
    if (partes[1]) {
      partes[1].split('&').forEach(function (par) {
        var pedaco = par.split('=');
        if (pedaco[0]) parametros[decodeURIComponent(pedaco[0])] = decodeURIComponent(pedaco[1] || '');
      });
    }
    if (!GPEL.telas[rota]) rota = 'inicio';
    return { rota: rota, parametros: parametros };
  }

  function desenharMenus() {
    var lateral = document.getElementById('menu-lateral');
    ui.limpar(lateral);

    function itemLateral(item) {
      return el('a', { href: '#/' + item.rota, class: atual.rota === item.rota ? 'ativo' : '' }, [
        ui.icone(item.icone),
        el('span', { texto: item.rotulo })
      ]);
    }

    PRINCIPAIS.forEach(function (item) { lateral.appendChild(itemLateral(item)); });
    lateral.appendChild(el('div', { class: 'menu__separador', texto: 'Gerencial' }));
    SECUNDARIAS.forEach(function (item) { lateral.appendChild(itemLateral(item)); });

    var barra = document.getElementById('barra-inferior');
    ui.limpar(barra);
    PRINCIPAIS.forEach(function (item) {
      barra.appendChild(el('a', { href: '#/' + item.rota, class: atual.rota === item.rota ? 'ativo' : '' }, [
        ui.icone(item.icone),
        el('span', { texto: item.rotulo })
      ]));
    });
  }

  function abrirMenuSecundario() {
    var lista = el('div', { class: 'formulario' }, SECUNDARIAS.map(function (item) {
      return el('button', {
        class: 'botao botao--secundario botao--bloco', type: 'button', texto: item.rotulo,
        onclick: function () { ui.fecharPainel(); window.location.hash = '#/' + item.rota; }
      });
    }).concat([
      el('button', {
        class: 'botao botao--fantasma botao--bloco', type: 'button', texto: 'Atualizar dados',
        onclick: function () {
          ui.fecharPainel();
          GPEL.estado.atualizar().catch(function (erro) { ui.aviso(erro.message, 'erro'); });
        }
      })
    ]));
    ui.abrirPainel('Mais', lista);
  }

  function desenhar() {
    var tela = GPEL.telas[atual.rota];
    if (!tela) return;

    document.getElementById('titulo-tela').textContent = tela.titulo;
    document.getElementById('subtitulo-tela').textContent = tela.subtitulo || '';

    var acoes = ui.limpar(document.getElementById('acoes-tela'));
    if (tela.acoes && GPEL.api.configurada()) {
      tela.acoes().forEach(function (botao) { acoes.appendChild(botao); });
    }

    var voltar = document.getElementById('botao-voltar');
    voltar.hidden = REFERENCIA.indexOf(atual.rota) === -1;

    var area = ui.limpar(document.getElementById('tela'));

    if (!GPEL.api.configurada() && atual.rota !== 'configuracoes') {
      area.appendChild(ui.marca());
      area.appendChild(el('div', { class: 'aviso-configuracao' }, [
        el('strong', { texto: 'Falta conectar o aplicativo à planilha. ' }),
        el('span', { texto: 'Abra Configurações e informe o endereço publicado no Apps Script.' })
      ]));
      area.appendChild(el('button', {
        class: 'botao botao--bloco', type: 'button', texto: 'Abrir Configurações',
        onclick: function () { window.location.hash = '#/configuracoes'; }
      }));
      desenharMenus();
      return;
    }

    area.appendChild(tela.render(atual.parametros));
    desenharMenus();
    window.scrollTo(0, 0);
  }

  function aoMudarEndereco() {
    ui.fecharPainel();
    atual = lerEndereco();
    desenhar();
  }

  /* Servido pelo Apps Script, o aplicativo roda dentro de um quadro (iframe).
     Tratar o clique por conta própria faz a navegação se comportar igual nos
     dois modos, hospedado fora ou dentro do Google. */
  function aoClicarEmLink(evento) {
    var alvo = evento.target;
    while (alvo && alvo.tagName !== 'A') alvo = alvo.parentNode;
    if (!alvo) return;
    var destino = alvo.getAttribute('href') || '';
    if (destino.indexOf('#/') !== 0) return;
    evento.preventDefault();
    if (window.location.hash === destino) aoMudarEndereco();
    else window.location.hash = destino;
  }

  function iniciar() {
    document.addEventListener('click', aoClicarEmLink);
    window.addEventListener('hashchange', aoMudarEndereco);
    document.getElementById('botao-menu').addEventListener('click', abrirMenuSecundario);
    document.getElementById('botao-voltar').addEventListener('click', function () { window.history.back(); });
    atual = lerEndereco();
    desenhar();
  }

  return {
    iniciar: iniciar,
    redesenhar: desenhar,
    get atual() { return atual; }
  };
})();
