/**
 * GPEL - gera apps-script/Interface.html a partir da pasta web/.
 *
 * Rodar:  node ferramentas/empacotar.js
 *
 * Por que isso existe: o Apps Script serve UMA página, e não uma pasta de
 * arquivos. O empacotador junta o HTML, o CSS, os scripts e as imagens num
 * arquivo só. O código continua morando em web/ — é lá que se edita.
 *
 * Interface.html é um arquivo GERADO. Não edite na mão.
 */

const fs = require('fs');
const path = require('path');
const versoes = require('./versoes');

const RAIZ = path.join(__dirname, '..');
const WEB = path.join(RAIZ, 'web');
const SAIDA = path.join(RAIZ, 'apps-script', 'Interface.html');

function ler(relativo) {
  return fs.readFileSync(path.join(WEB, relativo), 'utf8');
}

function comoDataUri(relativo) {
  const dados = fs.readFileSync(path.join(WEB, relativo));
  const tipo = relativo.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return 'data:' + tipo + ';base64,' + dados.toString('base64');
}

let html = ler('index.html');

// 1. CSS para dentro da página
html = html.replace(/[ \t]*<link rel="stylesheet" href="css\/app\.css">\n?/,
  '  <style>\n' + ler('css/app.css') + '\n  </style>\n');

// 2. Scripts para dentro da página, na mesma ordem em que apareciam
const scripts = [...html.matchAll(/[ \t]*<script src="([^"]+)"><\/script>\n?/g)];
if (!scripts.length) throw new Error('Nenhum <script src> encontrado em index.html.');
const juntos = scripts.map(([, arquivo]) =>
  '/* ===== ' + arquivo + ' ===== */\n' + ler(arquivo)).join('\n');
html = html.replace(scripts[0][0], '  <script>\n' + juntos + '\n  </script>\n');
scripts.slice(1).forEach(([trecho]) => { html = html.replace(trecho, ''); });

// 3. Ícones e manifest: não valem dentro do Apps Script (a página abre em um
//    quadro dentro do site do Google), então saem do arquivo gerado.
html = html
  .replace(/[ \t]*<link rel="icon"[^>]*>\n?/g, '')
  .replace(/[ \t]*<link rel="apple-touch-icon"[^>]*>\n?/g, '')
  .replace(/[ \t]*<link rel="manifest"[^>]*>\n?/g, '');

// 4. Imagens viram data: URI (a página é uma só, não há pasta img/)
['img/gpel-marca.png', 'img/gpel-logo.png'].forEach((arquivo) => {
  html = html.split(arquivo).join(comoDataUri(arquivo));
});

const sobrou = html.match(/(src|href)="(?!data:|https?:|#)[^"]+"/g);
if (sobrou) throw new Error('Ficou arquivo externo no pacote: ' + sobrou.join(', '));

const aviso = '<!--\n  ARQUIVO GERADO por ferramentas/empacotar.js — não edite aqui.\n' +
  '  Edite os arquivos da pasta web/ e rode: node ferramentas/empacotar.js\n-->\n';

const pacote = aviso + html;

// --conferir: só avisa se o arquivo publicado está atrasado em relação a web/.
// Serve para não publicar uma versão antiga sem perceber.
if (process.argv.includes('--conferir')) {
  const atual = fs.existsSync(SAIDA) ? fs.readFileSync(SAIDA, 'utf8') : '';
  let falhou = false;
  if (atual !== pacote) {
    console.error('Interface.html está desatualizado. Rode: node ferramentas/empacotar.js');
    falhou = true;
  }
  const semMarca = versoes.conferir();
  if (semMarca.length) {
    console.error('Marca de versão desatualizada em: ' + semMarca.join(', ') + '. Rode: node ferramentas/empacotar.js');
    falhou = true;
  }
  if (falhou) process.exit(1);
  console.log('Interface.html e marcas de versão em dia.');
  process.exit(0);
}

fs.writeFileSync(SAIDA, pacote);
console.log('Interface.html gerado: ' + Math.round(Buffer.byteLength(pacote) / 1024) + ' KB');

const alterados = versoes.atualizar();
console.log(alterados.length
  ? 'Marcas de versão atualizadas. Arquivos para colar no Apps Script: ' + alterados.join(', ')
  : 'Marcas de versão em dia: nenhum .gs mudou.');
