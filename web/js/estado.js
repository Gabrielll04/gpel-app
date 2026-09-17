/* GPEL - estado do aplicativo.
   Guarda em memória o que veio do servidor, para as telas não precisarem
   buscar tudo de novo a cada troca de aba. */

window.GPEL = window.GPEL || {};

GPEL.estado = (function () {
  var dados = {};
  var meta = null;
  var carregadoEm = null;
  var CHAVE_CACHE = 'gpel.cache';

  function aplicar(resposta, quando) {
    meta = resposta.meta;
    dados = resposta;
    carregadoEm = quando || new Date();
    return dados;
  }

  /* A última carga fica guardada no próprio aparelho. Assim o aplicativo abre
     mostrando os dados de antes (instantâneo) enquanto busca os novos por trás.
     O cache é descartado se o endereço do servidor mudar. */
  function lerCache() {
    try {
      var bruto = window.localStorage.getItem(CHAVE_CACHE);
      if (!bruto) return null;
      var guardado = JSON.parse(bruto);
      if (!guardado || guardado.url !== GPEL.api.url() || !guardado.dados || !guardado.dados.meta) return null;
      return guardado;
    } catch (e) {
      return null;
    }
  }

  function gravarCache(resposta) {
    try {
      window.localStorage.setItem(CHAVE_CACHE, JSON.stringify({
        url: GPEL.api.url(),
        quando: new Date().toISOString(),
        dados: resposta
      }));
    } catch (e) {
      /* sem espaço ou sem armazenamento: o aplicativo funciona igual, só sem o atalho */
    }
  }

  /** silencioso = busca por trás, sem a tela de "carregando". */
  function carregar(forcar, silencioso) {
    if (!forcar && meta) return Promise.resolve(dados);
    if (!silencioso) GPEL.ui.carregando(true);
    return GPEL.api.carregarTudo()
      .then(function (resposta) {
        gravarCache(resposta);
        return aplicar(resposta);
      })
      .finally(function () { if (!silencioso) GPEL.ui.carregando(false); });
  }

  /**
   * Abertura do aplicativo: devolve se havia dados guardados (já aplicados)
   * e a promessa da busca ao servidor.
   */
  function iniciar() {
    var guardado = lerCache();
    if (guardado) aplicar(guardado.dados, new Date(guardado.quando));
    return { temCache: !!guardado, promessa: carregar(true, !!guardado) };
  }

  /** Recarrega tudo e redesenha a tela atual. */
  function atualizar() {
    return carregar(true).then(function (d) {
      if (GPEL.rotas) GPEL.rotas.redesenhar();
      return d;
    });
  }

  function tabela(nome) {
    return dados[nome] || [];
  }

  function definicao(nomeTabela) {
    return meta && meta.tabelas ? meta.tabelas[nomeTabela] : null;
  }

  function enumDe(nome) {
    return (meta && meta.enums && meta.enums[nome]) || [];
  }

  /** Nome legível de um registro de cadastro a partir do código. */
  function rotuloDe(nomeTabela, codigo) {
    if (!codigo) return '—';
    var def = definicao(nomeTabela);
    if (!def) return String(codigo);
    var achado = tabela(nomeTabela).filter(function (r) { return String(r[def.chave]).trim() === String(codigo).trim(); })[0];
    return achado ? String(achado[def.rotulo] || achado[def.chave]) : String(codigo);
  }

  /** Opções de um cadastro para usar em campos de seleção. */
  function opcoesDe(nomeTabela, filtro) {
    var def = definicao(nomeTabela);
    if (!def) return [];
    var registros = tabela(nomeTabela);
    if (filtro && filtro.coluna) {
      registros = registros.filter(function (r) { return String(r[filtro.coluna]).trim() === filtro.valor; });
    }
    return registros.map(function (r) {
      return { valor: String(r[def.chave]), rotulo: String(r[def.rotulo] || r[def.chave]), registro: r };
    }).sort(function (a, b) { return a.rotulo.localeCompare(b.rotulo, 'pt-BR'); });
  }

  /** Cadastro correspondente à classe (Produto/Insumo). */
  function cadastroDaClasse(classe) {
    return classe === 'Insumo' ? 'CAD_INSUMOS' : 'CAD_PRODUTOS';
  }

  function itemDaClasse(classe, codigo) {
    var nomeTabela = cadastroDaClasse(classe);
    var def = definicao(nomeTabela);
    if (!def) return null;
    return tabela(nomeTabela).filter(function (r) { return String(r[def.chave]).trim() === String(codigo).trim(); })[0] || null;
  }

  function saldoDe(codigo) {
    var linha = tabela('ESTOQUE_ATUAL').filter(function (r) { return String(r['Código']).trim() === String(codigo).trim(); })[0];
    return linha ? Number(linha['Saldo Atual']) || 0 : 0;
  }

  return {
    carregar: carregar,
    iniciar: iniciar,
    atualizar: atualizar,
    tabela: tabela,
    definicao: definicao,
    enumDe: enumDe,
    rotuloDe: rotuloDe,
    opcoesDe: opcoesDe,
    cadastroDaClasse: cadastroDaClasse,
    itemDaClasse: itemDaClasse,
    saldoDe: saldoDe,
    get meta() { return meta; },
    get carregadoEm() { return carregadoEm; },
    get dados() { return dados; }
  };
})();
