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
          if (!host || !host.shadowRoot) return 'no host';
          const sr = host.shadowRoot;
          const content = sr.querySelector('[data-module-container="atendimento.dashboard"]');
          if (!content) return 'no content';
          const html = content.innerHTML;
          
          // Extract specific sections
          const extractSection = (start, end) => {
            const idx = html.indexOf(start);
            if (idx < 0) return 'NOT FOUND';
            return html.substring(idx, idx + 800);
          };
          
          // Get the full panel content for sections we're interested in
          const sections = {};
          
          // Header section
          const headerStart = html.indexOf('Header do Cliente');
          sections.header = headerStart >= 0 ? html.substring(headerStart, headerStart + 1500) : 'NOT FOUND';
          
          // Tab section
          const tabStart = html.indexOf('Aba de Intenção');
          sections.tab = tabStart >= 0 ? html.substring(tabStart, tabStart + 2000) : 'NOT FOUND';
          
          // Bottom sections
          const prefStart = html.indexOf('Preferências');
          sections.pref = prefStart >= 0 ? html.substring(prefStart, prefStart + 500) : 'NOT FOUND';
          
          return JSON.stringify(sections);
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
