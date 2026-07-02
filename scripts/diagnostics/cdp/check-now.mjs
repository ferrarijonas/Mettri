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
          if (!host || !host.shadowRoot) return JSON.stringify({found: false, msg: 'no host'});
          const sr = host.shadowRoot;
          const content = sr.querySelector('#mettri-content');
          if (!content) return JSON.stringify({found: false, msg: 'no content'});
          return JSON.stringify({
            found: true,
            children: content.children.length,
            html: content.innerHTML.substring(0, 5000)
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
      console.log(msg.result.result.value);
    }
    ws.close();
  }
});
ws.on('error', () => {});
