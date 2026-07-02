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
          
          // Find specific elements
          const hasNovaCompra = html.includes('Nova compra');
          const hasCompraNova = html.includes('Compra nova');
          const hasIntencaoChip = html.includes('rounded-full bg-primary/50 shrink-0');
          const hasDetalhesEntrega = html.includes('Entrega') && html.includes('Pagamento');
          const pedidoText = html.includes('2x') || html.includes('Total') || html.includes('R$');
          const hasTotal = html.includes('Total R$');
          
          // Find the section around "Nova compra" or similar
          const finder = (s) => {
            const idx = html.indexOf(s);
            return idx >= 0 ? html.substring(Math.max(0, idx - 100), idx + 200) : 'NOT FOUND: ' + s;
          };
          
          // Check if the rendering order is correct
          const orderCheck = () => {
            const sections = [
              'Header do Cliente',
              'Aba de Intenção',
              'Etapas',
              'Preferências do Cliente'
            ];
            const positions = sections.map(s => ({name: s, pos: html.indexOf(s)}));
            return positions;
          };
          
          return JSON.stringify({
            hasNovaCompra,
            hasCompraNova,
            hasIntencaoChip,
            hasDetalhesEntrega,
            hasPedidoText: pedidoText,
            hasTotal,
            ordem: orderCheck(),
            nearNovaCompra: finder('Nova compra'),
            nearTotal: finder('Total R$'),
            nearPreferencias: finder('Preferências')
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
