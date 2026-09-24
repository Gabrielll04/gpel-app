/**
 * GPEL - conferência de versões.
 *
 * ARQUIVO GERADO por ferramentas/empacotar.js — não edite aqui.
 *
 * Cada arquivo .gs carrega na primeira linha uma marca tirada do próprio
 * conteúdo. Esta tabela diz quais marcas formam uma entrega completa: se
 * algum arquivo colado no editor for de outra entrega, o servidor recusa
 * trabalhar e diz qual é, em vez de quebrar de um jeito confuso.
 */

var ENTREGA_GPEL = '24/09/2026';

var VERSOES_ESPERADAS = {
  'Acesso.gs': { marca: '3140da2e', opcional: false },
  'Automacoes.gs': { marca: 'd3d750a6', opcional: false },
  'Codigo.gs': { marca: 'ea6f963a', opcional: false },
  'Config.gs': { marca: '6df8b282', opcional: false },
  'DadosDeTeste.gs': { marca: 'd8c6eb3e', opcional: true },
  'Estoque.gs': { marca: '09392daa', opcional: false },
  'Pagina.gs': { marca: '21346ede', opcional: false },
  'Planilha.gs': { marca: 'c99ef486', opcional: false },
  'Regras.gs': { marca: '3a407642', opcional: false }
};

/** Marca que cada arquivo colado no editor está trazendo. */
function marcasEncontradas_() {
  return {
    'Acesso.gs': typeof VERSAO__ACESSO !== 'undefined' ? VERSAO__ACESSO : '',
    'Automacoes.gs': typeof VERSAO__AUTOMACOES !== 'undefined' ? VERSAO__AUTOMACOES : '',
    'Codigo.gs': typeof VERSAO__CODIGO !== 'undefined' ? VERSAO__CODIGO : '',
    'Config.gs': typeof VERSAO__CONFIG !== 'undefined' ? VERSAO__CONFIG : '',
    'DadosDeTeste.gs': typeof VERSAO__DADOSDETESTE !== 'undefined' ? VERSAO__DADOSDETESTE : '',
    'Estoque.gs': typeof VERSAO__ESTOQUE !== 'undefined' ? VERSAO__ESTOQUE : '',
    'Pagina.gs': typeof VERSAO__PAGINA !== 'undefined' ? VERSAO__PAGINA : '',
    'Planilha.gs': typeof VERSAO__PLANILHA !== 'undefined' ? VERSAO__PLANILHA : '',
    'Regras.gs': typeof VERSAO__REGRAS !== 'undefined' ? VERSAO__REGRAS : ''
  };
}

/** Lista os arquivos que não são desta entrega (vazia = tudo certo). */
function estadoDasVersoes_() {
  var encontradas = marcasEncontradas_();
  var problemas = [];
  Object.keys(VERSOES_ESPERADAS).forEach(function (arquivo) {
    var esperado = VERSOES_ESPERADAS[arquivo];
    var achada = encontradas[arquivo];
    if (achada === esperado.marca) return;
    if (!achada && esperado.opcional) return;
    problemas.push(arquivo + (achada ? '' : ' (não foi colado, ou é de antes da marca de versão)'));
  });
  return { entrega: ENTREGA_GPEL, problemas: problemas };
}

/** Recusa trabalhar com arquivos de entregas diferentes. */
function conferirVersoes_() {
  var estado = estadoDasVersoes_();
  if (!estado.problemas.length) return;
  throw new Error(
    'Os arquivos do Apps Script são de entregas diferentes. Cole a versão atual de: ' +
    estado.problemas.join(', ') + '. Esta entrega é de ' + estado.entrega + ' — se foi o Versoes.gs que ficou para trás, cole ele também.'
  );
}
