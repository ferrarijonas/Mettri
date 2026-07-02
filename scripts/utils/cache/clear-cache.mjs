import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:9222/devtools/page/2BC049AB4AAAA5771106C668A606CD35');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `
        (async () => {
          try {
            // Clear cached modules from chrome.storage
            const keys = await chrome.storage.local.get(null);
            const cacheKeys = Object.keys(keys).filter(k => k.startsWith('module_cache_'));
            await chrome.storage.local.remove(cacheKeys);
            
            // Clear the module update tracking
            await chrome.storage.local.remove(['moduleUpdateVersion', 'moduleUpdateCheckedAt']);
            
            return JSON.stringify({
              cleared: cacheKeys.length,
              keys: cacheKeys
            });
          } catch(e) {
            return JSON.stringify({error: e.message});
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
    }
    ws.close();
  }
});
ws.on('error', (e) => {
  console.error('WS error:', e.message);
  process.exit(1);
});
