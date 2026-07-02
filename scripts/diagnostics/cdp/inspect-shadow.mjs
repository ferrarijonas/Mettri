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
          if (!host || !host.shadowRoot) return JSON.stringify({found: false, error: 'no shadow host'});
          
          const sr = host.shadowRoot;
          const panel = sr.querySelector('#mettri-panel');
          if (!panel) return JSON.stringify({found: false, error: 'no mettri-panel in shadow'});
          
          const html = panel.innerHTML.substring(0, 12000);
          const allText = panel.textContent.substring(0, 500);
          return JSON.stringify({
            found: true,
            shadowChildren: sr.children.length,
            panelClasses: panel.className,
            textPreview: allText,
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
        console.log('Raw result:', msg.result.result.value?.substring(0, 2000));
      }
    }
    if (msg.error) console.error('Error:', JSON.stringify(msg.error));
    ws.close();
  }
});

ws.on('error', (e) => {
  console.error('WS error:', e.message);
  process.exit(1);
});
