import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:9222/devtools/page/6B6E48C189E270E8AAE7AB2CE7676091');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `
        (() => {
          // Try to force reload the extension module
          try {
            // Check for the module in window scope (in MAIN world)
            const modNames = Object.keys(window).filter(k => k.includes('Mettri') || k.includes('Atendimento'));
            
            // Force clear any cached module data in the page
            const containers = document.querySelectorAll('[data-module-container]');
            containers.forEach(c => {
              c.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Recarregando...</div>';
            });
            
            return JSON.stringify({
              modNames,
              containerCount: containers.length
            });
          } catch(e) {
            return JSON.stringify({error: e.message});
          }
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
        console.log('Raw:', msg.result.result.value);
      }
    }
    ws.close();
  }
});

ws.on('error', (e) => {
  console.error('WS error:', e.message);
  process.exit(1);
});
