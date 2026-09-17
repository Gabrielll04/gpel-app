/**
 * GPEL - Acesso genérico à planilha.
 * Nenhuma regra de negócio aqui: apenas ler, criar, atualizar e excluir linhas.
 */

/** Devolve a planilha configurada (ou a planilha ativa, se o script for vinculado a ela). */
function abrirPlanilha() {
  if (ID_PLANILHA) return SpreadsheetApp.openById(ID_PLANILHA);
  var ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (!ativa) throw new Error('Planilha não configurada. Preencha ID_PLANILHA em Config.gs.');
  return ativa;
}

/** Garante que a aba existe e que o cabeçalho tem todas as colunas previstas. */
function abaDe(nomeTabela) {
  var def = TABELAS[nomeTabela];
  if (!def) throw new Error('Tabela desconhecida: ' + nomeTabela);
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
    return aba;
  }
  if (!def.colunasLivres) acrescentarColunasFaltantes_(aba, def);
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
 * Lê todas as linhas de uma tabela.
 * Cada registro vem com a coluna técnica _linha (número da linha na planilha).
 */
function listar(nomeTabela, opcoes) {
  opcoes = opcoes || {};
  var aba = abaDe(nomeTabela);
  var ultimaLinha = aba.getLastRow();
  var cabecalho = cabecalhoDe_(aba);
  if (ultimaLinha < 2 || !cabecalho.length) return [];

  var valores = aba.getRange(2, 1, ultimaLinha - 1, cabecalho.length).getValues();
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
  var aba = abaDe(nomeTabela);
  var cabecalho = cabecalhoDe_(aba);
  var numeroLinha = aba.getLastRow() + 1;
  formatarColunasTexto_(aba, cabecalho, numeroLinha);
  var linha = objetoParaLinha_(cabecalho, registro, null);
  aba.getRange(numeroLinha, 1, 1, cabecalho.length).setValues([linha]);
  registro._linha = numeroLinha;
  return registro;
}

/** Atualiza uma linha existente (identificada por _linha) e devolve o registro final. */
function atualizarLinha(nomeTabela, numeroLinha, registro, anterior) {
  var aba = abaDe(nomeTabela);
  var cabecalho = cabecalhoDe_(aba);
  formatarColunasTexto_(aba, cabecalho, numeroLinha);
  var linha = objetoParaLinha_(cabecalho, registro, anterior);
  aba.getRange(numeroLinha, 1, 1, cabecalho.length).setValues([linha]);
  var final = {};
  cabecalho.forEach(function (coluna, i) { if (coluna) final[coluna] = linha[i]; });
  final._linha = numeroLinha;
  return final;
}

/** Exclui uma linha (permitido apenas para cadastros). */
function excluirLinha(nomeTabela, numeroLinha) {
  abaDe(nomeTabela).deleteRow(numeroLinha);
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
