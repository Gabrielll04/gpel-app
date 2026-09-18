/**
 * GPEL - Entrega da interface pelo próprio Apps Script.
 *
 * Servindo o aplicativo daqui (e não de um site externo), o Google exige login
 * antes de mostrar qualquer coisa. É isso que permite restringir o acesso a
 * contas específicas — um site externo só consegue falar com o Web App se ele
 * estiver aberto para qualquer pessoa, sem login.
 *
 * O arquivo Interface.html é GERADO a partir da pasta web/ pelo comando
 *   node ferramentas/empacotar.js
 * Não edite Interface.html na mão: edite os arquivos de web/ e gere de novo.
 */

/** Página do aplicativo (ou o aviso de acesso negado). */
function servirInterface_() {
  if (!usuarioAutorizado()) return paginaSemAcesso_();

  return HtmlService.createHtmlOutputFromFile('Interface')
    .setTitle('GPEL')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
