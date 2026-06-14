import WebSocket from 'ws';

const resp = await fetch('http://localhost:9222/json');
const targets = await resp.json();
const wa = targets.find(t => t.url && t.url.includes('web.whatsapp.com') && t.type === 'page');
if (!wa) { console.log('WA nao encontrado'); process.exit(1); }

const ws = new WebSocket(wa.webSocketDebuggerUrl);

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1, method: 'Runtime.evaluate',
    params: {
      expression: `JSON.stringify({
        insp: !!window.__mettriInspector,
        map: !!(window.__mettriInspector?.eventosPorChat),
        mettriChat: typeof window.Mettri?.Chat?.getActive === 'function',
        active: window.__mettriInspector?.chatIdAtivo,
        mapSize: window.__mettriInspector?.eventosPorChat?.size,
        mapEntries: window.__mettriInspector?.eventosPorChat ? 
          Array.from(window.__mettriInspector.eventosPorChat.entries()).map(([id, evts]) => ({id: id.substring(0, 25), n: evts.length})) : [],
      })`,
      returnByValue: true,
    },
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.id === 1) {
    const r = JSON.parse(msg.result.result.value);
    console.log('Estado atual:');
    console.log(JSON.stringify(r, null, 2));
    
    if (!r.insp) { console.log('Inspector nao carregado'); ws.close(); process.exit(0); }
    
    console.log('\nClicando +55 34 9931-4025 (area msg)...');
    ws.send(JSON.stringify({
      id: 2, method: 'Runtime.evaluate',
      params: {
        expression: `(()=>{
          const rows=document.querySelectorAll('[role="row"]');
          for(const row of rows){
            const spans=row.querySelectorAll('span');
            for(const s of spans){
              if((s.getAttribute('title')||s.textContent||'').includes('4025')){
                const r=row.getBoundingClientRect();
                return JSON.stringify({x:r.left+r.width*0.75,y:r.top+r.height/2,name:(s.getAttribute('title')||s.textContent||'').substring(0,30)});
              }
            }
          }
          return JSON.stringify({found:false});
        })()`,
        returnByValue: true,
      },
    }));
  }
  
  if (msg.id === 2) {
    const c = JSON.parse(msg.result.result.value);
    console.log('Alvo:', c.name || '?', c.found ? `(${c.x},${c.y})` : 'NAO ENCONTRADO');
    if (!c.found) { ws.close(); process.exit(0); }
    
    ws.send(JSON.stringify({id:3,method:'Input.dispatchMouseEvent',params:{type:'mousePressed',x:c.x,y:c.y,button:'left',clickCount:1}}));
    setTimeout(() => ws.send(JSON.stringify({id:4,method:'Input.dispatchMouseEvent',params:{type:'mouseReleased',x:c.x,y:c.y,button:'left',clickCount:1}})), 80);
  }
  
  if (msg.id === 4) {
    console.log('Clique OK, aguardando processamento...');
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 5, method: 'Runtime.evaluate',
        params: {
          expression: `JSON.stringify({
            chatId: window.__mettriInspector?.chatIdAtivo,
            events: window.__mettriInspector?.chatIdAtivo ? (window.__mettriInspector.eventosPorChat.get(window.__mettriInspector.chatIdAtivo)||[]).length : 0,
            content: document.querySelector("#mettri-inspector-content")?.textContent?.substring(0, 400) || "",
            header: document.querySelector("#main header [title]")?.getAttribute("title") || "N/A",
            hasFooter: !!document.querySelector("#main footer"),
            domMsgs: document.querySelectorAll("#main [data-testid=\\"msg-container\\"] [role=\\"row\\"]").length || document.querySelectorAll("#main .message-in, #main .message-out").length || 0,
          })`,
          returnByValue: true,
        },
      }));
    }, 5000);
  }
  
  if (msg.id === 5) {
    const r = JSON.parse(msg.result.result.value);
    console.log('\n=== RESULTADO FINAL ===');
    console.log(JSON.stringify(r, null, 2));
    if (r.events > 0) {
      console.log('\nOK AGENTE PROCESOU! ' + r.events + ' eventos.');
    } else if (r.chatId) {
      console.log('\nWARN Chat detectado (' + r.chatId + '), mas 0 eventos.');
      console.log('Header: ' + r.header + ' | DOM msgs: ' + r.domMsgs + ' | Footer: ' + r.hasFooter);
      if (r.header === 'Dados do perfil') {
        console.log('\nATENCAO WhatsApp abriu PERFIL, nao conversa. Precisa clicar mais a direita ou duplo clique.');
      }
    } else {
      console.log('\nFAIL Chat nao detectado.');
    }
    ws.close();
    process.exit(0);
  }
});

ws.on('error', e => { console.error(e.message); process.exit(1); });
setTimeout(() => { console.log('Timeout'); process.exit(1); }, 20000);
