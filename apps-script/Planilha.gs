/**
 * GPEL - Acesso genérico à planilha.
 * Nenhuma regra de negócio aqui: apenas ler, criar, atualizar e excluir linhas.
 */

var _planilha = null;
var _cacheAbas = {};
var _colunasConferidas = {};

/** Devolve a planilha configurada (ou a planilha ativa, se o script for vinculado a ela). */
function abrirPlanilha() {
  if (_planilha) return _planilha;
  if (ID_PLANILHA) _planilha = SpreadsheetApp.openById(ID_PLANILHA);
  else _planilha = SpreadsheetApp.getActiveSpreadsheet();
  if (!_planilha) throw new Error('Planilha não configurada. Preencha ID_PLANILHA em Config.gs.');
  return _planilha;
}

/**
 * Devolve a aba, criando-a se não existir.
 * A conferência de colunas NÃO acontece aqui: ela custa uma ida à planilha e
 * só faz falta na hora de gravar. Ler é o que mais acontece no dia a dia.
 */
function abaDe(nomeTabela) {
  var def = TABELAS[nomeTabela];
  if (!def) throw new Error('Tabela desconhecida: ' + nomeTabela);
  if (_cacheAbas[nomeTabela]) return _cacheAbas[nomeTabela];

  var planilha = abrirPlanilha();
  var aba = planilha.getSheetByName(nomeTabela);
  if (!aba) {
    aba = planilha.insertSheet(nomeTabela);
    if (def.campos.length) {
      aba.getRange(1, 1, 1, def.campos.length)
         .setValues([def.campos.map(function (c) { return c.nome; })])
         .setFontWeight('bold');
      aba.setFrozenRows(1);
    }
    _colunasConferidas[nomeTabela] = true;
    _cacheAbas[nomeTabela] = aba;
    return aba;
  }
  _cacheAbas[nomeTabela] = aba;
  return aba;
}

/**
 * Confere o cabeçalho antes de gravar: roda uma vez por aba em cada execução.
 */
function garantirColunas_(nomeTabela) {
  var aba = abaDe(nomeTabela);
  if (_colunasConferidas[nomeTabela]) return aba;
  var def = TABELAS[nomeTabela];
  if (!def.colunasLivres) acrescentarColunasFaltantes_(aba, def);
  _colunasConferidas[nomeTabela] = true;
  return aba;
}

/** Acrescenta ao final do cabeçalho as colunas previstas que ainda não existem. */
function acrescentarColunasFaltantes_(aba, def) {
  var largura = Math.max(aba.getLastColumn(), 1);
  var cabecalho = aba.getRange(1, 1, 1, largura).getValues()[0].map(textoLimpo_);
  var faltantes = def.campos
    .map(function (c) { return c.nome; })
    .filter(function (nome) { return cabecalho.indexOf(nome) === -1; });
  if (!faltantes.length) return;
  var inicio = cabecalho.filter(function (c) { return c !== ''; }).length + 1;
  aba.getRange(1, inicio, 1, faltantes.length)
     .setValues([faltantes])
     .setFontWeight('bold');
  if (aba.getFrozenRows() === 0) aba.setFrozenRows(1);
}

function textoLimpo_(valor) {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

/** Cabeçalho da aba, como array de nomes de coluna. */
function cabecalhoDe_(aba) {
  var largura = aba.getLastColumn();
  if (largura < 1) return [];
  return aba.getRange(1, 1, 1, largura).getValues()[0].map(textoLimpo_);
}

/** Converte valores lidos da planilha em algo seguro para JSON. */
function valorParaJson_(valor) {
  if (valor instanceof Date) return Utilities.formatDate(valor, FUSO, 'yyyy-MM-dd');
  return valor;
}

/**
 * Cache de leitura, válido SOMENTE durante uma execução do script.
 * Sem ele, uma única carga do aplicativo lê a mesma aba várias vezes
 * (cada validação relê os cadastros; MOV_ESTOQUE é lida três vezes).
 * Toda gravação limpa o cache da aba correspondente.
 */
var _cacheTabelas = {};

function limparCache_(nomeTabela) {
  if (nomeTabela) delete _cacheTabelas[nomeTabela];
  else _cacheTabelas = {};
}

/** Lê a aba inteira da planilha (sem cache), numa única ida. */
function lerTudo_(nomeTabela) {
  var aba = abaDe(nomeTabela);
  var ultimaLinha = aba.getLastRow();
  var ultimaColuna = aba.getLastColumn();
  if (ultimaLinha < 2 || ultimaColuna < 1) return [];

  // Cabeçalho e dados vêm juntos: duas idas à planilha viram uma.
  var tudo = aba.getRange(1, 1, ultimaLinha, ultimaColuna).getValues();
  var cabecalho = tudo[0].map(textoLimpo_);
  var valores = tudo.slice(1);

  var registros = [];
  for (var i = 0; i < valores.length; i++) {
    var linha = valores[i];
    if (linha.join('') === '') continue; // ignora linhas em branco
    var registro = { _linha: i + 2 };
    for (var c = 0; c < cabecalho.length; c++) {
      if (!cabecalho[c]) continue;
      registro[cabecalho[c]] = valorParaJson_(linha[c]);
    }
    registros.push(registro);
  }
  return registros;
}

/**
 * Lê todas as linhas de uma tabela.
 * Cada registro vem com a coluna técnica _linha (número da linha na planilha).
 */
function listar(nomeTabela, opcoes) {
  opcoes = opcoes || {};

  if (!_cacheTabelas[nomeTabela]) _cacheTabelas[nomeTabela] = lerTudo_(nomeTabela);

  // Cópia rasa: quem receber a lista pode alterá-la sem bagunçar o cache.
  var registros = _cacheTabelas[nomeTabela].map(function (registro) {
    var copia = {};
    Object.keys(registro).forEach(function (chave) { copia[chave] = registro[chave]; });
    return copia;
  });

  if (opcoes.filtro) {
    Object.keys(opcoes.filtro).forEach(function (coluna) {
      var esperado = textoLimpo_(opcoes.filtro[coluna]);
      registros = registros.filter(function (r) { return textoLimpo_(r[coluna]) === esperado; });
    });
  }
  if (opcoes.limite) registros = registros.slice(-Number(opcoes.limite));
  return registros;
}

/** Busca um registro pela chave da tabela. */
function buscarPorId(nomeTabela, id) {
  var def = TABELAS[nomeTabela];
  var alvo = textoLimpo_(id);
  var achados = listar(nomeTabela).filter(function (r) { return textoLimpo_(r[def.chave]) === alvo; });
  return achados.length ? achados[0] : null;
}

/** Gera um identificador único e legível (ex.: PED-M4X9K2-7QA). */
function gerarId(prefixo) {
  var tempo = Date.now().toString(36).toUpperCase();
  var aleatorio = Math.floor(Math.random() * 46655).toString(36).toUpperCase();
  while (aleatorio.length < 3) aleatorio = '0' + aleatorio;
  return prefixo + '-' + tempo + '-' + aleatorio;
}

/** Monta a linha (array) a partir de um objeto, respeitando o cabeçalho da aba. */
function objetoParaLinha_(cabecalho, registro, anterior) {
  return cabecalho.map(function (coluna) {
    if (!coluna) return '';
    if (Object.prototype.hasOwnProperty.call(registro, coluna)) {
      var v = registro[coluna];
      return v === null || v === undefined ? '' : v;
    }
    if (anterior && Object.prototype.hasOwnProperty.call(anterior, coluna)) {
      var a = anterior[coluna];
      return a === null || a === undefined ? '' : a;
    }
    return '';
  });
}

/** Insere uma linha nova e devolve o registro gravado. */
function inserirLinha(nomeTabela, registro) {
  var aba = garantirColunas_(nomeTabela);
  var cabecalho = cabecalhoDe_(aba);
  var numeroLinha = aba.getLastRow() + 1;
  formatarColunasTexto_(aba, cabecalho, numeroLinha);
  var linha = objetoParaLinha_(cabecalho, registro, null);
  aba.getRange(numeroLinha, 1, 1, cabecalho.length).setValues([linha]);
  limparCache_(nomeTabela);
  registro._linha = numeroLinha;
  return registro;
}

/** Atualiza uma linha existente (identificada por _linha) e devolve o registro final. */
function atualizarLinha(nomeTabela, numeroLinha, registro, anterior) {
  var aba = garantirColunas_(nomeTabela);
  var cabecalho = cabecalhoDe_(aba);
  formatarColunasTexto_(aba, cabecalho, numeroLinha);
  var linha = objetoParaLinha_(cabecalho, registro, anterior);
  aba.getRange(numeroLinha, 1, 1, cabecalho.length).setValues([linha]);
  limparCache_(nomeTabela);
  var final = {};
  cabecalho.forEach(function (coluna, i) { if (coluna) final[coluna] = linha[i]; });
  final._linha = numeroLinha;
  return final;
}

/** Exclui uma linha (permitido apenas para cadastros). */
function excluirLinha(nomeTabela, numeroLinha) {
  abaDe(nomeTabela).deleteRow(numeroLinha);
  limparCache_(nomeTabela);
}

/** Mantém NF e códigos como texto, preservando zeros à esquerda. */
function formatarColunasTexto_(aba, cabecalho, numeroLinha) {
  var colunasTexto = ['NF', 'Código', 'Código Item'];
  cabecalho.forEach(function (coluna, i) {
    if (colunasTexto.indexOf(coluna) !== -1) {
      aba.getRange(numeroLinha, i + 1).setNumberFormat('@');
    }
  });
}
