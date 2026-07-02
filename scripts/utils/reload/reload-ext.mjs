import WebSocket from 'ws';

// Connect to the Mettri extension's service worker
const ws = new WebSocket('ws://localhost:9222/devtools/page/2BC049AB4AAAA5771106C668A606CD35');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `
        // Reload the extension to pick up new modules
        try {
          chrome.runtime.reload();
          'reload_called';
        } catch(e) {
          'error: ' + e.message;
        }
      `
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.id === 1) {
    console.log(JSON.stringify(msg, null, 2));
    ws.close();
  }
});

ws.on('error', (e) => {
  console.error('WS error:', e.message);
  process.exit(1);
});
