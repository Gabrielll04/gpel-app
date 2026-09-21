/**
 * GPEL - Controle de acesso.
 *
 * Duas travas independentes, e as duas passam por aqui:
 *
 * 1. CONTA GOOGLE (principal). Publicando o Web App com
 *    "Executar como: Usuário que acessa o app", o Google exige login antes de
 *    qualquer coisa e o script sabe quem está do outro lado. Só os e-mails de
 *    USUARIOS_AUTORIZADOS (Config.gs) passam.
 *
 * 2. SENHA (TOKEN_ACESSO). Serve para quando o aplicativo está hospedado fora
 *    do Google, onde não há login possível. Opcional.
 */

/** Lista de e-mails autorizados, tolerante a um Config.gs mais antigo. */
function listaDeAutorizados_() {
  try {
    return typeof USUARIOS_AUTORIZADOS !== 'undefined' && USUARIOS_AUTORIZADOS ? USUARIOS_AUTORIZADOS : [];
  } catch (e) {
    return [];
  }
}

/** E-mail de quem está usando o aplicativo agora ('' se o Google não informar). */
function emailDoUsuario() {
  try {
    var efetivo = Session.getEffectiveUser();
    var email = efetivo ? efetivo.getEmail() : '';
    if (email) return String(email).trim().toLowerCase();
  } catch (e) { /* segue para a próxima tentativa */ }

  try {
    var ativo = Session.getActiveUser();
    return ativo && ativo.getEmail() ? String(ativo.getEmail()).trim().toLowerCase() : '';
  } catch (e) {
    return '';
  }
}

/** Nome legível de quem está usando (parte do e-mail antes do @). */
function nomeDoUsuario() {
  var email = emailDoUsuario();
  if (!email) return '';
  return email.split('@')[0];
}

/** A conta atual está na lista de autorizados? */
function usuarioAutorizado() {
  var autorizados = listaDeAutorizados_();
  if (!autorizados.length) return true; // lista vazia: a trava é a publicação
  var email = emailDoUsuario();
  if (!email) return false;
  for (var i = 0; i < autorizados.length; i++) {
    if (String(autorizados[i]).trim().toLowerCase() === email) return true;
  }
  return false;
}

/**
 * Trava as duas portas. Lança Error com mensagem clara quando o acesso é negado.
 * Chamada no começo de toda leitura e de toda gravação.
 */
function conferirAcesso_(token) {
  if (!usuarioAutorizado()) {
    var email = emailDoUsuario();
    throw new Error(email
      ? 'A conta ' + email + ' não tem acesso ao aplicativo da GPEL. Peça para o responsável incluir esse e-mail.'
      : 'Não foi possível identificar sua conta Google. Entre pelo endereço do aplicativo e faça login.');
  }
  if (TOKEN_ACESSO && textoLimpo_(token) !== TOKEN_ACESSO) {
    throw new Error('Senha de acesso incorreta. Confira em Configurações.');
  }
}

/** Dados de quem está usando, para o aplicativo mostrar na tela. */
function dadosDoUsuario_() {
  return {
    email: emailDoUsuario(),
    nome: nomeDoUsuario(),
    autorizado: usuarioAutorizado(),
    listaAtiva: listaDeAutorizados_().length > 0
  };
}
