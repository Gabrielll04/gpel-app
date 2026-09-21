/**
 * GPEL - Configuração central do backend (Google Apps Script).
 *
 * Este arquivo é a ÚNICA fonte de verdade sobre:
 *   - qual planilha é usada;
 *   - quais abas (tabelas) existem;
 *   - quais colunas cada aba tem e de que tipo é cada coluna;
 *   - quais são as listas fixas (enums) do sistema.
 *
 * O aplicativo web lê essa configuração pelo endpoint ?action=meta,
 * portanto NÃO é preciso repetir nomes de colunas no frontend.
 *
 * >>> PREENCHA ID_PLANILHA ANTES DE USAR <<<
 * Se o script for criado a partir da própria planilha (Extensões > Apps Script),
 * pode deixar vazio: o script usa a planilha ativa.
 */

var ID_PLANILHA = ''; // ex.: '1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890'

/**
 * QUEM PODE USAR O APLICATIVO.
 *
 * Escreva aqui os e-mails (contas Google) autorizados, em minúsculas.
 * Quem abrir o aplicativo com outra conta recebe uma mensagem de acesso negado.
 *
 * Para acrescentar ou tirar alguém, mexa só nesta lista e publique uma nova
 * versão do Web App. Não é preciso mudar mais nada no código.
 *
 * Lista vazia = qualquer pessoa que consiga abrir o Web App entra. Só deixe
 * vazia se a publicação estiver como "Somente eu".
 */
var USUARIOS_AUTORIZADOS = [
  // 'empresaria@gmail.com',
  // 'gabrielggcarneiro04@gmail.com'
];

/**
 * Senha simples de acesso (opcional).
 * Segunda camada, útil quando o aplicativo está hospedado fora (GitHub Pages,
 * Cloudflare), onde o Google não consegue exigir login.
 * Deixe vazio para não pedir senha.
 */
var TOKEN_ACESSO = '';

/**
 * DE ONDE VEM A PÁGINA DO APLICATIVO.
 *
 * Preenchido: o Apps Script baixa a página do repositório no GitHub. É o modo
 * cômodo — publicar uma mudança de tela vira só um push, sem colar nada aqui.
 * Vazio: usa o arquivo HTML chamado "Interface" colado neste projeto.
 *
 * O repositório precisa ser público para o endereço abaixo funcionar. A página
 * é só a interface (não tem dado nenhum), e quem manda no repositório manda no
 * que aparece na tela — se isso incomodar, deixe vazio e cole o Interface.html.
 */
var URL_INTERFACE = '';

/** Por quantos minutos a página baixada fica guardada (evita baixar a cada abertura). */
var MINUTOS_DE_CACHE_DA_PAGINA = 10;

/** Fuso usado para gravar datas como texto (aaaa-mm-dd). */
var FUSO = 'America/Sao_Paulo';

/** Listas fixas do sistema (substituem texto livre). */
var ENUMS = {
  TIPO_PRODUTO:     ['Fabricação', 'Revenda'],
  STATUS_PEDIDO:    ['Recebido', 'Aguardando programação', 'Programado', 'Em produção', 'Pronto', 'Separado', 'Entregue', 'Cancelado'],
  ORIGEM_COMERCIAL: ['WhatsApp', 'Telefone', 'E-mail', 'Presencial', 'Licitação', 'Outro'],
  STATUS_PRODUCAO:  ['Planejada', 'Em produção', 'Concluída', 'Parada', 'Cancelada'],
  CLASSE:           ['Produto', 'Insumo'],
  ENTRADA_SAIDA:    ['Entrada', 'Saída'],
  ORIGEM_MOVIMENTO: ['Compra', 'Produção', 'Venda/Expedição', 'Consumo Produção', 'Perda', 'Inventário +', 'Inventário -', 'Devolução'],
  TIPO_COMPRA:      ['Matéria-prima', 'Embalagem', 'Revenda', 'Outro'],
  SIM_NAO:          ['Sim', 'Não']
};

/**
 * Definição das tabelas (abas da planilha).
 *
 * campos[].tipo:
 *   texto | textoLongo | numero | decimal | dinheiro | data | lista | ref | calculado
 * campos[].oculto  -> coluna técnica: existe na planilha, nunca aparece para a usuária.
 * campos[].auto    -> preenchida pelo sistema (busca em cadastro) e não digitada.
 * campos[].lista   -> nome da lista em ENUMS.
 * campos[].ref     -> { tabela, chave, rotulo } para campos de referência a cadastro.
 */
var TABELAS = {
  CAD_PRODUTOS: {
    rotuloSingular: 'Produto',
    rotuloPlural: 'Produtos',
    chave: 'Código',
    rotulo: 'Produto',
    prefixoId: 'PRD',
    permiteExcluir: true,
    campos: [
      { nome: 'Código',   tipo: 'texto', obrigatorio: true },
      { nome: 'Produto',  tipo: 'texto', obrigatorio: true },
      { nome: 'Tipo',     tipo: 'lista', lista: 'TIPO_PRODUTO', obrigatorio: true },
      { nome: 'Unidade',  tipo: 'texto', obrigatorio: true },
      { nome: 'Estoque Mín.', tipo: 'decimal' }
    ]
  },

  CAD_INSUMOS: {
    rotuloSingular: 'Insumo',
    rotuloPlural: 'Insumos',
    chave: 'Código',
    rotulo: 'Item',
    prefixoId: 'INS',
    permiteExcluir: true,
    campos: [
      { nome: 'Código',  tipo: 'texto', obrigatorio: true },
      { nome: 'Item',    tipo: 'texto', obrigatorio: true },
      { nome: 'Unidade', tipo: 'texto', obrigatorio: true },
      { nome: 'Estoque Mín.', tipo: 'decimal' }
    ]
  },

  CAD_CLIENTES: {
    rotuloSingular: 'Cliente',
    rotuloPlural: 'Clientes',
    chave: 'Código',
    rotulo: 'Razão Social',
    prefixoId: 'CLI',
    permiteExcluir: true,
    campos: [
      { nome: 'Código',       tipo: 'texto', obrigatorio: true },
      { nome: 'Razão Social', tipo: 'texto', obrigatorio: true }
    ]
  },

  CAD_FORNECEDORES: {
    rotuloSingular: 'Fornecedor',
    rotuloPlural: 'Fornecedores',
    chave: 'Código',
    rotulo: 'Razão Social',
    prefixoId: 'FOR',
    permiteExcluir: true,
    campos: [
      { nome: 'Código',       tipo: 'texto', obrigatorio: true },
      { nome: 'Razão Social', tipo: 'texto', obrigatorio: true }
    ]
  },

  PEDIDOS: {
    rotuloSingular: 'Pedido',
    rotuloPlural: 'Pedidos',
    chave: 'ID Pedido',
    prefixoId: 'PED',
    idAutomatico: true,
    campos: [
      { nome: 'ID Pedido',   tipo: 'texto', oculto: true },
      { nome: 'Data',        tipo: 'data', obrigatorio: true, padrao: 'hoje' },
      { nome: 'Cliente',     tipo: 'ref', obrigatorio: true, ref: { tabela: 'CAD_CLIENTES', chave: 'Código', rotulo: 'Razão Social' } },
      { nome: 'Produto',     tipo: 'ref', obrigatorio: true, ref: { tabela: 'CAD_PRODUTOS', chave: 'Código', rotulo: 'Produto' } },
      { nome: 'Quantidade',  tipo: 'decimal', obrigatorio: true },
      { nome: 'Valor Unit.', tipo: 'dinheiro', obrigatorio: true },
      { nome: 'Valor Total', tipo: 'calculado', formato: 'dinheiro' },
      { nome: 'Unidade',     tipo: 'texto', auto: true },
      { nome: 'Prazo / Data Entrega', tipo: 'data' },
      { nome: 'Status',      tipo: 'lista', lista: 'STATUS_PEDIDO', obrigatorio: true, padrao: 'Recebido' },
      { nome: 'Origem comercial', tipo: 'lista', lista: 'ORIGEM_COMERCIAL' }
    ]
  },

  PRODUCAO: {
    rotuloSingular: 'Produção',
    rotuloPlural: 'Produções',
    chave: 'ID Produção',
    prefixoId: 'PRO',
    idAutomatico: true,
    campos: [
      { nome: 'ID Produção', tipo: 'texto', oculto: true },
      { nome: 'Data',        tipo: 'data', obrigatorio: true, padrao: 'hoje' },
      { nome: 'Produto',     tipo: 'ref', obrigatorio: true, ref: { tabela: 'CAD_PRODUTOS', chave: 'Código', rotulo: 'Produto', filtro: { coluna: 'Tipo', valor: 'Fabricação' } } },
      { nome: 'Meta',        tipo: 'decimal' },
      { nome: 'Produzido',   tipo: 'decimal' },
      { nome: 'Perdas (kg)', tipo: 'decimal', padrao: 0 },
      { nome: 'Horas',       tipo: 'decimal' },
      { nome: 'Pessoas',     tipo: 'numero' },
      { nome: 'Prod./h',     tipo: 'calculado' },
      { nome: 'Prod./HH',    tipo: 'calculado' },
      { nome: 'Unidade',     tipo: 'texto', auto: true },
      { nome: 'MP consumida (kg)', tipo: 'decimal' },
      { nome: 'Rendimento (%)',    tipo: 'decimal' },
      { nome: 'Status',      tipo: 'lista', lista: 'STATUS_PRODUCAO', obrigatorio: true, padrao: 'Planejada' },
      { nome: 'Pedido Ref.', tipo: 'ref', ref: { tabela: 'PEDIDOS', chave: 'ID Pedido', rotulo: 'ID Pedido' } }
    ]
  },

  MOV_ESTOQUE: {
    rotuloSingular: 'Movimentação',
    rotuloPlural: 'Movimentações',
    chave: 'ID Movimento',
    prefixoId: 'MOV',
    idAutomatico: true,
    somenteInclusao: true, // nunca editar/excluir: correções entram como nova movimentação
    campos: [
      { nome: 'ID Movimento',  tipo: 'texto', oculto: true },
      { nome: 'Data',          tipo: 'data', obrigatorio: true, padrao: 'hoje' },
      { nome: 'Classe',        tipo: 'lista', lista: 'CLASSE', obrigatorio: true },
      { nome: 'Código Item',   tipo: 'ref', obrigatorio: true, dependeDe: 'Classe' },
      { nome: 'Item',          tipo: 'texto', auto: true },
      { nome: 'Entrada/Saída', tipo: 'lista', lista: 'ENTRADA_SAIDA', obrigatorio: true },
      { nome: 'Origem',        tipo: 'lista', lista: 'ORIGEM_MOVIMENTO', obrigatorio: true },
      { nome: 'Quantidade',    tipo: 'decimal', obrigatorio: true },
      { nome: 'Unidade',       tipo: 'texto', auto: true },
      { nome: 'Qtd. Assinada', tipo: 'calculado', oculto: true },
      { nome: 'Documento Ref.', tipo: 'texto' },
      { nome: 'Responsável',   tipo: 'texto' },
      { nome: 'Observações',   tipo: 'textoLongo' }
    ]
  },

  ESTOQUE_ATUAL: {
    rotuloSingular: 'Saldo',
    rotuloPlural: 'Estoque atual',
    chave: 'Código',
    calculada: true, // recalculada a partir de MOV_ESTOQUE; só "Estoque Mín." é digitado
    campos: [
      { nome: 'Classe',       tipo: 'lista', lista: 'CLASSE' },
      { nome: 'Código',       tipo: 'texto' },
      { nome: 'Item',         tipo: 'texto' },
      { nome: 'Unidade',      tipo: 'texto' },
      { nome: 'Entradas',     tipo: 'calculado' },
      { nome: 'Saídas',       tipo: 'calculado' },
      { nome: 'Saldo Atual',  tipo: 'calculado' },
      { nome: 'Estoque Mín.', tipo: 'decimal' },
      { nome: 'Status',       tipo: 'calculado' }
    ]
  },

  INVENTARIO: {
    rotuloSingular: 'Inventário',
    rotuloPlural: 'Inventários',
    chave: 'ID Inventário',
    prefixoId: 'INV',
    idAutomatico: true,
    campos: [
      { nome: 'ID Inventário',   tipo: 'texto', oculto: true },
      { nome: 'Data',            tipo: 'data', obrigatorio: true, padrao: 'hoje' },
      { nome: 'Classe',          tipo: 'lista', lista: 'CLASSE', obrigatorio: true },
      { nome: 'Código',          tipo: 'ref', obrigatorio: true, dependeDe: 'Classe' },
      { nome: 'Item',            tipo: 'texto', auto: true },
      { nome: 'Saldo Sistema',   tipo: 'calculado' },
      { nome: 'Contagem Física', tipo: 'decimal', obrigatorio: true },
      { nome: 'Diferença',       tipo: 'calculado' },
      { nome: 'Ajuste?',         tipo: 'calculado' },
      { nome: 'Responsável',     tipo: 'texto', obrigatorio: true },
      { nome: 'Observações',     tipo: 'textoLongo' }
    ]
  },

  COMPRAS: {
    rotuloSingular: 'Compra',
    rotuloPlural: 'Compras',
    chave: 'ID Compra',
    prefixoId: 'CMP',
    idAutomatico: true,
    campos: [
      { nome: 'ID Compra',   tipo: 'texto', oculto: true },
      { nome: 'Data',        tipo: 'data', obrigatorio: true, padrao: 'hoje' },
      { nome: 'NF',          tipo: 'texto' }, // texto para preservar zeros à esquerda
      { nome: 'Fornecedor',  tipo: 'ref', obrigatorio: true, ref: { tabela: 'CAD_FORNECEDORES', chave: 'Código', rotulo: 'Razão Social' } },
      { nome: 'Tipo Compra', tipo: 'lista', lista: 'TIPO_COMPRA', obrigatorio: true },
      { nome: 'Classe',      tipo: 'lista', lista: 'CLASSE', obrigatorio: true },
      { nome: 'Código Item', tipo: 'ref', obrigatorio: true, dependeDe: 'Classe' },
      { nome: 'Item',        tipo: 'texto', auto: true },
      { nome: 'Unidade',     tipo: 'texto', auto: true },
      { nome: 'Quantidade',  tipo: 'decimal', obrigatorio: true },
      { nome: 'Valor Unit.', tipo: 'dinheiro', obrigatorio: true },
      { nome: 'Valor Total', tipo: 'calculado', formato: 'dinheiro' },
      { nome: 'Observações', tipo: 'textoLongo' },
      { nome: 'Mov. Gerado', tipo: 'texto', oculto: true } // controle de idempotência da automação
    ]
  },

  VENDAS_HISTORICO: {
    rotuloSingular: 'Venda',
    rotuloPlural: 'Histórico de vendas',
    somenteLeitura: true,
    colunasLivres: true, // lê os cabeçalhos que já existirem na aba
    campos: []
  },

  PARAMETROS: {
    rotuloSingular: 'Parâmetro',
    rotuloPlural: 'Parâmetros',
    tecnica: true,       // nunca exposta na navegação do aplicativo
    colunasLivres: true,
    campos: []
  }
};

/**
 * NOMES EQUIVALENTES DE COLUNA.
 *
 * A planilha da GPEL já existia antes do aplicativo e tem nomes próprios.
 * Aqui se diz que "Unid. Estoque" é a mesma coisa que "Unidade", e assim por
 * diante, para não precisar renomear coluna nenhuma na planilha.
 *
 * Acentos, pontos, espaços e maiúsculas são ignorados na comparação: "Código",
 * "codigo" e "CÓDIGO" já são entendidos como a mesma coluna, sem entrar aqui.
 *
 * Quando duas colunas da planilha apontam para o mesmo nome (o caso de
 * "Unid. Estoque" e "Unid. Venda"), vale a primeira da lista.
 */
var SINONIMOS = {
  'Unidade':      ['Unid. Estoque', 'Unidade de Estoque', 'Unid', 'Un', 'Unid. Venda', 'Unidade de Venda'],
  'Item':         ['Insumo', 'Material', 'Descrição', 'Nome do Item'],
  'Produto':      ['Descrição do Produto', 'Nome do Produto'],
  'Razão Social': ['Razao Social', 'Nome', 'Empresa', 'Cliente', 'Fornecedor'],
  'Estoque Mín.': ['Estoque Mínimo', 'Mínimo', 'Min', 'Estoque Min'],
  'Quantidade':   ['Qtd', 'Qtde', 'Quant'],
  'Valor Unit.':  ['Valor Unitário', 'Preço Unitário', 'Preço'],
  'Valor Total':  ['Total'],
  'Código Item':  ['Código do Item', 'Cód. Item'],
  'Documento Ref.': ['Documento', 'Doc'],
  'Pedido Ref.':  ['Pedido'],
  'Tipo Compra':  ['Tipo de Compra'],
  'Prazo / Data Entrega': ['Prazo', 'Data de Entrega', 'Entrega'],
  'Origem comercial': ['Origem'],
  'Contagem Física': ['Contagem', 'Físico'],
  'Perdas (kg)':  ['Perdas'],
  'MP consumida (kg)': ['MP consumida', 'Matéria-prima consumida']
};

/** Campos calculados pelo servidor (nunca digitados, nunca com fórmula na planilha). */
var CALCULADOS = {
  PEDIDOS: ['Valor Total'],
  PRODUCAO: ['Prod./h', 'Prod./HH'],
  MOV_ESTOQUE: ['Qtd. Assinada'],
  COMPRAS: ['Valor Total'],
  INVENTARIO: ['Saldo Sistema', 'Diferença', 'Ajuste?'],
  ESTOQUE_ATUAL: ['Entradas', 'Saídas', 'Saldo Atual', 'Status']
};
