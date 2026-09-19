/* GPEL - utilidades de interface: criação de elementos, formatação,
   avisos, painéis e blocos visuais reaproveitados pelas telas. */

window.GPEL = window.GPEL || {};

GPEL.ui = (function () {

  /* ------------------------------------------------------- elementos */

  /** Cria um elemento. Ex.: el('div', { class: 'cartao' }, ['texto']) */
  function el(tag, atributos, filhos) {
    var elemento = document.createElement(tag);
    atributos = atributos || {};
    Object.keys(atributos).forEach(function (chave) {
      var valor = atributos[chave];
      if (valor === null || valor === undefined || valor === false) return;
      if (chave === 'class') elemento.className = valor;
      else if (chave === 'html') elemento.innerHTML = valor;
      else if (chave === 'texto') elemento.textContent = valor;
      else if (chave.indexOf('on') === 0) elemento.addEventListener(chave.slice(2), valor);
      else if (valor === true) elemento.setAttribute(chave, '');
      else elemento.setAttribute(chave, valor);
    });
    (filhos || []).forEach(function (filho) {
      if (filho === null || filho === undefined || filho === false) return;
      elemento.appendChild(typeof filho === 'string' ? document.createTextNode(filho) : filho);
    });
    return elemento;
  }

  function limpar(elemento) {
    while (elemento.firstChild) elemento.removeChild(elemento.firstChild);
    return elemento;
  }

  /* ------------------------------------------------------ formatação */

  function numero(valor, casas) {
    if (valor === '' || valor === null || valor === undefined) return '—';
    var n = Number(valor);
    if (isNaN(n)) return String(valor);
    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: casas === undefined ? 0 : casas,
      maximumFractionDigits: casas === undefined ? 2 : casas
    });
  }

  function dinheiro(valor) {
    if (valor === '' || valor === null || valor === undefined) return '—';
    var n = Number(valor);
    if (isNaN(n)) return String(valor);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /** aaaa-mm-dd -> dd/mm/aaaa (sem depender de fuso horário). */
  function data(valor) {
    if (!valor) return '—';
    var texto = String(valor).slice(0, 10);
    var partes = texto.split('-');
    return partes.length === 3 ? partes[2] + '/' + partes[1] + '/' + partes[0] : texto;
  }

  function hoje() {
    var agora = new Date();
    var mes = String(agora.getMonth() + 1).padStart(2, '0');
    var dia = String(agora.getDate()).padStart(2, '0');
    return agora.getFullYear() + '-' + mes + '-' + dia;
  }

  function diasEntre(dataInicial, dataFinal) {
    var a = new Date(String(dataInicial).slice(0, 10) + 'T00:00:00');
    var b = new Date(String(dataFinal).slice(0, 10) + 'T00:00:00');
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
  }

  /* ---------------------------------------------------------- avisos */

  function aviso(mensagem, tipo) {
    var caixa = document.getElementById('avisos');
    var item = el('div', { class: 'aviso' + (tipo ? ' aviso--' + tipo : ''), texto: mensagem });
    caixa.appendChild(item);
    setTimeout(function () {
      item.style.transition = 'opacity .25s';
      item.style.opacity = '0';
      setTimeout(function () { if (item.parentNode) item.parentNode.removeChild(item); }, 260);
    }, tipo === 'erro' ? 5200 : 2800);
  }

  var contadorCarregando = 0;
  function carregando(ligado) {
    contadorCarregando = Math.max(0, contadorCarregando + (ligado ? 1 : -1));
    document.getElementById('carregando').hidden = contadorCarregando === 0;
  }

  /* ---------------------------------------------------------- painel */

  var painelAberto = null;

  function abrirPainel(titulo, conteudo) {
    fecharPainel();
    var sobreposicao = document.getElementById('sobreposicao');
    sobreposicao.hidden = false;
    sobreposicao.onclick = fecharPainel;

    var painel = el('div', { class: 'painel', role: 'dialog' }, [
      el('div', { class: 'painel__topo' }, [
        el('h2', { texto: titulo }),
        el('button', { class: 'painel__fechar', type: 'button', 'aria-label': 'Fechar', onclick: fecharPainel, texto: '×' })
      ]),
      conteudo
    ]);
    document.body.appendChild(painel);
    painelAberto = painel;
    return painel;
  }

  function fecharPainel() {
    if (painelAberto && painelAberto.parentNode) painelAberto.parentNode.removeChild(painelAberto);
    painelAberto = null;
    document.getElementById('sobreposicao').hidden = true;
  }

  /** Confirmação com texto próprio, no lugar do confirm() do navegador. */
  function confirmar(titulo, mensagem, rotuloConfirmar, perigoso) {
    return new Promise(function (resolver) {
      var conteudo = el('div', {}, [
        el('p', { texto: mensagem, style: 'margin-bottom:16px;color:var(--texto-suave)' }),
        el('div', { class: 'formulario__acoes' }, [
          el('button', {
            class: 'botao botao--fantasma', type: 'button',
            onclick: function () { fecharPainel(); resolver(false); }, texto: 'Cancelar'
          }),
          el('button', {
            class: 'botao' + (perigoso ? ' botao--perigo' : ''), type: 'button',
            onclick: function () { fecharPainel(); resolver(true); },
            texto: rotuloConfirmar || 'Confirmar'
          })
        ])
      ]);
      abrirPainel(titulo, conteudo);
    });
  }

  /* ------------------------------------------------------ componentes */

  var CORES_STATUS = {
    'Recebido': 'info', 'Aguardando programação': 'atencao', 'Programado': 'info',
    'Em produção': 'info', 'Pronto': 'ok', 'Separado': 'ok', 'Entregue': 'ok', 'Cancelado': 'neutro',
    'Planejada': 'info', 'Concluída': 'ok', 'Parada': 'atencao',
    'OK': 'ok', 'REPOR': 'erro', 'DEFINIR MÍNIMO': 'atencao',
    'Sim': 'atencao', 'Não': 'neutro'
  };

  function selo(texto, tipoForcado) {
    var tipo = tipoForcado || CORES_STATUS[texto] || 'neutro';
    return el('span', { class: 'selo selo--' + tipo, texto: texto || '—' });
  }

  function indicador(rotulo, valor, nota, alerta) {
    return el('div', { class: 'indicador' + (alerta ? ' indicador--alerta' : '') }, [
      el('div', { class: 'indicador__rotulo', texto: rotulo }),
      el('div', { class: 'indicador__valor', texto: valor }),
      nota ? el('div', { class: 'indicador__nota', texto: nota }) : null
    ]);
  }

  /* Bloco da marca. Fica num lugar só: no pacote do Apps Script a imagem vira
     texto embutido, e repeti-la engordaria o arquivo a cada uso. */
  var CAMINHO_LOGO = 'img/gpel-logo.png';

  function marca(descricao) {
    return el('div', { class: 'cartao marca-completa' }, [
      el('img', { src: CAMINHO_LOGO, alt: 'GPEL', width: '420', height: '509' }),
      el('span', { texto: descricao || 'Gestão de produção e estoque' })
    ]);
  }

  function vazio(mensagem) {
    return el('div', { class: 'cartao cartao--vazio' }, [el('p', { texto: mensagem })]);
  }

  function linhaDetalhe(rotulo, valor) {
    return el('div', {}, [
      el('span', { texto: rotulo }),
      typeof valor === 'string' || typeof valor === 'number'
        ? el('span', { texto: String(valor) })
        : el('span', {}, [valor])
    ]);
  }

  /** Cartão de lista, usado em quase todas as telas. */
  function cartao(opcoes) {
    var linhas = (opcoes.linhas || []).filter(Boolean).map(function (par) {
      return el('div', { class: 'cartao__linha' }, [
        el('span', { texto: par[0] }),
        typeof par[1] === 'object' && par[1] !== null ? el('span', {}, [par[1]]) : el('span', { texto: String(par[1]) })
      ]);
    });
    return el('div', {
      class: 'cartao' + (opcoes.aoClicar ? ' cartao--clicavel' : ''),
      onclick: opcoes.aoClicar
    }, [
      el('div', { class: 'cartao__topo' }, [
        el('div', {}, [
          el('div', { class: 'cartao__titulo', texto: opcoes.titulo }),
          opcoes.meta ? el('div', { class: 'cartao__meta', texto: opcoes.meta }) : null
        ]),
        opcoes.selo || null
      ]),
      linhas.length ? el('div', { class: 'cartao__linhas' }, linhas) : null
    ]);
  }

  /** Tabela simples para a visão de desktop. */
  function tabela(colunas, linhas, aoClicarLinha) {
    var cabecalho = el('tr', {}, colunas.map(function (coluna) {
      return el('th', { class: coluna.numerico ? 'numero' : '', texto: coluna.rotulo });
    }));
    var corpo = linhas.map(function (registro) {
      var tr = el('tr', { class: aoClicarLinha ? 'clicavel' : '' }, colunas.map(function (coluna) {
        var valor = coluna.valor(registro);
        return el('td', { class: coluna.numerico ? 'numero' : '' },
          typeof valor === 'object' && valor !== null ? [valor] : [document.createTextNode(valor === undefined || valor === null || valor === '' ? '—' : String(valor))]);
      }));
      if (aoClicarLinha) tr.addEventListener('click', function () { aoClicarLinha(registro); });
      return tr;
    });
    return el('div', { class: 'tabela-envolve' }, [
      el('table', { class: 'tabela' }, [
        el('thead', {}, [cabecalho]),
        el('tbody', {}, corpo)
      ])
    ]);
  }

  /** Ícones (traço simples, sem biblioteca externa). */
  var ICONES = {
    inicio: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    pedidos: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7',
    producao: 'M3 20V9l5 3V9l5 3V9l5 3v8zM3 20h18',
    estoque: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10',
    compras: 'M4 5h2l2 10h9l2-7H7M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z',
    inventario: 'M9 3h6v3H9zM6 6h12v15H6zM9 11h6M9 15h6',
    gestao: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    administracao: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1L14.5 3h-4l-.4 2.6a7 7 0 00-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1l.4 2.6h4l.4-2.6a7 7 0 001.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1z',
    configuracoes: 'M12 8v8M8 12h8M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    historico: 'M12 7v5l3 2M21 12a9 9 0 11-9-9'
  };

  function icone(nome) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    var caminho = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    caminho.setAttribute('d', ICONES[nome] || ICONES.inicio);
    svg.appendChild(caminho);
    return svg;
  }

  return {
    el: el, limpar: limpar, numero: numero, dinheiro: dinheiro, data: data, hoje: hoje, diasEntre: diasEntre,
    aviso: aviso, carregando: carregando, abrirPainel: abrirPainel, fecharPainel: fecharPainel, confirmar: confirmar,
    selo: selo, indicador: indicador, vazio: vazio, marca: marca, cartao: cartao, tabela: tabela, linhaDetalhe: linhaDetalhe, icone: icone
  };
})();
