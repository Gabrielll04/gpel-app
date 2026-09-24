var VERSAO__AUTOMACOES = 'd3d750a6'; // marca de versão, gerada por ferramentas/empacotar.js
/**
 * GPEL - Automações.
 *
 * ATIVA (equivalente ao Bot do AppSheet):
 *   Compra -> Entrada em MOV_ESTOQUE.
 *   Implementada em Estoque.gs (gerarEntradaDaCompra_) e disparada apenas na
 *   CRIAÇÃO da compra, em Codigo.gs (criar_). A coluna técnica "Mov. Gerado"
 *   garante que editar a compra depois não duplique a entrada.
 *
 * PREVISTAS (não fazem parte do MVP, mas a arquitetura já comporta):
 *   1) Produção concluída  -> entrada de produto acabado.
 *   2) Consumo de MP       -> saída de insumo (só quando o apontamento de
 *                             matéria-prima for confiável).
 *   3) Entrega confirmada  -> saída de produto e atualização do pedido.
 *
 * Como implementar cada uma quando for a hora:
 *   - escrever uma função como a de baixo;
 *   - chamá-la em Codigo.gs, no ponto certo (criar_/atualizar_);
 *   - garantir idempotência: ou uma coluna técnica com o ID do movimento
 *     gerado, ou uma busca em MOV_ESTOQUE por Documento Ref. (como faz
 *     ajusteDoInventario_).
 *
 * Exemplo pronto para uso futuro (mantido desligado de propósito):
 *
 * function gerarEntradaDaProducao_(producao, responsavel) {
 *   if (textoLimpo_(producao['Status']) !== 'Concluída') return null;
 *   if (movimentoPorDocumento_(producao['ID Produção'], 'Produção')) return null;
 *   var movimento = criarMovimento({
 *     'Data': producao['Data'],
 *     'Classe': 'Produto',
 *     'Código Item': producao['Produto'],
 *     'Entrada/Saída': 'Entrada',
 *     'Origem': 'Produção',
 *     'Quantidade': producao['Produzido'],
 *     'Documento Ref.': producao['ID Produção'],
 *     'Responsável': responsavel || '',
 *     'Observações': 'Entrada automática - Produção'
 *   });
 *   recalcularEstoque();
 *   return movimento;
 * }
 */

/** Procura uma movimentação já gerada para um documento e origem (idempotência). */
function movimentoPorDocumento_(documento, origem) {
  var alvoDocumento = textoLimpo_(documento);
  var alvoOrigem = textoLimpo_(origem);
  var achado = null;
  listar('MOV_ESTOQUE').forEach(function (m) {
    if (textoLimpo_(m['Documento Ref.']) === alvoDocumento && textoLimpo_(m['Origem']) === alvoOrigem) achado = m;
  });
  return achado;
}
