import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:9222/devtools/page/6B6E48C189E270E8AAE7AB2CE7676091');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `
        (() => {
          const host = document.querySelector('#mettri-shadow-host');
          if (!host || !host.shadowRoot) return 'no host';
          const sr = host.shadowRoot;
          const content = sr.querySelector('[data-module-container="atendimento.dashboard"]');
          if (!content) return 'no content';
          const html = content.innerHTML;
          
          const checks = {
            // Positive checks (should have)
            hasNomeClicavel: html.includes('data-action=\"open-cadastro\"') && html.includes('w-full text-left cursor-pointer'),
            hasRecorrenteChip: html.includes('bg-primary/10 text-primary/90'),
            hasPhoneCopy: html.includes('data-action=\"copy-text\"'),
            hasAbaNovaCompra: html.includes('Nova compra') && html.includes('border-b border-border/20'),
            hasPipeline6: html.includes('Itens') && html.includes('Oferecer') && html.includes('Fechar Pedido'),
            hasPipelineEtapas: html.includes('6/6'),
            hasDetalhesGrid: html.includes('renderDetalhesPedido') || html.includes('Entrega') && html.includes('Pagamento'),
            hasResumeBtn: html.includes('order:send-resume'),
            hasCriarPedidoBtn: html.includes('Criar pedido'),
            hasVitrine: html.includes('Ofertas de hoje'),
            hasOuvinteFields: html.includes('Preferências'),
            hasHistorico: html.includes('historico') || html.includes('ticket'),
            
            // Negative checks (should NOT have)
            hasNotasBtn: html.includes('data-action=\"notes:open\"'),
            hasCadastroBtnHeader: (html.match(/data-action=\"open-cadastro\"/g) || []).length > 1,
            hasChatId: html.includes('font-mono') && html.includes('@'),
            hasAmber: html.includes('amber'),
            hasProximaAcao: html.includes('renderProximaAcao') || html.includes('sugestao:generate'),
            hasOldPipeline: html.includes('Intenção') && html.includes('Upsell') && html.includes('Confirmação'),
          };
          
          // Get text content of key sections for verification
          const fullText = content.textContent;
          
          return JSON.stringify({checks, htmlLen: html.length, textLen: fullText.length});
        })()
      `
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.id === 1) {
    if (msg.result && msg.result.result) {
      console.log(msg.result.result.value);
    }
    ws.close();
  }
});
ws.on('error', () => {});
