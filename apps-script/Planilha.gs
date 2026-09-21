/**
 * GPEL - Acesso genérico à planilha.
 * Nenhuma regra de negócio aqui: apenas ler, criar, atualizar e excluir linhas.
 */

var _planilha = null;
var _cacheAbas = {};
var _colunasConferidas = {};
var _estruturas = {};

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

/**
 * Descobre em que linha está o cabeçalho e como cada coluna se chama por aqui.
 *
 * A planilha da GPEL tem título nas primeiras linhas e o cabeçalho mais abaixo.
 * Em vez de exigir um formato, o sistema procura, nas primeiras linhas, aquela
 * que mais parece um cabeçalho: a que traz mais nomes de coluna conhecidos.
 */
function estruturaDe_(nomeTabela) {
  if (_estruturas[nomeTabela]) return _estruturas[nomeTabela];

  var aba = abaDe(nomeTabela);
  var def = TABELAS[nomeTabela];
  var largura = Math.max(aba.getLastColumn(), 1);
  // Olha sempre as primeiras linhas, não só as que têm conteúdo: uma faixa
  // reservada ao cabeçalho pode estar pintada e vazia, e getLastRow não a vê.
  var altura = Math.min(15, aba.getMaxRows ? aba.getMaxRows() : 15);
  var estrutura = { linha: 1, colunas: [] };

  if (altura >= 1) {
    var aceitos = nomesAceitos_(def);
    var amostra = aba.getRange(1, 1, altura, largura).getValues();
    var melhorPontuacao = -1;

    for (var i = 0; i < amostra.length; i++) {
      var linha = amostra[i].map(textoLimpo_);
      var preenchidas = 0;
      var reconhecidas = 0;
      linha.forEach(function (celula) {
        if (!celula) return;
        preenchidas++;
        if (aceitos[normalizarNome_(celula)]) reconhecidas++;
      });
      // Só é cabeçalho quem traz pelo menos dois nomes de coluna conhecidos.
      // Sem isso, uma faixa de título com uma coluna solta ao lado passaria
      // por cabeçalho e os dados seriam gravados por cima do título.
      if (preenchidas < 2 || reconhecidas < 2) continue;
      var pontuacao = reconhecidas * 10 + preenchidas;
      if (pontuacao > melhorPontuacao) {
        melhorPontuacao = pontuacao;
        estrutura = { linha: i + 1, colunas: linha };
      }
    }

    // Nenhuma linha parece cabeçalho: ou a aba é nova, ou o cabeçalho sumiu.
    if (melhorPontuacao < 0) {
      var restaurada = restaurarCabecalho_(aba, def, amostra);
      if (restaurada) estrutura = restaurada;
    }

    // Traduz os nomes da planilha para os nomes usados pelo sistema.
    var jaUsados = {};
    estrutura.colunas = estrutura.colunas.map(function (nomeNaPlanilha) {
      var canonico = aceitos[normalizarNome_(nomeNaPlanilha)];
      if (canonico && !jaUsados[canonico]) {
        jaUsados[canonico] = true;
        return canonico;
      }
      return nomeNaPlanilha; // coluna própria da planilha: fica como está
    });
  }

  _estruturas[nomeTabela] = estrutura;
  return estrutura;
}

/**
 * Escreve o cabeçalho quando a aba ficou sem nenhum.
 *
 * Só acontece em aba sem dados: havendo conteúdo que não se reconhece, é mais
 * seguro não inventar cabeçalho nenhum do que rotular a coluna errada.
 *
 * A linha escolhida é, em ordem: uma faixa pintada e vazia (a linha que a
 * planilha reservou para o cabeçalho), a primeira linha vazia depois do
 * título, ou a primeira linha.
 */
function restaurarCabecalho_(aba, def, amostra) {
  if (!def.campos || !def.campos.length) return null;

  var temDados = amostra.some(function (linha) {
    return linha.filter(function (c) { return textoLimpo_(c) !== ''; }).length >= 3;
  });
  if (temDados) return null;

  var alvo = 0;
  var fundos = [];
  try {
    fundos = aba.getRange(1, 1, amostra.length, Math.max(aba.getLastColumn(), 1)).getBackgrounds();
  } catch (e) {
    fundos = [];
  }

  for (var i = 0; i < amostra.length; i++) {
    var vazia = amostra[i].every(function (c) { return textoLimpo_(c) === ''; });
    if (!vazia) continue;
    var pintadas = (fundos[i] || []).filter(function (cor) {
      return cor && cor !== '#ffffff' && cor !== '#FFFFFF';
    }).length;
    if (pintadas >= 2) { alvo = i + 1; break; }   // faixa reservada ao cabeçalho
    if (!alvo) alvo = i + 1;                      // primeira linha vazia serve de reserva
  }
  if (!alvo) alvo = amostra.length + 1;

  var nomes = def.campos.map(function (campo) { return campo.nome; });
  aba.getRange(alvo, 1, 1, nomes.length).setValues([nomes]).setFontWeight('bold');
  return { linha: alvo, colunas: nomes };
}

/** Acrescenta, ao lado do cabeçalho, as colunas previstas que ainda não existem. */
function acrescentarColunasFaltantes_(aba, def) {
  var estrutura = estruturaDe_(def.nome || aba.getName());
  var cabecalho = estrutura.colunas;
  var faltantes = def.campos
    .map(function (c) { return c.nome; })
    .filter(function (nome) { return cabecalho.indexOf(nome) === -1; });
  if (!faltantes.length) return;

  var inicio = cabecalho.filter(function (c) { return c !== ''; }).length + 1;
  aba.getRange(estrutura.linha, inicio, 1, faltantes.length)
     .setValues([faltantes])
     .setFontWeight('bold');
  if (aba.getFrozenRows() === 0 && estrutura.linha === 1) aba.setFrozenRows(1);
  delete _estruturas[aba.getName()]; // o cabeçalho mudou: descobrir de novo
}

function textoLimpo_(valor) {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

/** Reduz o nome de uma coluna ao essencial: sem acento, pontuação nem caixa. */
function normalizarNome_(texto) {
  return textoLimpo_(texto)
    .toLowerCase()
    .replace(/[áàâã]/g, 'a').replace(/[éêe]/g, 'e').replace(/[íï]/g, 'i')
    .replace(/[óôõ]/g, 'o').replace(/[úü]/g, 'u').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

/** Nomes que o sistema aceita para cada coluna prevista da tabela. */
function nomesAceitos_(def) {
  var aceitos = {}; // normalizado -> nome canônico
  (def.campos || []).forEach(function (campo) {
    aceitos[normalizarNome_(campo.nome)] = campo.nome;
    var sinonimos = (typeof SINONIMOS !== 'undefined' && SINONIMOS[campo.nome]) || [];
    sinonimos.forEach(function (apelido) {
      var chave = normalizarNome_(apelido);
      if (!aceitos[chave]) aceitos[chave] = campo.nome;
    });
  });
  return aceitos;
}

/** Colunas da tabela, com os nomes usados pelo sistema. */
function cabecalhoDe_(nomeTabela) {
  return estruturaDe_(nomeTabela).colunas;
}

/** Linha em que o cabeçalho da tabela está na planilha. */
function linhaDoCabecalho_(nomeTabela) {
  return estruturaDe_(nomeTabela).linha;
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
  var estrutura = estruturaDe_(nomeTabela);
  var ultimaLinha = aba.getLastRow();
  var ultimaColuna = aba.getLastColumn();
  var primeiraLinhaDeDados = estrutura.linha + 1;
  if (ultimaLinha < primeiraLinhaDeDados || ultimaColuna < 1) return [];

  var cabecalho = estrutura.colunas;
  var valores = aba.getRange(primeiraLinhaDeDados, 1, ultimaLinha - estrutura.linha, ultimaColuna).getValues();

  var registros = [];
  for (var i = 0; i < valores.length; i++) {
    var linha = valores[i];
    if (linha.join('') === '') continue; // ignora linhas em branco
    var registro = { _linha: primeiraLinhaDeDados + i };
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
  var cabecalho = cabecalhoDe_(nomeTabela);
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
  var cabecalho = cabecalhoDe_(nomeTabela);
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
  delete _estruturas[nomeTabela];
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
