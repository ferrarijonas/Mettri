import WebSocket from 'ws';

const SW_ID = 'AA8EB6E90607E8506F61D853190C35B9';
const ws = new WebSocket(`ws://localhost:9222/devtools/page/${SW_ID}`);

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `
        (async () => {
          try {
            const keys = await chrome.storage.local.get(null);
            const cacheKeys = Object.keys(keys).filter(k => k.startsWith('module_cache_'));
            await chrome.storage.local.remove(cacheKeys);
            await chrome.storage.local.remove(['moduleUpdateVersion', 'moduleUpdateCheckedAt']);
            return JSON.stringify({cleared: cacheKeys.length, keys: cacheKeys});
          } catch(e) {
            return JSON.stringify({error: e.message, stack: e.stack});
          }
        })();
      `
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
