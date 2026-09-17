/* GPEL - construtor de formulários.
   As telas dizem QUAIS campos aparecem; a estrutura de cada campo vem da
   definição da tabela (Apps Script), então não há nomes de coluna repetidos.

   Atenção: os valores mostrados como "calculados" aqui são apenas uma prévia
   na tela. Quem calcula de verdade, e grava, é o Apps Script (Regras.gs).
   Nunca duplique uma regra de cálculo fora de lá. */

window.GPEL = window.GPEL || {};

GPEL.formulario = (function () {
  var ui = GPEL.ui;
  var el = ui.el;

  /** Prévias exibidas enquanto a usuária digita (não são gravadas). */
  var PREVIAS = {
    'Valor Total': function (v) {
      var total = (Number(v['Quantidade']) || 0) * (Number(v['Valor Unit.']) || 0);
      return ui.dinheiro(total);
    },
    'Prod./h': function (v) {
      var horas = Number(v['Horas']) || 0;
      return horas > 0 ? ui.numero((Number(v['Produzido']) || 0) / horas, 2) : '—';
    },
    'Prod./HH': function (v) {
      var horas = Number(v['Horas']) || 0;
      var pessoas = Number(v['Pessoas']) || 0;
      return (horas > 0 && pessoas > 0) ? ui.numero((Number(v['Produzido']) || 0) / (horas * pessoas), 2) : '—';
    },
    'Saldo Sistema': function (v) {
      return v['Código'] ? ui.numero(GPEL.estado.saldoDe(v['Código']), 2) : '—';
    },
    'Diferença': function (v) {
      if (v['Contagem Física'] === '' || v['Contagem Física'] === undefined) return '—';
      var saldo = v['Código'] ? GPEL.estado.saldoDe(v['Código']) : 0;
      return ui.numero((Number(v['Contagem Física']) || 0) - saldo, 2);
    }
  };

  /** Campos preenchidos automaticamente a partir dos cadastros. */
  var AUTOMATICOS = {
    'Unidade': function (v, contexto) {
      if (contexto.tabela === 'PEDIDOS' || contexto.tabela === 'PRODUCAO') {
        var produto = GPEL.estado.itemDaClasse('Produto', v['Produto']);
        return produto ? produto['Unidade'] : '';
      }
      var item = GPEL.estado.itemDaClasse(v['Classe'], v['Código Item']);
      return item ? item['Unidade'] : '';
    },
    'Item': function (v) {
      var codigo = v['Código Item'] !== undefined ? v['Código Item'] : v['Código'];
      var item = GPEL.estado.itemDaClasse(v['Classe'], codigo);
      if (!item) return '';
      return v['Classe'] === 'Insumo' ? item['Item'] : item['Produto'];
    }
  };

  /** Junta a definição vinda do servidor com os ajustes da tela. */
  function resolverCampo(nomeTabela, pedido) {
    var def = GPEL.estado.definicao(nomeTabela);
    var base = {};
    if (def) {
      (def.campos || []).forEach(function (campo) {
        if (campo.nome === pedido.nome) base = campo;
      });
    }
    var campo = Object.assign({}, base, pedido);
    campo.rotulo = campo.rotulo || campo.nome;
    return campo;
  }

  function opcoesDoCampo(campo, valores) {
    if (campo.opcoes) return typeof campo.opcoes === 'function' ? campo.opcoes(valores) : campo.opcoes;
    if (campo.tipo === 'lista') {
      return GPEL.estado.enumDe(campo.lista).map(function (o) { return { valor: o, rotulo: o }; });
    }
    if (campo.tipo === 'ref') {
      if (campo.dependeDe === 'Classe') {
        if (!valores['Classe']) return [];
        return GPEL.estado.opcoesDe(GPEL.estado.cadastroDaClasse(valores['Classe']));
      }
      if (campo.ref) return GPEL.estado.opcoesDe(campo.ref.tabela, campo.ref.filtro);
    }
    return [];
  }

  /**
   * Abre um formulário em painel.
   * opcoes: { titulo, tabela, campos:[{nome,...}], valores, aoSalvar(valores), rotuloSalvar, extra }
   */
  function abrir(opcoes) {
    var valores = Object.assign({}, opcoes.valores || {});
    var campos = (opcoes.campos || []).map(function (c) {
      return resolverCampo(opcoes.tabela, typeof c === 'string' ? { nome: c } : c);
    });

    // valores padrão
    campos.forEach(function (campo) {
      if (valores[campo.nome] === undefined || valores[campo.nome] === '') {
        if (campo.padrao !== undefined) valores[campo.nome] = campo.padrao === 'hoje' ? ui.hoje() : campo.padrao;
      }
    });

    var corpo = el('div', {});
    var painel = ui.abrirPainel(opcoes.titulo, corpo);

    /* Os campos são montados UMA vez. Depois, só as partes derivadas
       (prévias, campos automáticos e listas dependentes) são atualizadas.
       Redesenhar o formulário inteiro a cada digitação faria a usuária
       perder o foco e o valor recém-digitado. */
    var controles = {};
    var formulario = el('form', { class: 'formulario', onsubmit: submeter });

    campos.forEach(function (campo) { formulario.appendChild(montarCampo(campo)); });
    if (opcoes.extra) formulario.appendChild(opcoes.extra);
    formulario.appendChild(el('div', { class: 'formulario__acoes' }, [
      el('button', { class: 'botao botao--fantasma', type: 'button', texto: 'Cancelar', onclick: ui.fecharPainel }),
      el('button', { class: 'botao', type: 'submit', texto: opcoes.rotuloSalvar || 'Salvar' })
    ]));
    corpo.appendChild(formulario);
    atualizarDerivados();
    return painel;

    function montarCampo(campo) {
      var caixa = el('div', { class: 'campo' });
      caixa.appendChild(el('label', { for: 'campo-' + campo.nome, texto: campo.rotulo + (campo.obrigatorio ? ' *' : '') }));

      if (campo.tipo === 'calculado' || campo.somenteLeitura || campo.auto) {
        caixa.className = 'campo campo--calculado';
        var mostrador = el('div', { class: 'campo__valor', texto: '—' });
        caixa.appendChild(mostrador);
        if (campo.tipo === 'calculado') {
          caixa.appendChild(el('div', { class: 'campo__ajuda', texto: 'Calculado pelo sistema.' }));
        }
        controles[campo.nome] = { campo: campo, mostrador: mostrador };
        return caixa;
      }

      var entrada;
      if (campo.tipo === 'lista' || campo.tipo === 'ref') {
        entrada = el('select', { id: 'campo-' + campo.nome });
        preencherOpcoes(entrada, campo);
      } else if (campo.tipo === 'textoLongo') {
        entrada = el('textarea', { id: 'campo-' + campo.nome });
        entrada.value = valores[campo.nome] || '';
      } else {
        var tipoHtml = 'text';
        var passo = null;
        if (campo.tipo === 'data') tipoHtml = 'date';
        else if (campo.tipo === 'numero') { tipoHtml = 'number'; passo = '1'; }
        else if (campo.tipo === 'decimal' || campo.tipo === 'dinheiro') { tipoHtml = 'number'; passo = '0.01'; }
        entrada = el('input', {
          id: 'campo-' + campo.nome,
          type: tipoHtml,
          step: passo,
          inputmode: tipoHtml === 'number' ? 'decimal' : null,
          placeholder: campo.exemplo || ''
        });
        entrada.value = valores[campo.nome] === undefined || valores[campo.nome] === null ? '' : valores[campo.nome];
      }

      function registrar() {
        valores[campo.nome] = entrada.value;
        atualizarDerivados(campo.nome);
      }
      entrada.addEventListener('input', registrar);
      entrada.addEventListener('change', registrar);

      caixa.appendChild(entrada);
      if (campo.ajuda) caixa.appendChild(el('div', { class: 'campo__ajuda', texto: campo.ajuda }));
      caixa.appendChild(el('div', { class: 'campo__erro', hidden: true }));
      controles[campo.nome] = { campo: campo, entrada: entrada, caixa: caixa };
      return caixa;
    }

    function preencherOpcoes(selecao, campo) {
      var lista = opcoesDoCampo(campo, valores);
      var escolhido = String(valores[campo.nome] || '');
      ui.limpar(selecao);
      selecao.appendChild(el('option', { value: '', texto: lista.length ? 'Selecione…' : 'Nenhuma opção disponível' }));
      var aindaExiste = false;
      lista.forEach(function (opcao) {
        var item = el('option', { value: opcao.valor, texto: opcao.rotulo });
        if (escolhido === String(opcao.valor)) { item.selected = true; aindaExiste = true; }
        selecao.appendChild(item);
      });
      if (!aindaExiste && escolhido) {
        valores[campo.nome] = '';
        selecao.value = '';
      }
    }

    /** Atualiza prévias, campos automáticos e listas que dependem de outro campo. */
    function atualizarDerivados(campoAlterado) {
      var contexto = { tabela: opcoes.tabela };

      campos.forEach(function (campo) {
        var controle = controles[campo.nome];
        if (!controle) return;

        if (controle.mostrador) {
          var texto;
          if (campo.auto && AUTOMATICOS[campo.nome]) texto = AUTOMATICOS[campo.nome](valores, contexto);
          else if (PREVIAS[campo.nome]) texto = PREVIAS[campo.nome](valores);
          else texto = valores[campo.nome];
          controle.mostrador.textContent = (texto === '' || texto === undefined || texto === null) ? '—' : texto;
          return;
        }

        if (campoAlterado && campo.dependeDe === campoAlterado && controle.entrada) {
          preencherOpcoes(controle.entrada, campo);
        }
      });
    }

    function submeter(evento) {
      evento.preventDefault();
      var faltando = campos.filter(function (campo) {
        if (!campo.obrigatorio || campo.auto || campo.tipo === 'calculado') return false;
        var valor = valores[campo.nome];
        return valor === undefined || valor === null || String(valor).trim() === '';
      });

      campos.forEach(function (campo) {
        var controle = controles[campo.nome];
        if (!controle || !controle.caixa) return;
        var erro = controle.caixa.querySelector('.campo__erro');
        var falta = faltando.indexOf(campo) !== -1;
        controle.caixa.classList.toggle('campo--erro', falta);
        if (erro) {
          erro.textContent = falta ? 'Campo obrigatório.' : '';
          erro.hidden = !falta;
        }
      });

      if (faltando.length) {
        ui.aviso('Preencha: ' + faltando.map(function (c) { return c.rotulo; }).join(', '), 'erro');
        return;
      }

      var paraEnviar = {};
      campos.forEach(function (campo) {
        if (campo.tipo === 'calculado') return; // o servidor calcula
        if (campo.auto) return;                 // o servidor busca no cadastro
        paraEnviar[campo.nome] = valores[campo.nome] === undefined ? '' : valores[campo.nome];
      });

      ui.carregando(true);
      Promise.resolve(opcoes.aoSalvar(paraEnviar))
        .then(function () { ui.fecharPainel(); })
        .catch(function (erro) { ui.aviso(erro.message, 'erro'); })
        .finally(function () { ui.carregando(false); });
    }
  }

  return { abrir: abrir };
})();
