import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:9222/devtools/page/6B6E48C189E270E8AAE7AB2CE7676091');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `
        (() => {
          // Force reload the Mettri module by dispatching an event
          const tabContent = document.querySelector('.mettri-tab-content[data-module-container="atendimento.dashboard"]');
          if (!tabContent) return JSON.stringify({found: false, error: 'no tab content'});
          
          const inner = tabContent.innerHTML;
          // Check if our changes are there
          const hasPipeline = inner.includes('METTRI_PIPELINE');
          const hasDetalhes = inner.includes('renderDetalhesPedido');
          const hasResumeBtn = inner.includes('order:send-resume');
          const hasCriarPedido = inner.includes('Criar pedido');
          const hasNovoFlag = inner.includes('flag');
          const hasContentUx = inner.includes('mettri-content-ux');
          
          // Check for old patterns
          const hasAmber = inner.includes('amber');
          const hasProximaAcao = inner.includes('renderProximaAcao');
          const hasNotasBtn = inner.includes('notes:open');
          const hasChatId = inner.includes('chatId');
          
          return JSON.stringify({
            found: true,
            hasPipeline,
            hasDetalhes,
            hasResumeBtn,
            hasCriarPedido,
            hasNovoFlag,
            hasContentUx,
            hasAmber,
            hasProximaAcao,
            hasNotasBtn,
            hasChatId,
            innerLength: inner.length,
            preview: inner.substring(0, 3000)
          });
        })()
      `
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.id === 1) {
    if (msg.result && msg.result.result) {
      try {
        const val = JSON.parse(msg.result.result.value);
        console.log(JSON.stringify(val, null, 2));
      } catch(e) {
        console.log('Raw:', msg.result.result.value?.substring(0, 2000));
      }
    }
    ws.close();
  }
});

ws.on('error', (e) => {
  console.error('WS error:', e.message);
  process.exit(1);
});
