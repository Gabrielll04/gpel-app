/**
 * GPEL - Web App (API).
 *
 * Publicação: Implantar > Nova implantação > Aplicativo da Web
 *   Executar como: Eu
 *   Quem pode acessar: Qualquer pessoa
 * Copie a URL gerada e cole em Configurações, dentro do aplicativo GPEL.
 *
 * Observação técnica: o aplicativo envia POST com Content-Type "text/plain"
 * de propósito. É o que evita a requisição de verificação (preflight CORS),
 * que o Apps Script não responde. O corpo continua sendo JSON.
 */

function doGet(e) {
  var parametros = (e && e.parameter) || {};

  // Sem "action" é alguém abrindo o aplicativo no navegador: entrega a página.
  // Com "action" é o aplicativo pedindo dados.
  if (!parametros.action) return servirInterface_(parametros);

  return responder_(function () {
    var p = parametros;
    conferirAcesso_(p.token);
    var acao = p.action;

    switch (acao) {
      case 'ping':
        return { mensagem: 'API GPEL no ar', versao: '1.0', usuario: dadosDoUsuario_() };

      case 'usuario':
        return dadosDoUsuario_();

      case 'meta':
        return metaDados_();

      case 'list':
        return {
          tabela: p.table,
          registros: listar(p.table, {
            filtro: p.filtro ? JSON.parse(p.filtro) : null,
            limite: p.limite
          })
        };

      case 'tudo':
        return carregarTudo_();

      case 'estoque':
        // Leitura: calcula em memória, sem regravar a planilha.
        return { registros: calcularEstoque() };

      case 'inventarios':
        return { registros: listarInventarios() };

      case 'historico':
        return {
          registros: listar('MOV_ESTOQUE', { filtro: p.codigo ? { 'Código Item': p.codigo } : null })
        };

      default:
        throw new Error('Ação desconhecida: ' + acao);
    }
  });
}

function doPost(e) {
  return responder_(function () {
    var corpo = {};
    if (e && e.postData && e.postData.contents) corpo = JSON.parse(e.postData.contents);
    conferirAcesso_(corpo.token);

    // Quem assina a operação é a conta que fez login, não o que o aplicativo diz.
    var responsavel = nomeDoUsuario() || corpo.usuario || '';

    var trava = LockService.getScriptLock();
    trava.waitLock(30000); // evita duas gravações simultâneas na mesma linha
    try {
      switch (corpo.action) {
        case 'criar':      return criar_(corpo.table, corpo.valores || {}, responsavel);
        case 'atualizar':  return atualizar_(corpo.table, corpo.id, corpo.valores || {});
        case 'excluir':    return excluir_(corpo.table, corpo.id);
        case 'estoqueMinimo':  return definirEstoqueMinimo(corpo.codigo, corpo.minimo);
        case 'aprovarAjuste':  return aprovarAjusteInventario(corpo.id, responsavel);
        case 'recalcularEstoque': return { registros: recalcularEstoque() };
        default: throw new Error('Ação desconhecida: ' + corpo.action);
      }
    } finally {
      trava.releaseLock();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Ações                                                               */
/* ------------------------------------------------------------------ */

function criar_(nomeTabela, valores, usuario) {
  var def = TABELAS[nomeTabela];
  if (!def) throw new Error('Tabela desconhecida: ' + nomeTabela);
  if (def.somenteLeitura || def.calculada) throw new Error('Não é possível criar registros em ' + nomeTabela + '.');

  // Cadastros: o código pode ser digitado; se vier vazio, o sistema gera um.
  if (!def.idAutomatico && def.chave) {
    if (!textoLimpo_(valores[def.chave])) valores[def.chave] = gerarId(def.prefixoId);
    validarCodigoUnico_(nomeTabela, valores[def.chave], null);
  }

  // Responsável em branco é preenchido com quem está logado: rastreabilidade
  // sem depender de a pessoa digitar o próprio nome.
  if (usuario && !textoLimpo_(valores['Responsável']) && temCampo_(def, 'Responsável')) {
    valores['Responsável'] = usuario;
  }

  var registro = prepararRegistro(nomeTabela, valores, null);
  if (def.idAutomatico) registro[def.chave] = gerarId(def.prefixoId);

  inserirLinha(nomeTabela, registro);

  var extras = {};
  if (nomeTabela === 'COMPRAS') {
    var movimento = gerarEntradaDaCompra_(registro, usuario);
    if (movimento) extras.movimentoGerado = movimento['ID Movimento'];
  }
  if (nomeTabela === 'MOV_ESTOQUE' || nomeTabela === 'COMPRAS') recalcularEstoque();

  return { registro: limparTecnicos_(nomeTabela, registro), extras: extras };
}

function atualizar_(nomeTabela, id, valores) {
  var def = TABELAS[nomeTabela];
  if (!def) throw new Error('Tabela desconhecida: ' + nomeTabela);
  if (def.somenteInclusao) {
    throw new Error('Movimentações de estoque não podem ser alteradas. Registre uma nova movimentação de correção.');
  }
  if (def.somenteLeitura || def.calculada) throw new Error('Não é possível alterar registros em ' + nomeTabela + '.');

  var anterior = buscarPorId(nomeTabela, id);
  if (!anterior) throw new Error('Registro não encontrado: ' + id);

  // A chave nunca muda e as colunas técnicas de controle são preservadas.
  valores[def.chave] = anterior[def.chave];
  if (nomeTabela === 'COMPRAS') valores['Mov. Gerado'] = anterior['Mov. Gerado'];

  var registro = prepararRegistro(nomeTabela, valores, anterior);
  var final = atualizarLinha(nomeTabela, anterior._linha, registro, anterior);

  // Editar uma compra NÃO gera nova entrada de estoque (a entrada já existe).
  if (nomeTabela === 'COMPRAS') recalcularEstoque();

  return { registro: limparTecnicos_(nomeTabela, final) };
}

function excluir_(nomeTabela, id) {
  var def = TABELAS[nomeTabela];
  if (!def || !def.permiteExcluir) {
    throw new Error('Este tipo de registro não pode ser excluído. Use o status ou um ajuste rastreável.');
  }
  var registro = buscarPorId(nomeTabela, id);
  if (!registro) throw new Error('Registro não encontrado: ' + id);
  impedirExclusaoEmUso_(nomeTabela, id);
  excluirLinha(nomeTabela, registro._linha);
  return { excluido: id };
}

/** Cadastro em uso não pode ser excluído (o histórico ficaria órfão). */
function impedirExclusaoEmUso_(nomeTabela, id) {
  var alvo = textoLimpo_(id);
  var usos = {
    CAD_CLIENTES:     [{ tabela: 'PEDIDOS', coluna: 'Cliente', rotulo: 'pedidos' }],
    CAD_FORNECEDORES: [{ tabela: 'COMPRAS', coluna: 'Fornecedor', rotulo: 'compras' }],
    CAD_PRODUTOS:     [{ tabela: 'PEDIDOS', coluna: 'Produto', rotulo: 'pedidos' },
                       { tabela: 'PRODUCAO', coluna: 'Produto', rotulo: 'produções' },
                       { tabela: 'MOV_ESTOQUE', coluna: 'Código Item', rotulo: 'movimentações de estoque' }],
    CAD_INSUMOS:      [{ tabela: 'COMPRAS', coluna: 'Código Item', rotulo: 'compras' },
                       { tabela: 'MOV_ESTOQUE', coluna: 'Código Item', rotulo: 'movimentações de estoque' }]
  }[nomeTabela] || [];

  usos.forEach(function (uso) {
    var emUso = listar(uso.tabela).some(function (r) { return textoLimpo_(r[uso.coluna]) === alvo; });
    if (emUso) throw new Error('Este cadastro não pode ser excluído porque já é usado em ' + uso.rotulo + '.');
  });
}

/* ------------------------------------------------------------------ */
/* Apoio                                                               */
/* ------------------------------------------------------------------ */

/** Estrutura das tabelas e listas fixas, consumida pelo aplicativo web. */
function metaDados_() {
  var tabelas = {};
  Object.keys(TABELAS).forEach(function (nome) {
    var def = TABELAS[nome];
    tabelas[nome] = {
      nome: nome,
      rotuloSingular: def.rotuloSingular || nome,
      rotuloPlural: def.rotuloPlural || nome,
      chave: def.chave || '',
      rotulo: def.rotulo || def.chave || '',
      campos: def.campos || [],
      idAutomatico: !!def.idAutomatico,
      somenteLeitura: !!def.somenteLeitura,
      somenteInclusao: !!def.somenteInclusao,
      calculada: !!def.calculada,
      permiteExcluir: !!def.permiteExcluir,
      tecnica: !!def.tecnica
    };
  });
  return { enums: ENUMS, tabelas: tabelas, calculados: CALCULADOS };
}

/** Carga inicial do aplicativo em uma única chamada (menos idas e vindas no celular). */
function carregarTudo_() {
  return {
    meta: metaDados_(),
    usuario: dadosDoUsuario_(),
    CAD_PRODUTOS: listar('CAD_PRODUTOS'),
    CAD_INSUMOS: listar('CAD_INSUMOS'),
    CAD_CLIENTES: listar('CAD_CLIENTES'),
    CAD_FORNECEDORES: listar('CAD_FORNECEDORES'),
    PEDIDOS: listar('PEDIDOS'),
    PRODUCAO: listar('PRODUCAO'),
    COMPRAS: listar('COMPRAS'),
    INVENTARIO: listarInventarios(),
    ESTOQUE_ATUAL: calcularEstoque(),
    MOV_ESTOQUE: listar('MOV_ESTOQUE', { limite: 500 }),
    VENDAS_HISTORICO: listar('VENDAS_HISTORICO')
  };
}

/** Remove colunas técnicas antes de devolver o registro. */
function limparTecnicos_(nomeTabela, registro) {
  var copia = {};
  Object.keys(registro).forEach(function (chave) {
    if (chave === '_linha') return;
    copia[chave] = registro[chave];
  });
  return copia;
}

/** A tabela tem essa coluna? */
function temCampo_(def, nomeCampo) {
  return (def.campos || []).some(function (campo) { return campo.nome === nomeCampo; });
}

/** Envelopa a resposta em JSON, sempre com ok/erro. */
function responder_(funcao) {
  var comecou = Date.now();
  var saida;
  try {
    saida = { ok: true, dados: funcao() };
  } catch (erro) {
    saida = { ok: false, erro: erro && erro.message ? erro.message : String(erro) };
  }
  // Tempo gasto DENTRO do Apps Script. Se estiver baixo e a requisição
  // demorar, o gasto está na partida do script e na rede, não no código.
  saida.ms = Date.now() - comecou;
  return ContentService
    .createTextOutput(JSON.stringify(saida))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* Manutenção (executar manualmente pelo editor do Apps Script)         */
/* ------------------------------------------------------------------ */

/** Cria as abas que faltarem e acerta os cabeçalhos, sem apagar nada. */
function instalarPlanilha() {
  Object.keys(TABELAS).forEach(function (nome) { garantirColunas_(nome); });
  recalcularEstoque();
  return 'Planilha preparada.';
}
