import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:9222/devtools/page/AA8EB6E90607E8506F61D853190C35B9');

ws.on('open', () => {
  // Step 1: get all keys
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `
        new Promise((resolve) => {
          chrome.storage.local.get(null, (items) => {
            const keys = Object.keys(items);
            const cacheKeys = keys.filter(k => k.startsWith('module_cache_'));
            chrome.storage.local.remove(cacheKeys.concat(['moduleUpdateVersion', 'moduleUpdateCheckedAt']), () => {
              resolve(JSON.stringify({cleared: cacheKeys.length, keys: cacheKeys}));
            });
          });
        })
      `,
      awaitPromise: true
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.id === 1) {
    if (msg.result && msg.result.result) {
      console.log(msg.result.result.value);
    } else if (msg.error) {
      console.error('Error:', JSON.stringify(msg.error));
    }
    ws.close();
  }
});
ws.on('error', (e) => {
  console.error('WS error:', e.message);
  process.exit(1);
});
