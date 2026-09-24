/**
 * GPEL - marca de versão dos arquivos do Apps Script.
 *
 * Por que isso existe: os arquivos são colados um a um no editor do Google, e
 * mais de uma vez um arquivo antigo ficou misturado com os novos — o sistema
 * quebrava de jeitos confusos. Com a marca, o próprio servidor percebe a
 * mistura e diz qual arquivo está desatualizado, antes de gravar qualquer coisa.
 *
 * Como funciona:
 *   - cada .gs ganha na primeira linha  var VERSAO__NOME = '<marca>';
 *     A marca é calculada a partir do conteúdo do próprio arquivo: mudou o
 *     arquivo, muda a marca. Arquivo que não mudou mantém a marca, então só
 *     os arquivos alterados precisam ser colados de novo.
 *   - Versoes.gs (gerado) guarda a marca esperada de cada arquivo e a função
 *     conferirVersoes_(), chamada pelo servidor.
 *
 * É executado pelo empacotador (node ferramentas/empacotar.js). Não edite as
 * marcas nem o Versoes.gs na mão.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PASTA = path.join(__dirname, '..', 'apps-script');
const GERADO = 'Versoes.gs';

/** Arquivos que podem faltar sem travar o sistema (se existirem, conferem). */
const OPCIONAIS = ['DadosDeTeste.gs'];

const MARCA_NA_PRIMEIRA_LINHA = /^var VERSAO__[A-Z0-9_]+ = '[0-9a-f]*';[^\n]*\n/;

function nomeDaMarca(arquivo) {
  return 'VERSAO__' + arquivo.replace(/\.gs$/, '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function semMarca(conteudo) {
  return conteudo.replace(MARCA_NA_PRIMEIRA_LINHA, '');
}

function marcaDe(conteudo) {
  return crypto.createHash('sha256').update(semMarca(conteudo)).digest('hex').slice(0, 8);
}

function arquivosDoServidor() {
  return fs.readdirSync(PASTA)
    .filter((a) => a.endsWith('.gs') && a !== GERADO)
    .sort();
}

/** Conteúdo que cada arquivo deveria ter (com a marca certa) e o Versoes.gs. */
function calcular(dataDaEntrega) {
  const esperados = {};
  const marcas = {};

  arquivosDoServidor().forEach((arquivo) => {
    const atual = fs.readFileSync(path.join(PASTA, arquivo), 'utf8');
    const marca = marcaDe(atual);
    const linha = 'var ' + nomeDaMarca(arquivo) + " = '" + marca + "'; // marca de versão, gerada por ferramentas/empacotar.js\n";
    esperados[arquivo] = linha + semMarca(atual);
    marcas[arquivo] = marca;
  });

  const nomes = Object.keys(marcas);
  const versoes = [
    '/**',
    ' * GPEL - conferência de versões.',
    ' *',
    ' * ARQUIVO GERADO por ferramentas/empacotar.js — não edite aqui.',
    ' *',
    ' * Cada arquivo .gs carrega na primeira linha uma marca tirada do próprio',
    ' * conteúdo. Esta tabela diz quais marcas formam uma entrega completa: se',
    ' * algum arquivo colado no editor for de outra entrega, o servidor recusa',
    ' * trabalhar e diz qual é, em vez de quebrar de um jeito confuso.',
    ' */',
    '',
    "var ENTREGA_GPEL = '" + dataDaEntrega + "';",
    '',
    'var VERSOES_ESPERADAS = {',
    nomes.map((a) => "  '" + a + "': { marca: '" + marcas[a] + "', opcional: " + (OPCIONAIS.includes(a)) + ' }').join(',\n'),
    '};',
    '',
    '/** Marca que cada arquivo colado no editor está trazendo. */',
    'function marcasEncontradas_() {',
    '  return {',
    nomes.map((a) => "    '" + a + "': typeof " + nomeDaMarca(a) + " !== 'undefined' ? " + nomeDaMarca(a) + " : ''").join(',\n'),
    '  };',
    '}',
    '',
    '/** Lista os arquivos que não são desta entrega (vazia = tudo certo). */',
    'function estadoDasVersoes_() {',
    '  var encontradas = marcasEncontradas_();',
    '  var problemas = [];',
    '  Object.keys(VERSOES_ESPERADAS).forEach(function (arquivo) {',
    '    var esperado = VERSOES_ESPERADAS[arquivo];',
    '    var achada = encontradas[arquivo];',
    '    if (achada === esperado.marca) return;',
    '    if (!achada && esperado.opcional) return;',
    "    problemas.push(arquivo + (achada ? '' : ' (não foi colado, ou é de antes da marca de versão)'));",
    '  });',
    '  return { entrega: ENTREGA_GPEL, problemas: problemas };',
    '}',
    '',
    '/** Recusa trabalhar com arquivos de entregas diferentes. */',
    'function conferirVersoes_() {',
    '  var estado = estadoDasVersoes_();',
    '  if (!estado.problemas.length) return;',
    '  throw new Error(',
    "    'Os arquivos do Apps Script são de entregas diferentes. Cole a versão atual de: ' +",
    "    estado.problemas.join(', ') + '. Esta entrega é de ' + estado.entrega + ' — se foi o Versoes.gs que ficou para trás, cole ele também.'",
    '  );',
    '}',
    ''
  ].join('\n');

  return { esperados, versoes, marcas };
}

/** Grava as marcas e o Versoes.gs. Só troca a data da entrega se algo mudou. */
function atualizar() {
  const caminhoVersoes = path.join(PASTA, GERADO);
  const anterior = fs.existsSync(caminhoVersoes) ? fs.readFileSync(caminhoVersoes, 'utf8') : '';
  const dataAnterior = (anterior.match(/var ENTREGA_GPEL = '([^']*)'/) || [])[1];

  // Primeiro sem trocar a data: se o resultado for igual ao que já existe, nada mudou.
  let resultado = calcular(dataAnterior || '');
  const mudouAlgo = resultado.versoes !== anterior ||
    Object.keys(resultado.esperados).some((a) => fs.readFileSync(path.join(PASTA, a), 'utf8') !== resultado.esperados[a]);

  if (mudouAlgo) {
    const agora = new Date();
    const data = String(agora.getDate()).padStart(2, '0') + '/' + String(agora.getMonth() + 1).padStart(2, '0') + '/' + agora.getFullYear();
    resultado = calcular(data);
  }

  const alterados = [];
  Object.keys(resultado.esperados).forEach((arquivo) => {
    const caminho = path.join(PASTA, arquivo);
    if (fs.readFileSync(caminho, 'utf8') !== resultado.esperados[arquivo]) {
      fs.writeFileSync(caminho, resultado.esperados[arquivo]);
      alterados.push(arquivo);
    }
  });
  if (resultado.versoes !== anterior) {
    fs.writeFileSync(caminhoVersoes, resultado.versoes);
    alterados.push(GERADO);
  }
  return alterados;
}

/** Lista o que está fora de dia, sem gravar nada. */
function conferir() {
  const caminhoVersoes = path.join(PASTA, GERADO);
  const anterior = fs.existsSync(caminhoVersoes) ? fs.readFileSync(caminhoVersoes, 'utf8') : '';
  const dataAnterior = (anterior.match(/var ENTREGA_GPEL = '([^']*)'/) || [])[1] || '';
  const resultado = calcular(dataAnterior);
  const atrasados = Object.keys(resultado.esperados)
    .filter((a) => fs.readFileSync(path.join(PASTA, a), 'utf8') !== resultado.esperados[a]);
  if (resultado.versoes !== anterior) atrasados.push(GERADO);
  return atrasados;
}

module.exports = { atualizar, conferir, nomeDaMarca, marcaDe };
