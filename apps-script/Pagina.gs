/**
 * GPEL - Entrega da interface pelo próprio Apps Script.
 *
 * Este arquivo NÃO pode se chamar "Interface": esse nome já é do arquivo HTML
 * com a página, e o Apps Script não aceita dois arquivos com o mesmo nome,
 * mesmo sendo de tipos diferentes.
 *
 * Servindo o aplicativo daqui (e não de um site externo), o Google exige login
 * antes de mostrar qualquer coisa. É isso que permite restringir o acesso a
 * contas específicas — um site externo só consegue falar com o Web App se ele
 * estiver aberto para qualquer pessoa, sem login.
 *
 * A página vem de um dos dois lugares (veja URL_INTERFACE em Config.gs):
 *   - do GitHub, baixada na hora e guardada por alguns minutos; ou
 *   - do arquivo HTML "Interface" colado neste projeto.
 *
 * Nos dois casos o arquivo é GERADO a partir da pasta web/ pelo comando
 *   node ferramentas/empacotar.js
 * Não edite Interface.html na mão: edite os arquivos de web/ e gere de novo.
 */

/** Página do aplicativo (ou o aviso de acesso negado). */
function servirInterface_(parametros) {
  if (!usuarioAutorizado()) return paginaSemAcesso_();

  var html = paginaDoAplicativo_(parametros && parametros.recarregar);
  if (!html) return paginaSemInterface_();

  return HtmlService.createHtmlOutput(html)
    .setTitle('GPEL')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Busca a página: cache -> GitHub -> arquivo colado no projeto. */
function paginaDoAplicativo_(recarregar) {
  if (URL_INTERFACE) {
    if (!recarregar) {
      var guardada = paginaNoCache_();
      if (guardada) return guardada;
    }
    try {
      var resposta = UrlFetchApp.fetch(URL_INTERFACE, { muteHttpExceptions: true, followRedirects: true });
      if (resposta.getResponseCode() === 200) {
        var baixada = resposta.getContentText();
        guardarPaginaNoCache_(baixada);
        return baixada;
      }
    } catch (e) {
      // Sem internet ou endereço fora do ar: tenta o arquivo do projeto.
    }
  }
  try {
    return HtmlService.createHtmlOutputFromFile('Interface').getContent();
  } catch (e) {
    return '';
  }
}

/* A página passa de 100 KB, que é o limite de cada chave do cache.
   Por isso ela é guardada em pedaços. */
var TAMANHO_DO_PEDACO = 90000;

function paginaNoCache_() {
  try {
    var cache = CacheService.getScriptCache();
    var quantos = Number(cache.get('interface_pedacos') || 0);
    if (!quantos) return '';
    var partes = [];
    for (var i = 0; i < quantos; i++) {
      var pedaco = cache.get('interface_' + i);
      if (pedaco === null) return ''; // pedaço venceu: baixa de novo
      partes.push(pedaco);
    }
    return partes.join('');
  } catch (e) {
    return '';
  }
}

function guardarPaginaNoCache_(html) {
  try {
    var cache = CacheService.getScriptCache();
    var segundos = Math.max(60, MINUTOS_DE_CACHE_DA_PAGINA * 60);
    var quantos = Math.ceil(html.length / TAMANHO_DO_PEDACO);
    var valores = { interface_pedacos: String(quantos) };
    for (var i = 0; i < quantos; i++) {
      valores['interface_' + i] = html.substr(i * TAMANHO_DO_PEDACO, TAMANHO_DO_PEDACO);
    }
    cache.putAll(valores, segundos);
  } catch (e) {
    // Sem cache o aplicativo funciona igual, só baixa a página toda vez.
  }
}

/** Quando não há página nem no GitHub nem no projeto. */
function paginaSemInterface_() {
  var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F3F5F7;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#1D2733;padding:24px}' +
    '.caixa{background:#fff;border:1px solid #E2E7EC;border-radius:14px;padding:28px 24px;max-width:460px;' +
    'box-shadow:0 6px 18px rgba(22,33,43,.06)}h1{font-size:19px;margin:0 0 10px}' +
    'p{margin:0 0 8px;color:#63707E;font-size:14.5px;line-height:1.5}' +
    'code{background:#F3F5F7;padding:2px 6px;border-radius:5px;font-size:13px;color:#1D2733}</style>' +
    '</head><body><div class="caixa"><h1>Falta a página do aplicativo</h1>' +
    '<p>O servidor está no ar, mas não encontrou a interface.</p>' +
    '<p>Confira <code>URL_INTERFACE</code> em <code>Config.gs</code>: ou ela aponta para o arquivo ' +
    '<code>Interface.html</code> publicado no GitHub, ou deve ficar vazia e existir um arquivo HTML ' +
    'chamado <code>Interface</code> neste projeto.</p></div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('GPEL');
}

/** Aviso claro para quem entrou com uma conta que não está na lista. */
function paginaSemAcesso_() {
  var email = emailDoUsuario();
  var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>' +
    'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F3F5F7;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#1D2733;padding:24px}' +
    '.caixa{background:#fff;border:1px solid #E2E7EC;border-radius:14px;padding:28px 24px;max-width:420px;text-align:center;' +
    'box-shadow:0 6px 18px rgba(22,33,43,.06)}' +
    'h1{font-size:19px;margin:0 0 10px}p{margin:0 0 8px;color:#63707E;font-size:14.5px;line-height:1.5}' +
    'code{background:#F3F5F7;padding:2px 6px;border-radius:5px;font-size:13px;color:#1D2733}' +
    '</style></head><body><div class="caixa">' +
    '<h1>Acesso restrito</h1>' +
    (email
      ? '<p>A conta <code>' + email.replace(/[<>&]/g, '') + '</code> não tem permissão para usar o aplicativo da GPEL.</p>' +
        '<p>Se você deveria ter acesso, peça ao responsável para incluir esse e-mail. Se usa mais de uma conta Google, saia e entre com a conta certa.</p>'
      : '<p>Não foi possível identificar sua conta Google.</p><p>Feche esta página e abra o aplicativo de novo, fazendo login.</p>') +
    '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('GPEL - acesso restrito');
}

/* ------------------------------------------------------------------ */
/* Ponte usada pela página servida daqui (google.script.run)           */
/*                                                                     */
/* Dentro do Apps Script a página não pode chamar a própria URL com     */
/* fetch (o navegador trata como outro domínio). A ponte oficial é      */
/* google.script.run, que chama estas duas funções.                    */
/* ------------------------------------------------------------------ */

/** Leituras. Recebe os mesmos parâmetros do modo hospedado fora. */
function apiGet(parametros) {
  return doGet({ parameter: parametros || {} }).getContent();
}

/** Gravações. Recebe o mesmo corpo JSON do modo hospedado fora. */
function apiPost(corpo) {
  return doPost({ postData: { contents: JSON.stringify(corpo || {}) } }).getContent();
}
