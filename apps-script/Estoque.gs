/**
 * GPEL - Estoque.
 *
 * Princípio central: o saldo NUNCA é digitado.
 * Ele é sempre a soma das movimentações registradas em MOV_ESTOQUE.
 * Correções entram como nova movimentação — nada é apagado.
 */

/** Entradas, saídas e saldo de um item, a partir de MOV_ESTOQUE. */
function totaisDoItem_(movimentos, codigo) {
  var alvo = textoLimpo_(codigo);
  var entradas = 0;
  var saidas = 0;
  movimentos.forEach(function (m) {
    if (textoLimpo_(m['Código Item']) !== alvo) return;
    var quantidade = numeroOuZero_(m['Quantidade']);
    if (textoLimpo_(m['Entrada/Saída']) === 'Entrada') entradas += quantidade;
    else saidas += quantidade;
  });
  return {
    entradas: arredondar_(entradas, 4),
    saidas: arredondar_(saidas, 4),
    saldo: arredondar_(entradas - saidas, 4)
  };
}

/** Saldo atual de um item (usado pelo inventário). */
function saldoDoItem(codigo) {
  return totaisDoItem_(listar('MOV_ESTOQUE'), codigo).saldo;
}

/** Status do saldo conforme o estoque mínimo cadastrado. */
function statusEstoque_(saldo, minimo) {
  if (minimo === '' || minimo === null || minimo === undefined) return 'DEFINIR MÍNIMO';
  return saldo <= numeroOuZero_(minimo) ? 'REPOR' : 'OK';
}

/**
 * Recalcula ESTOQUE_ATUAL a partir de MOV_ESTOQUE e regrava a aba.
 * Só "Estoque Mín." é preservado, porque é o único campo digitado pela usuária.
 */
function recalcularEstoque() {
  var movimentos = listar('MOV_ESTOQUE');
  var anteriores = {};
  listar('ESTOQUE_ATUAL').forEach(function (r) {
    anteriores[textoLimpo_(r['Código'])] = r['Estoque Mín.'];
  });

  var itens = [];
  var vistos = {};

  function acrescentar(classe, codigo, nome, unidade) {
    var chave = textoLimpo_(codigo);
    if (!chave || vistos[chave]) return;
    vistos[chave] = true;
    itens.push({ classe: classe, codigo: chave, item: nome, unidade: unidade });
  }

  listar('CAD_PRODUTOS').forEach(function (p) {
    acrescentar('Produto', p['Código'], textoLimpo_(p['Produto']), textoLimpo_(p['Unidade']));
  });
  listar('CAD_INSUMOS').forEach(function (i) {
    acrescentar('Insumo', i['Código'], textoLimpo_(i['Item']), textoLimpo_(i['Unidade']));
  });
  // Itens que só aparecem em movimentações (cadastro excluído, por exemplo) não podem sumir do saldo.
  movimentos.forEach(function (m) {
    acrescentar(textoLimpo_(m['Classe']) || 'Produto', m['Código Item'], textoLimpo_(m['Item']), textoLimpo_(m['Unidade']));
  });

  var linhas = itens.map(function (item) {
    var totais = totaisDoItem_(movimentos, item.codigo);
    var minimo = Object.prototype.hasOwnProperty.call(anteriores, item.codigo) ? anteriores[item.codigo] : '';
    if (minimo !== '') minimo = paraNumero_(minimo);
    return {
      'Classe': item.classe,
      'Código': item.codigo,
      'Item': item.item,
      'Unidade': item.unidade,
      'Entradas': totais.entradas,
      'Saídas': totais.saidas,
      'Saldo Atual': totais.saldo,
      'Estoque Mín.': minimo,
      'Status': statusEstoque_(totais.saldo, minimo)
    };
  });

  gravarEstoqueAtual_(linhas);
  return linhas;
}

/** Regrava a aba ESTOQUE_ATUAL inteira com valores (nunca fórmulas). */
function gravarEstoqueAtual_(linhas) {
  var aba = abaDe('ESTOQUE_ATUAL');
  var cabecalho = cabecalhoDe_(aba);
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha > 1) aba.getRange(2, 1, ultimaLinha - 1, Math.max(cabecalho.length, 1)).clearContent();
  if (!linhas.length) return;
  var matriz = linhas.map(function (linha) {
    return cabecalho.map(function (coluna) {
      var valor = linha[coluna];
      return valor === undefined || valor === null ? '' : valor;
    });
  });
  aba.getRange(2, 1, matriz.length, cabecalho.length).setValues(matriz);
}

/** Define o estoque mínimo de um item (único campo digitável de ESTOQUE_ATUAL). */
function definirEstoqueMinimo(codigo, minimo) {
  var alvo = textoLimpo_(codigo);
  var aba = abaDe('ESTOQUE_ATUAL');
  var cabecalho = cabecalhoDe_(aba);
  var registros = listar('ESTOQUE_ATUAL');
  var achado = null;
  registros.forEach(function (r) { if (textoLimpo_(r['Código']) === alvo) achado = r; });
  if (!achado) throw new Error('Item não encontrado no estoque: ' + alvo);

  var valor = minimo === '' || minimo === null || minimo === undefined ? '' : paraNumero_(minimo);
  aba.getRange(achado._linha, cabecalho.indexOf('Estoque Mín.') + 1).setValue(valor);
  aba.getRange(achado._linha, cabecalho.indexOf('Status') + 1)
     .setValue(statusEstoque_(numeroOuZero_(achado['Saldo Atual']), valor));
  return { 'Código': alvo, 'Estoque Mín.': valor };
}

/**
 * Cria uma movimentação de estoque.
 * É o único caminho para alterar saldo — usado pelas telas e pelas automações.
 */
function criarMovimento(dados) {
  var registro = prepararRegistro('MOV_ESTOQUE', dados, null);
  registro['ID Movimento'] = gerarId(TABELAS['MOV_ESTOQUE'].prefixoId);
  inserirLinha('MOV_ESTOQUE', registro);
  return registro;
}

/**
 * Automação: Compra -> Entrada em MOV_ESTOQUE.
 * Executada APENAS na criação da compra.
 * A coluna técnica "Mov. Gerado" guarda o ID da movimentação criada e garante
 * que uma compra gere exatamente uma entrada, mesmo se a compra for editada depois.
 */
function gerarEntradaDaCompra_(compra, responsavel) {
  if (textoLimpo_(compra['Mov. Gerado'])) return null; // já gerou: não duplica

  var movimento = criarMovimento({
    'Data': compra['Data'],
    'Classe': compra['Classe'],
    'Código Item': compra['Código Item'],
    'Entrada/Saída': 'Entrada',
    'Origem': 'Compra',
    'Quantidade': compra['Quantidade'],
    'Documento Ref.': compra['NF'] || compra['ID Compra'],
    'Responsável': responsavel || '',
    'Observações': 'Entrada automática - Compra / NF: ' + (textoLimpo_(compra['NF']) || 'sem NF')
  });

  var aba = abaDe('COMPRAS');
  var cabecalho = cabecalhoDe_(aba);
  aba.getRange(compra._linha, cabecalho.indexOf('Mov. Gerado') + 1).setValue(movimento['ID Movimento']);
  compra['Mov. Gerado'] = movimento['ID Movimento'];
  return movimento;
}

/** Movimentação de ajuste já gerada para um inventário (controle de idempotência). */
function ajusteDoInventario_(idInventario) {
  var alvo = textoLimpo_(idInventario);
  var achado = null;
  listar('MOV_ESTOQUE').forEach(function (m) {
    var origem = textoLimpo_(m['Origem']);
    if ((origem === 'Inventário +' || origem === 'Inventário -') && textoLimpo_(m['Documento Ref.']) === alvo) {
      achado = m;
    }
  });
  return achado;
}

/**
 * Aprova o ajuste de um inventário.
 * A divergência sozinha NUNCA altera o saldo: é preciso esta ação explícita,
 * que gera uma movimentação rastreável (Inventário + / Inventário -).
 */
function aprovarAjusteInventario(idInventario, responsavel) {
  var inventario = buscarPorId('INVENTARIO', idInventario);
  if (!inventario) throw new Error('Inventário não encontrado: ' + idInventario);
  if (ajusteDoInventario_(idInventario)) throw new Error('O ajuste deste inventário já foi aprovado anteriormente.');

  // Recalcula a diferença contra o saldo atual: movimentações podem ter ocorrido
  // depois da contagem, e o ajuste precisa levar o saldo até a contagem física.
  var saldoAtual = saldoDoItem(inventario['Código']);
  var contagem = numeroOuZero_(inventario['Contagem Física']);
  var diferenca = arredondar_(contagem - saldoAtual, 4);

  var aba = abaDe('INVENTARIO');
  var cabecalho = cabecalhoDe_(aba);
  aba.getRange(inventario._linha, cabecalho.indexOf('Saldo Sistema') + 1).setValue(saldoAtual);
  aba.getRange(inventario._linha, cabecalho.indexOf('Diferença') + 1).setValue(diferenca);
  aba.getRange(inventario._linha, cabecalho.indexOf('Ajuste?') + 1).setValue(diferenca !== 0 ? 'Sim' : 'Não');

  if (diferenca === 0) throw new Error('Não há diferença entre a contagem e o saldo atual. Nenhum ajuste foi necessário.');

  var movimento = criarMovimento({
    'Data': inventario['Data'],
    'Classe': inventario['Classe'],
    'Código Item': inventario['Código'],
    'Entrada/Saída': diferenca > 0 ? 'Entrada' : 'Saída',
    'Origem': diferenca > 0 ? 'Inventário +' : 'Inventário -',
    'Quantidade': Math.abs(diferenca),
    'Documento Ref.': textoLimpo_(inventario['ID Inventário']),
    'Responsável': responsavel || textoLimpo_(inventario['Responsável']),
    'Observações': 'Ajuste de inventário aprovado. Saldo anterior: ' + saldoAtual + ' / Contagem: ' + contagem
  });

  recalcularEstoque();
  return { movimento: movimento, diferenca: diferenca, saldoAnterior: saldoAtual };
}

/** Inventários com a informação de ajuste já aprovado (derivada de MOV_ESTOQUE). */
function listarInventarios() {
  var movimentos = listar('MOV_ESTOQUE');
  var aprovados = {};
  movimentos.forEach(function (m) {
    var origem = textoLimpo_(m['Origem']);
    if (origem === 'Inventário +' || origem === 'Inventário -') {
      aprovados[textoLimpo_(m['Documento Ref.'])] = textoLimpo_(m['ID Movimento']);
    }
  });
  return listar('INVENTARIO').map(function (r) {
    var id = textoLimpo_(r['ID Inventário']);
    r._ajusteAprovado = !!aprovados[id];
    r._movimentoAjuste = aprovados[id] || '';
    return r;
  });
}
