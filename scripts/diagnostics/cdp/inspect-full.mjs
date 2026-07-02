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
          if (!host || !host.shadowRoot) return JSON.stringify({found: false});
          
          const sr = host.shadowRoot;
          const allDivs = sr.querySelectorAll('div');
          const mettriContent = sr.querySelector('#mettri-content');
          
          if (!mettriContent) return JSON.stringify({found: false, error: 'no mettri-content'});
          
          // Get all unique text content from direct children
          const children = Array.from(mettriContent.children);
          const structure = children.map((child, i) => ({
            index: i,
            tag: child.tagName,
            classes: child.className.substring(0, 100),
            id: child.id,
            textPreview: child.textContent.substring(0, 80).replace(/\\s+/g, ' ').trim()
          }));
          
          // Check all module containers
          const modules = Array.from(sr.querySelectorAll('[data-module-container]')).map(el => ({
            module: el.getAttribute('data-module-container'),
            visible: el.style.display !== 'none',
            htmlLen: el.innerHTML.length,
            htmlPreview: el.innerHTML.substring(0, 500)
          }));
          
          return JSON.stringify({
            found: true,
            mettriContentChildren: children.length,
            structure,
            modules,
            html: mettriContent.innerHTML.substring(0, 5000)
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
        console.log('Raw result:', msg.result.result.value?.substring(0, 3000));
      }
    }
    ws.close();
  }
});

ws.on('error', (e) => {
  console.error('WS error:', e.message);
  process.exit(1);
});
