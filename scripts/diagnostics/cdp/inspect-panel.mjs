import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:9222/devtools/page/6B6E48C189E270E8AAE7AB2CE7676091');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `
        (() => {
          const p = document.querySelector('#mettri-panel');
          if (!p) return JSON.stringify({found: false});
          const html = p.innerHTML.substring(0, 10000);
          const style = p.getAttribute('style');
          return JSON.stringify({
            found: true,
            classes: p.className,
            style: style,
            htmlLength: html.length,
            html: html
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
        console.log(msg.result.result.value);
      }
    }
    if (msg.error) console.error('CDP Error:', msg.error);
    ws.close();
  }
});

ws.on('error', (e) => {
  console.error('WS error:', e.message);
  process.exit(1);
});
