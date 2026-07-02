import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:9222/devtools/page/6B6E48C189E270E8AAE7AB2CE7676091');

ws.on('open', () => {
  ws.send(JSON.stringify({ id: 1, method: 'Page.reload', params: { ignoreCache: true } }));
});

let done = false;
ws.on('message', () => {
  if (!done) { done = true; console.log('Page reloaded'); setTimeout(() => process.exit(0), 1000); }
});
ws.on('error', () => {});
setTimeout(() => process.exit(0), 5000);
