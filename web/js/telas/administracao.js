/* GPEL - Administração (cadastros).
   Produtos, insumos, clientes e fornecedores. Mesma tela para os quatro:
   muda só a definição da tabela. */

window.GPEL = window.GPEL || {};
GPEL.telas = GPEL.telas || {};

GPEL.telas.administracao = (function () {
  var ui = GPEL.ui;
  var el = ui.el;

  var CADASTROS = {
    CAD_PRODUTOS: {
      rotulo: 'Produtos',
      descricao: 'Fabricação e revenda',
      campos: [
        { nome: 'Código', ajuda: 'Deixe em branco para o sistema criar um código.' },
        { nome: 'Produto', rotulo: 'Nome do produto' },
        { nome: 'Tipo' },
        { nome: 'Unidade', exemplo: 'un, rolo, fardo, kg' }
      ],
      colunas: ['Código', 'Produto', 'Tipo', 'Unidade']
    },
    CAD_INSUMOS: {
      rotulo: 'Insumos',
      descricao: 'Matéria-prima, embalagens e apoio',
      campos: [
        { nome: 'Código', ajuda: 'Deixe em branco para o sistema criar um código.' },
        { nome: 'Item', rotulo: 'Nome do insumo' },
        { nome: 'Unidade', exemplo: 'kg, un, m' }
      ],
      colunas: ['Código', 'Item', 'Unidade']
    },
    CAD_CLIENTES: {
      rotulo: 'Clientes',
      descricao: 'Quem compra da GPEL',
      campos: [
        { nome: 'Código', ajuda: 'Deixe em branco para o sistema criar um código.' },
        { nome: 'Razão Social', rotulo: 'Nome / razão social' }
      ],
      colunas: ['Código', 'Razão Social']
    },
    CAD_FORNECEDORES: {
      rotulo: 'Fornecedores',
      descricao: 'De quem a GPEL compra',
      campos: [
        { nome: 'Código', ajuda: 'Deixe em branco para o sistema criar um código.' },
        { nome: 'Razão Social', rotulo: 'Nome / razão social' }
      ],
      colunas: ['Código', 'Razão Social']
    }
  };

  var cadastroAtual = 'CAD_PRODUTOS';

  function definicao() { return GPEL.estado.definicao(cadastroAtual) || {}; }

  function novo() {
    var config = CADASTROS[cadastroAtual];
    GPEL.formulario.abrir({
      titulo: 'Novo em ' + config.rotulo,
      tabela: cadastroAtual,
      campos: config.campos,
      valores: {},
      aoSalvar: function (valores) {
        return GPEL.recurso.salvarNovo(cadastroAtual, valores, 'Cadastro criado.');
      }
    });
  }

  function editar(registro) {
    ui.fecharPainel();
    var config = CADASTROS[cadastroAtual];
    var chave = definicao().chave;
    GPEL.formulario.abrir({
      titulo: 'Editar cadastro',
      tabela: cadastroAtual,
      campos: config.campos.map(function (campo) {
        return campo.nome === chave ? Object.assign({}, campo, { somenteLeitura: true, ajuda: null }) : campo;
      }),
      valores: registro,
      aoSalvar: function (valores) {
        return GPEL.recurso.salvarEdicao(cadastroAtual, registro[chave], valores, 'Cadastro atualizado.');
      }
    });
  }

  function excluir(registro) {
    var chave = definicao().chave;
    ui.fecharPainel();
    ui.confirmar('Excluir cadastro', 'Deseja excluir "' + (registro[definicao().rotulo] || registro[chave]) + '"? Cadastros já usados em pedidos, compras ou movimentações não podem ser excluídos.', 'Excluir', true)
      .then(function (confirmado) {
        if (!confirmado) return;
        ui.carregando(true);
        GPEL.api.excluir(cadastroAtual, registro[chave])
          .then(function () {
            ui.aviso('Cadastro excluído.', 'ok');
            return GPEL.estado.atualizar();
          })
          .catch(function (erro) { ui.aviso(erro.message, 'erro'); })
          .finally(function () { ui.carregando(false); });
      });
  }

  function abrirDetalhe(registro) {
    var config = CADASTROS[cadastroAtual];
    GPEL.recurso.detalhe(String(registro[definicao().rotulo] || ''), config.colunas.map(function (coluna) {
      return [coluna, String(registro[coluna] || '—')];
    }), [
      el('button', { class: 'botao botao--perigo', type: 'button', texto: 'Excluir', onclick: function () { excluir(registro); } }),
      el('button', { class: 'botao', type: 'button', texto: 'Editar', onclick: function () { editar(registro); } })
    ]);
  }

  return {
    titulo: 'Administração',
    subtitulo: 'Cadastros de produtos, insumos, clientes e fornecedores',
    acoes: function () { return [GPEL.recurso.botaoNovo('+ Cadastro', novo)]; },
    render: function () {
      var caixa = el('div', {});

      caixa.appendChild(el('div', { class: 'filtros' }, Object.keys(CADASTROS).map(function (nome) {
        return el('button', {
          type: 'button',
          class: 'filtro' + (cadastroAtual === nome ? ' ativo' : ''),
          texto: CADASTROS[nome].rotulo,
          onclick: function () { cadastroAtual = nome; GPEL.rotas.redesenhar(); }
        });
      })));

      var config = CADASTROS[cadastroAtual];
      caixa.appendChild(el('p', { class: 'cartao__meta', style: 'margin-bottom:12px', texto: config.descricao }));

      caixa.appendChild(GPEL.recurso.lista({
        registros: function () { return GPEL.estado.tabela(cadastroAtual); },
        vazio: 'Nenhum registro em ' + config.rotulo + '.',
        placeholderBusca: 'Buscar…',
        busca: function (r) { return config.colunas.map(function (c) { return r[c]; }).join(' '); },
        ordenar: function (a, b) {
          return String(a[definicao().rotulo] || '').localeCompare(String(b[definicao().rotulo] || ''), 'pt-BR');
        },
        cartao: function (registro) {
          return ui.cartao({
            titulo: String(registro[definicao().rotulo] || registro[definicao().chave]),
            meta: 'Código: ' + registro[definicao().chave],
            selo: cadastroAtual === 'CAD_PRODUTOS' ? ui.selo(registro['Tipo'], 'neutro') : null,
            linhas: registro['Unidade'] ? [['Unidade', registro['Unidade']]] : [],
            aoClicar: function () { abrirDetalhe(registro); }
          });
        },
        aoAbrir: abrirDetalhe,
        colunas: config.colunas.map(function (coluna) {
          return { rotulo: coluna, valor: function (r) { return r[coluna]; } };
        })
      }));

      return caixa;
    }
  };
})();
