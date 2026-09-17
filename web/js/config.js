/* GPEL - configuração do aplicativo web.
   Tudo o que muda de ambiente fica aqui. */

window.GPEL = window.GPEL || {};

GPEL.config = {
  /* URL do Web App publicado no Apps Script.
     Deixe vazio para que a própria usuária cole a URL na tela Configurações,
     ou preencha aqui para já sair configurado para todo mundo.
     Exemplo: 'https://script.google.com/macros/s/AKfycb.../exec' */
  URL_API_PADRAO: 'https://script.google.com/macros/s/AKfycbxtFqYC411ff8330tPgdM-dTko-sm47mVDJJa75-soR9enyeVfWDr4hLzP_4B6MqYIR_A/exec',

  /* Senha simples, só se você tiver preenchido TOKEN_ACESSO no Apps Script. */
  TOKEN_PADRAO: '',

  /* Chaves usadas para guardar preferências no próprio aparelho. */
  CHAVE_URL: 'gpel.urlApi',
  CHAVE_TOKEN: 'gpel.token',
  CHAVE_USUARIO: 'gpel.usuario'
};

/* Leitura/escrita das preferências locais, com proteção para navegadores
   que bloqueiam o armazenamento (aba anônima, por exemplo). */
GPEL.preferencias = {
  ler: function (chave, padrao) {
    try {
      var valor = window.localStorage.getItem(chave);
      return valor === null ? padrao : valor;
    } catch (e) {
      return padrao;
    }
  },
  gravar: function (chave, valor) {
    try {
      window.localStorage.setItem(chave, valor);
    } catch (e) {
      /* sem armazenamento: segue sem guardar */
    }
  }
};
