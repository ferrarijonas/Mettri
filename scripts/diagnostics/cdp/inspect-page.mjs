import WebSocket from 'ws';
import { readFileSync } from 'fs';

const ws = new WebSocket('ws://localhost:9222/devtools/page/6B6E48C189E270E8AAE7AB2CE7676091');

ws.on('open', () => {
  // First check all elements in the page
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `
        (() => {
          const results = {};
          
          // Check for mettri elements
          results.mettriPanel = !!document.querySelector('#mettri-panel');
          results.mettriNavbar = !!document.querySelector('#mettri-navbar');
          results.mettriContent = !!document.querySelector('#mettri-content');
          
          // Check extension injection
          const allDivs = document.querySelectorAll('div[id]');
          const ids = Array.from(allDivs).map(d => d.id).filter(id => id.includes('mettri'));
          results.mettriIds = ids;
          
          // Check for extension in page
          results.bodyChildren = document.body.children.length;
          results.waApp = !!document.querySelector('#app');
          
          // Try to check chrome extension
          results.extensionLoaded = typeof chrome !== 'undefined' && !!chrome.runtime;
          
          return JSON.stringify(results);
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
        console.log('Raw:', msg.result.result.value);
      }
    }
    if (msg.error) console.error('Error:', msg.error);
    ws.close();
  }
});

ws.on('error', (e) => {
  console.error('WS error:', e.message);
  process.exit(1);
});
