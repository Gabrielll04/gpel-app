/* GPEL - simulador mínimo do Google Apps Script.
   Serve para rodar as regras do backend no computador, sem precisar abrir a
   planilha. Não é usado em produção: existe só para os testes. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function criarPlanilhaFalsa() {
  const abas = {};

  function criarAba(nome) {
    const dados = []; // matriz de linhas

    function garantir(linha, coluna) {
      while (dados.length < linha) dados.push([]);
      for (const l of dados) while (l.length < coluna) l.push('');
    }

    const aba = {
      nome,
      getName: () => nome,
      getLastRow: () => {
        let ultima = 0;
        dados.forEach((linha, i) => {
          if (linha.some((c) => c !== '' && c !== null && c !== undefined)) ultima = i + 1;
        });
        return ultima;
      },
      getLastColumn: () => dados.reduce((maior, linha) => {
        let ultima = 0;
        linha.forEach((celula, i) => { if (celula !== '' && celula !== null && celula !== undefined) ultima = i + 1; });
        return Math.max(maior, ultima);
      }, 0),
      setFrozenRows: () => aba,
      getFrozenRows: () => 1,
      deleteRow: (linha) => { dados.splice(linha - 1, 1); },
      getRange: (linha, coluna, alturaOpcional, larguraOpcional) => {
        const altura = alturaOpcional || 1;
        const largura = larguraOpcional || 1;
        garantir(linha + altura - 1, coluna + largura - 1);
        const intervalo = {
          getValues: () => {
            const saida = [];
            for (let i = 0; i < altura; i++) {
              const origem = dados[linha - 1 + i] || [];
              const destino = [];
              for (let j = 0; j < largura; j++) {
                const valor = origem[coluna - 1 + j];
                destino.push(valor === undefined ? '' : valor);
              }
              saida.push(destino);
            }
            return saida;
          },
          setValues: (matriz) => {
            matriz.forEach((linhaValores, i) => {
              linhaValores.forEach((valor, j) => {
                garantir(linha + i, coluna + j);
                dados[linha - 1 + i][coluna - 1 + j] = valor;
              });
            });
            return intervalo;
          },
          setValue: (valor) => {
            garantir(linha, coluna);
            dados[linha - 1][coluna - 1] = valor;
            return intervalo;
          },
          clearContent: () => {
            for (let i = 0; i < altura; i++) {
              for (let j = 0; j < largura; j++) {
                if (dados[linha - 1 + i]) dados[linha - 1 + i][coluna - 1 + j] = '';
              }
            }
            return intervalo;
          },
          setFontWeight: () => intervalo,
          setNumberFormat: () => intervalo
        };
        return intervalo;
      },
      _dados: dados
    };
    return aba;
  }

  return {
    getSheetByName: (nome) => abas[nome] || null,
    insertSheet: (nome) => { abas[nome] = criarAba(nome); return abas[nome]; },
    _abas: abas
  };
}

function formatarData(data, fuso, formato) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return formato.replace('yyyy', ano).replace('MM', mes).replace('dd', dia);
}

/** Carrega os arquivos .gs em um contexto isolado e devolve as funções. */
function carregarBackend() {
  const planilha = criarPlanilhaFalsa();

  const contexto = {
    console,
    SpreadsheetApp: {
      openById: () => planilha,
      getActiveSpreadsheet: () => planilha
    },
    Utilities: { formatDate: formatarData },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (texto) => ({ setMimeType: () => ({ getContent: () => texto }), getContent: () => texto })
    },
    Date,
    Math,
    JSON,
    Number,
    String,
    Object,
    Array,
    isNaN,
    Error
  };
  contexto.globalThis = contexto;
  vm.createContext(contexto);

  const pasta = path.join(__dirname, '..', 'apps-script');
  ['Config.gs', 'Planilha.gs', 'Regras.gs', 'Estoque.gs', 'Automacoes.gs', 'Codigo.gs'].forEach((arquivo) => {
    vm.runInContext(fs.readFileSync(path.join(pasta, arquivo), 'utf8'), contexto, { filename: arquivo });
  });

  return { contexto, planilha };
}

module.exports = { carregarBackend };
