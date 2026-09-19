/* GPEL - teste de fumaça da interface.
   Abre o aplicativo num navegador de verdade, com o backend simulado,
   passa por todas as telas e executa os fluxos principais.

   Precisa do Playwright instalado:
     npm install -D playwright
   Rodar com:
     node testes/teste-navegador.js
   (As telas do dia a dia funcionam sem isso; este teste é para quem for
    mexer no código da interface.) */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { carregarBackend } = require('./simulador');

let chromium;
try {
  chromium = require('playwright').chromium;
} catch (e) {
  try {
    chromium = require(path.join(process.env.NODE_PATH || '/usr/lib/node_modules', 'playwright')).chromium;
  } catch (e2) {
    console.log('Playwright não encontrado. Instale com: npm install -D playwright');
    process.exit(0);
  }
}

const RAIZ = path.join(__dirname, '..', 'web');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const PORTA = 8099;

let falhas = 0;
function conferir(condicao, mensagem) {
  if (condicao) console.log('  ok   ' + mensagem);
  else { falhas++; console.log('  FALHA ' + mensagem); }
}

function servir() {
  return http.createServer((req, res) => {
    // /apps-script/Interface.html serve o arquivo empacotado (modo Apps Script)
    if (req.url.split('?')[0] === '/interface-empacotada.html') {
      const gerado = path.join(__dirname, '..', 'apps-script', 'Interface.html');
      if (!fs.existsSync(gerado)) { res.writeHead(404); return res.end('rode: node ferramentas/empacotar.js'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(gerado));
    }
    const arquivo = path.join(RAIZ, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(arquivo)) { res.writeHead(404); return res.end('não encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'text/plain' });
    res.end(fs.readFileSync(arquivo));
  });
}

function popular(g) {
  g.instalarPlanilha();
  g.criar_('CAD_PRODUTOS', { 'Código': 'PA001', 'Produto': 'Papel higiênico 300 m', 'Tipo': 'Fabricação', 'Unidade': 'rolo' });
  g.criar_('CAD_PRODUTOS', { 'Código': 'RV001', 'Produto': 'Sabonete líquido', 'Tipo': 'Revenda', 'Unidade': 'un' });
  g.criar_('CAD_INSUMOS', { 'Código': 'MP001', 'Item': 'Bobina de papel', 'Unidade': 'kg' });
  g.criar_('CAD_CLIENTES', { 'Código': 'CL001', 'Razão Social': 'Unidade Prisional' });
  g.criar_('CAD_FORNECEDORES', { 'Código': 'FO001', 'Razão Social': 'Papelaria Central' });
  g.criar_('PEDIDOS', { 'Data': '2026-09-01', 'Cliente': 'CL001', 'Produto': 'PA001', 'Quantidade': 100, 'Valor Unit.': 4, 'Prazo / Data Entrega': '2026-09-05', 'Status': 'Recebido', 'Origem comercial': 'WhatsApp' });
  g.criar_('PRODUCAO', { 'Data': '2026-09-02', 'Produto': 'PA001', 'Meta': 1000, 'Produzido': 900, 'Perdas (kg)': 4, 'Horas': 9, 'Pessoas': 3, 'Status': 'Concluída' });
  g.criar_('COMPRAS', { 'Data': '2026-09-03', 'NF': '000123', 'Fornecedor': 'FO001', 'Tipo Compra': 'Matéria-prima', 'Classe': 'Insumo', 'Código Item': 'MP001', 'Quantidade': 500, 'Valor Unit.': 4.5 });
  g.definirEstoqueMinimo('MP001', 600);
}

(async () => {
  const g = carregarBackend().contexto;
  popular(g);

  const servidor = servir();
  await new Promise((r) => servidor.listen(PORTA, r));

  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 420, height: 880 } });
  const erros = [];
  const pagina = await contexto.newPage();
  pagina.on('pageerror', (e) => erros.push(e.message));
  pagina.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });

  // O navegador fala com o backend simulado, no lugar do Apps Script.
  await contexto.route('**/exec*', async (rota) => {
    const requisicao = rota.request();
    let corpo;
    if (requisicao.method() === 'POST') {
      corpo = g.doPost({ postData: { contents: requisicao.postData() } }).getContent();
    } else {
      const url = new URL(requisicao.url());
      const parametros = {};
      url.searchParams.forEach((valor, chave) => { parametros[chave] = valor; });
      corpo = g.doGet({ parameter: parametros }).getContent();
    }
    await rota.fulfill({ status: 200, contentType: 'application/json', body: corpo });
  });

  await contexto.addInitScript(() => {
    window.localStorage.setItem('gpel.urlApi', 'https://exemplo.local/macros/s/teste/exec');
    window.localStorage.setItem('gpel.usuario', 'Ana');
  });

  console.log('\nTelas');
  await pagina.goto('http://localhost:' + PORTA + '/index.html');
  await pagina.waitForTimeout(700);

  const telas = ['inicio', 'pedidos', 'producao', 'estoque', 'compras', 'inventario', 'gestao', 'administracao', 'configuracoes', 'movimentos?codigo=MP001'];
  for (const tela of telas) {
    await pagina.evaluate((t) => { window.location.hash = '#/' + t; }, tela);
    await pagina.waitForTimeout(350);
    const conteudo = (await pagina.textContent('#tela')).trim();
    conferir(conteudo.length > 20, 'tela ' + tela.split('?')[0] + ' carregou');
  }

  console.log('\nNovo pedido pela interface');
  await pagina.evaluate(() => { window.location.hash = '#/pedidos'; });
  await pagina.waitForTimeout(300);
  await pagina.click('#acoes-tela button');
  await pagina.waitForTimeout(250);
  await pagina.selectOption('#campo-Cliente', 'CL001');
  await pagina.selectOption('#campo-Produto', 'RV001');
  await pagina.fill('#campo-Quantidade', '25');
  await pagina.fill('[id="campo-Valor Unit."]', '3.20');
  await pagina.waitForTimeout(150);
  const previaTotal = await pagina.textContent('.painel .campo--calculado .campo__valor');
  conferir(previaTotal.indexOf('80,00') !== -1, 'prévia do valor total aparece antes de salvar');
  await pagina.click('.painel button[type=submit]');
  await pagina.waitForTimeout(700);
  const pedidos = g.listar('PEDIDOS');
  const ultimoPedido = pedidos[pedidos.length - 1];
  conferir(pedidos.length === 2, 'pedido gravado na planilha');
  conferir(ultimoPedido['Valor Total'] === 80, 'valor total calculado no servidor');
  conferir(ultimoPedido['Unidade'] === 'un', 'unidade preenchida a partir do produto');

  console.log('\nNova compra pela interface (entrada automática no estoque)');
  const movimentosAntes = g.listar('MOV_ESTOQUE').length;
  await pagina.evaluate(() => { window.location.hash = '#/compras'; });
  await pagina.waitForTimeout(300);
  await pagina.click('#acoes-tela button');
  await pagina.waitForTimeout(250);
  await pagina.fill('#campo-NF', '000777');
  await pagina.selectOption('#campo-Fornecedor', 'FO001');
  await pagina.selectOption('[id="campo-Tipo Compra"]', 'Matéria-prima');
  await pagina.selectOption('#campo-Classe', 'Insumo');
  await pagina.waitForTimeout(150);
  await pagina.selectOption('[id="campo-Código Item"]', 'MP001');
  await pagina.waitForTimeout(150);
  const itemAutomatico = await pagina.textContent('.painel .campo--calculado .campo__valor');
  conferir(itemAutomatico.indexOf('Bobina') !== -1, 'nome do item preenchido automaticamente pela classe/código');
  await pagina.fill('#campo-Quantidade', '200');
  await pagina.fill('[id="campo-Valor Unit."]', '5');
  await pagina.click('.painel button[type=submit]');
  await pagina.waitForTimeout(800);
  conferir(g.listar('MOV_ESTOQUE').length === movimentosAntes + 1, 'compra gerou exatamente uma movimentação');
  conferir(g.saldoDoItem('MP001') === 700, 'saldo do insumo atualizado para 700');

  console.log('\nInventário com aprovação de ajuste');
  await pagina.evaluate(() => { window.location.hash = '#/inventario'; });
  await pagina.waitForTimeout(300);
  await pagina.click('#acoes-tela button');
  await pagina.waitForTimeout(250);
  await pagina.selectOption('#campo-Classe', 'Insumo');
  await pagina.waitForTimeout(150);
  await pagina.selectOption('#campo-Código', 'MP001');
  await pagina.fill('[id="campo-Contagem Física"]', '690');
  await pagina.fill('#campo-Responsável', 'Ana');
  await pagina.click('.painel button[type=submit]');
  await pagina.waitForTimeout(800);
  conferir(g.saldoDoItem('MP001') === 700, 'contagem sozinha não mexe no saldo');

  await pagina.click('#resultado-lista .cartao');
  await pagina.waitForTimeout(300);
  await pagina.click('.painel button:has-text("Aprovar ajuste")');
  await pagina.waitForTimeout(300);
  await pagina.click('.painel button:has-text("Aprovar ajuste")');
  await pagina.waitForTimeout(900);
  conferir(g.saldoDoItem('MP001') === 690, 'depois de aprovar, o saldo vai para a contagem');
  const ajuste = g.listar('MOV_ESTOQUE').filter((m) => m['Origem'] === 'Inventário -');
  conferir(ajuste.length === 1, 'ajuste virou uma movimentação rastreável');

  console.log('\nSegunda abertura (dados guardados no aparelho)');
  const paginaLenta = await contexto.newPage();
  paginaLenta.on('pageerror', (e) => erros.push('2a abertura: ' + e.message));
  // servidor propositalmente lento: mostra se a tela aparece antes da resposta
  await paginaLenta.route('**/exec*', async (rota) => {
    await new Promise((r) => setTimeout(r, 2500));
    const url = new URL(rota.request().url());
    const parametros = {};
    url.searchParams.forEach((valor, chave) => { parametros[chave] = valor; });
    await rota.fulfill({ status: 200, contentType: 'application/json', body: g.doGet({ parameter: parametros }).getContent() });
  });
  const inicio = Date.now();
  await paginaLenta.goto('http://localhost:' + PORTA + '/index.html#/estoque');
  await paginaLenta.waitForSelector('#resultado-lista .cartao, table.tabela', { timeout: 2000 });
  const demora = Date.now() - inicio;
  conferir(demora < 2000, 'tela aparece na hora com os dados guardados (' + demora + ' ms, servidor levando 2500 ms)');
  await paginaLenta.close();

  console.log('\nEndereço antigo depois de restringir o acesso');
  const paginaBloqueada = await contexto.newPage();
  paginaBloqueada.on('pageerror', (e) => erros.push('bloqueada: ' + e.message));
  // O Google responde com desvio para o login: para o navegador, é falha de CORS.
  await paginaBloqueada.route('**/exec*', (rota) => rota.abort('failed'));
  await paginaBloqueada.addInitScript(() => { try { window.localStorage.removeItem('gpel.cache'); } catch (e) {} });
  await paginaBloqueada.goto('http://localhost:' + PORTA + '/index.html#/inicio');
  await paginaBloqueada.waitForTimeout(900);
  const textoBloqueado = await paginaBloqueada.textContent('#tela');
  conferir(textoBloqueado.indexOf('login com a sua conta Google') !== -1,
    'explica que o aplicativo mudou de endereço, em vez de "Failed to fetch"');
  const botao = paginaBloqueada.locator('#tela a.botao');
  conferir(await botao.count() === 1 && (await botao.getAttribute('href')).indexOf('/exec') !== -1,
    'oferece o botão que leva ao endereço do Google');
  await paginaBloqueada.close();

  console.log('\nModo Apps Script (página empacotada + login do Google)');
  const paginaGoogle = await contexto.newPage();
  paginaGoogle.on('pageerror', (e) => erros.push('apps script: ' + e.message));
  paginaGoogle.on('console', (m) => { if (m.type() === 'error') erros.push('apps script: ' + m.text()); });

  // Faz o papel do google.script.run, que existe só dentro do Apps Script.
  await paginaGoogle.exposeFunction('__chamarBackend', (funcao, argumento) => {
    return funcao === 'apiPost'
      ? g.doPost({ postData: { contents: JSON.stringify(argumento) } }).getContent()
      : g.doGet({ parameter: argumento }).getContent();
  });
  await paginaGoogle.addInitScript(() => {
    function construtor() {
      let sucesso = null;
      let falha = null;
      const objeto = {
        withSuccessHandler: (f) => { sucesso = f; return objeto; },
        withFailureHandler: (f) => { falha = f; return objeto; },
        apiGet: (p) => window.__chamarBackend('apiGet', p).then((r) => sucesso(r), (e) => falha && falha(e)),
        apiPost: (c) => window.__chamarBackend('apiPost', c).then((r) => sucesso(r), (e) => falha && falha(e))
      };
      return objeto;
    }
    window.google = { script: { run: construtor() } };
    // Sem URL guardada: nesse modo o aplicativo não precisa de endereço nenhum.
    try { window.localStorage.clear(); } catch (e) {}
  });

  await paginaGoogle.goto('http://localhost:' + PORTA + '/interface-empacotada.html');
  await paginaGoogle.waitForTimeout(900);
  const conteudoGoogle = await paginaGoogle.textContent('#tela');
  conferir(conteudoGoogle.indexOf('Configurações') === -1 && conteudoGoogle.length > 40,
    'aplicativo carrega sem pedir endereço do servidor');

  await paginaGoogle.click('#barra-inferior a[href="#/estoque"]');
  await paginaGoogle.waitForTimeout(500);
  conferir((await paginaGoogle.textContent('#titulo-tela')) === 'Estoque', 'navegação por link funciona dentro do quadro');

  const pedidosAntes = g.listar('PEDIDOS').length;
  await paginaGoogle.click('#barra-inferior a[href="#/pedidos"]');
  await paginaGoogle.waitForTimeout(400);
  await paginaGoogle.click('#acoes-tela button');
  await paginaGoogle.waitForTimeout(250);
  await paginaGoogle.selectOption('#campo-Cliente', 'CL001');
  await paginaGoogle.selectOption('#campo-Produto', 'PA001');
  await paginaGoogle.fill('#campo-Quantidade', '7');
  await paginaGoogle.fill('[id="campo-Valor Unit."]', '2');
  await paginaGoogle.click('.painel button[type=submit]');
  await paginaGoogle.waitForTimeout(800);
  conferir(g.listar('PEDIDOS').length === pedidosAntes + 1, 'gravação pela ponte google.script.run funciona');
  await paginaGoogle.close();

  console.log('\nVisão de computador');
  const paginaGrande = await contexto.newPage();
  paginaGrande.on('pageerror', (e) => erros.push('desktop: ' + e.message));
  await paginaGrande.setViewportSize({ width: 1280, height: 900 });
  await paginaGrande.goto('http://localhost:' + PORTA + '/index.html#/pedidos');
  await paginaGrande.waitForTimeout(800);
  conferir(await paginaGrande.locator('table.tabela').count() > 0, 'lista vira tabela no computador');
  await paginaGrande.goto('http://localhost:' + PORTA + '/index.html#/gestao');
  await paginaGrande.waitForTimeout(800);
  conferir((await paginaGrande.textContent('#tela')).indexOf('Curva ABC') !== -1, 'gestão mostra a curva ABC');

  console.log('\nErros de JavaScript: ' + (erros.length ? erros.join(' | ') : 'nenhum'));
  if (erros.length) falhas++;

  await navegador.close();
  servidor.close();
  console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
