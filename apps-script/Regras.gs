var VERSAO__REGRAS = '3a407642'; // marca de versão, gerada por ferramentas/empacotar.js
/**
 * GPEL - Regras de negócio.
 * Todo cálculo do sistema acontece aqui (e SOMENTE aqui).
 * A planilha não deve conter fórmulas nessas colunas.
 */

/** Converte texto digitado em número. Aceita "1.234,56" e "1234.56". */
function paraNumero_(valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return valor;
  var texto = String(valor).trim().replace(/\s/g, '').replace(/R\$/g, '');
  if (texto === '') return '';
  if (texto.indexOf(',') !== -1 && texto.indexOf('.') !== -1) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else if (texto.indexOf(',') !== -1) {
    texto = texto.replace(',', '.');
  }
  var numero = Number(texto);
  return isNaN(numero) ? '' : numero;
}

function numeroOuZero_(valor) {
  var n = paraNumero_(valor);
  return n === '' ? 0 : n;
}

function hoje_() {
  return Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
}

/** Normaliza data para aaaa-mm-dd. */
function paraData_(valor) {
  if (!valor) return '';
  if (valor instanceof Date) return Utilities.formatDate(valor, FUSO, 'yyyy-MM-dd');
  var texto = String(valor).trim();
  var br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return br[3] + '-' + br[2] + '-' + br[1];
  var iso = texto.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : texto;
}

function definicaoCampo_(nomeTabela, nomeCampo) {
  var campos = TABELAS[nomeTabela].campos || [];
  for (var i = 0; i < campos.length; i++) if (campos[i].nome === nomeCampo) return campos[i];
  return null;
}

/** Cadastro correspondente à classe informada (Produto/Insumo). */
function cadastroDaClasse_(classe) {
  return textoLimpo_(classe) === 'Insumo'
    ? { tabela: 'CAD_INSUMOS', chave: 'Código', rotulo: 'Item' }
    : { tabela: 'CAD_PRODUTOS', chave: 'Código', rotulo: 'Produto' };
}

/** Busca um item de cadastro; devolve null se não existir. */
function buscarItemCadastro_(classe, codigo) {
  var cad = cadastroDaClasse_(classe);
  return buscarPorId(cad.tabela, codigo);
}

/**
 * Prepara um registro para gravação:
 * aplica padrões, converte tipos, preenche campos automáticos, calcula e valida.
 * Lança Error com mensagem em português quando algo estiver errado.
 */
function prepararRegistro(nomeTabela, entrada, anterior) {
  var def = TABELAS[nomeTabela];
  if (!def) throw new Error('Tabela desconhecida: ' + nomeTabela);
  if (def.somenteLeitura) throw new Error('A tabela ' + nomeTabela + ' é somente leitura.');

  var registro = {};
  var campos = def.campos || [];

  campos.forEach(function (campo) {
    var nome = campo.nome;
    var valor;
    if (Object.prototype.hasOwnProperty.call(entrada, nome)) valor = entrada[nome];
    else if (anterior && Object.prototype.hasOwnProperty.call(anterior, nome)) valor = anterior[nome];
    else if (campo.padrao !== undefined) valor = campo.padrao === 'hoje' ? hoje_() : campo.padrao;
    else valor = '';

    switch (campo.tipo) {
      case 'numero':
      case 'decimal':
      case 'dinheiro':
        valor = paraNumero_(valor);
        break;
      case 'data':
        valor = paraData_(valor);
        break;
      default:
        valor = valor === null || valor === undefined ? '' : (typeof valor === 'number' ? valor : String(valor).trim());
    }
    registro[nome] = valor;
  });

  preencherAutomaticos_(nomeTabela, registro);
  calcular_(nomeTabela, registro);
  validar_(nomeTabela, registro);
  return registro;
}

/** Preenche os campos que vêm de cadastro (Item, Unidade, Saldo Sistema). */
function preencherAutomaticos_(nomeTabela, registro) {
  if (nomeTabela === 'PEDIDOS' || nomeTabela === 'PRODUCAO') {
    var produto = registro['Produto'] ? buscarPorId('CAD_PRODUTOS', registro['Produto']) : null;
    registro['Unidade'] = produto ? textoLimpo_(produto['Unidade']) : '';
    return;
  }

  if (nomeTabela === 'MOV_ESTOQUE' || nomeTabela === 'COMPRAS' || nomeTabela === 'INVENTARIO') {
    var colunaCodigo = nomeTabela === 'INVENTARIO' ? 'Código' : 'Código Item';
    var item = registro[colunaCodigo] ? buscarItemCadastro_(registro['Classe'], registro[colunaCodigo]) : null;
    var cad = cadastroDaClasse_(registro['Classe']);
    registro['Item'] = item ? textoLimpo_(item[cad.rotulo]) : '';
    if (Object.prototype.hasOwnProperty.call(registro, 'Unidade')) {
      registro['Unidade'] = item ? textoLimpo_(item['Unidade']) : '';
    }
    if (nomeTabela === 'INVENTARIO') {
      registro['Saldo Sistema'] = saldoDoItem(registro[colunaCodigo]);
    }
  }
}

/** Calcula os campos derivados. Fonte única de cálculo do sistema. */
function calcular_(nomeTabela, registro) {
  switch (nomeTabela) {
    case 'PEDIDOS':
    case 'COMPRAS':
      registro['Valor Total'] = arredondar_(numeroOuZero_(registro['Quantidade']) * numeroOuZero_(registro['Valor Unit.']), 2);
      break;

    case 'PRODUCAO':
      var produzido = numeroOuZero_(registro['Produzido']);
      var horas = numeroOuZero_(registro['Horas']);
      var pessoas = numeroOuZero_(registro['Pessoas']);
      registro['Prod./h'] = horas > 0 ? arredondar_(produzido / horas, 2) : '';
      registro['Prod./HH'] = (horas > 0 && pessoas > 0) ? arredondar_(produzido / (horas * pessoas), 2) : '';
      break;

    case 'MOV_ESTOQUE':
      var quantidade = numeroOuZero_(registro['Quantidade']);
      registro['Qtd. Assinada'] = textoLimpo_(registro['Entrada/Saída']) === 'Entrada' ? quantidade : -quantidade;
      break;

    case 'INVENTARIO':
      var diferenca = arredondar_(numeroOuZero_(registro['Contagem Física']) - numeroOuZero_(registro['Saldo Sistema']), 4);
      registro['Diferença'] = diferenca;
      registro['Ajuste?'] = diferenca !== 0 ? 'Sim' : 'Não';
      break;
  }
}

function arredondar_(numero, casas) {
  var fator = Math.pow(10, casas);
  return Math.round(numero * fator) / fator;
}

/** Validação com mensagens claras em português. */
function validar_(nomeTabela, registro) {
  var def = TABELAS[nomeTabela];
  var erros = [];

  (def.campos || []).forEach(function (campo) {
    if (!campo.obrigatorio) return;
    if (campo.auto || campo.tipo === 'calculado') return;
    if (campo.nome === def.chave && def.idAutomatico) return;
    var valor = registro[campo.nome];
    if (valor === '' || valor === null || valor === undefined) {
      erros.push('Informe "' + campo.nome + '".');
    }
  });

  (def.campos || []).forEach(function (campo) {
    if (campo.tipo !== 'lista') return;
    var valor = textoLimpo_(registro[campo.nome]);
    if (!valor) return;
    var opcoes = ENUMS[campo.lista] || [];
    if (opcoes.indexOf(valor) === -1) {
      erros.push('"' + valor + '" não é uma opção válida para ' + campo.nome + '.');
    }
  });

  if (nomeTabela === 'PEDIDOS') {
    if (numeroOuZero_(registro['Quantidade']) <= 0) erros.push('A quantidade do pedido deve ser maior que zero.');
    if (numeroOuZero_(registro['Valor Unit.']) < 0) erros.push('O valor unitário não pode ser negativo.');
    if (registro['Cliente'] && !buscarPorId('CAD_CLIENTES', registro['Cliente'])) erros.push('Cliente não encontrado no cadastro.');
    if (registro['Produto'] && !buscarPorId('CAD_PRODUTOS', registro['Produto'])) erros.push('Produto não encontrado no cadastro.');
    if (registro['Data'] && registro['Prazo / Data Entrega'] && registro['Prazo / Data Entrega'] < registro['Data']) {
      erros.push('A data de entrega não pode ser anterior à data do pedido.');
    }
  }

  if (nomeTabela === 'PRODUCAO') {
    if (registro['Produto'] && !buscarPorId('CAD_PRODUTOS', registro['Produto'])) erros.push('Produto não encontrado no cadastro.');
    if (numeroOuZero_(registro['Horas']) < 0) erros.push('As horas não podem ser negativas.');
    if (numeroOuZero_(registro['Pessoas']) < 0) erros.push('O número de pessoas não pode ser negativo.');
    if (numeroOuZero_(registro['Produzido']) < 0) erros.push('O produzido não pode ser negativo.');
  }

  if (nomeTabela === 'COMPRAS') {
    if (numeroOuZero_(registro['Quantidade']) <= 0) erros.push('A quantidade da compra deve ser maior que zero.');
    if (registro['Fornecedor'] && !buscarPorId('CAD_FORNECEDORES', registro['Fornecedor'])) erros.push('Fornecedor não encontrado no cadastro.');
  }

  if (nomeTabela === 'MOV_ESTOQUE') {
    if (numeroOuZero_(registro['Quantidade']) <= 0) erros.push('A quantidade da movimentação deve ser maior que zero.');
  }

  if (nomeTabela === 'INVENTARIO') {
    if (registro['Contagem Física'] === '') erros.push('Informe a contagem física.');
    if (numeroOuZero_(registro['Contagem Física']) < 0) erros.push('A contagem física não pode ser negativa.');
  }

  if ((nomeTabela === 'MOV_ESTOQUE' || nomeTabela === 'COMPRAS' || nomeTabela === 'INVENTARIO') && !registro['Item']) {
    var coluna = nomeTabela === 'INVENTARIO' ? 'Código' : 'Código Item';
    if (registro[coluna]) erros.push('Item "' + registro[coluna] + '" não encontrado no cadastro de ' + (textoLimpo_(registro['Classe']) === 'Insumo' ? 'insumos.' : 'produtos.'));
  }

  if (erros.length) throw new Error(erros.join(' '));
}

/** Impede código duplicado nos cadastros. */
function validarCodigoUnico_(nomeTabela, codigo, linhaAtual) {
  var def = TABELAS[nomeTabela];
  var alvo = textoLimpo_(codigo);
  var duplicado = listar(nomeTabela).some(function (r) {
    return textoLimpo_(r[def.chave]) === alvo && r._linha !== linhaAtual;
  });
  if (duplicado) throw new Error('Já existe um registro com o código "' + alvo + '".');
}
