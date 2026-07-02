import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:9222/devtools/page/AA8EB6E90607E8506F61D853190C35B9');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `
        JSON.stringify({
          hasChrome: typeof chrome !== 'undefined',
          hasStorage: typeof chrome !== 'undefined' && !!chrome.storage,
          hasLocal: typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local
        })
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
ws.on('error', (e) => {
  console.error('WS error:', e.message);
  process.exit(1);
});
