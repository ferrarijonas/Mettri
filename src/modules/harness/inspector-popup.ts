import type { EventBus, EventHandler } from '../../ui/core/event-bus';
import { AGENT_EVENTS } from './types';
import type {
  AgentTurnoInicioEvent,
  AgentToolCallEvent,
  AgentToolResultEvent,
  AgentRespostaProntaEvent,
  AgentPrecisaFerramentaEvent,
  AgentErroEvent,
  AgentMemoriaSalvaEvent,
} from './types';

interface TimelineItem {
  timestamp: string;
  chatId: string;
  tipo: 'tool-call' | 'tool-result' | 'resposta' | 'precisa-ferramenta' | 'erro' | 'turno-inicio' | 'info';
  descricao: string;
  detalhes?: string[];
  raw?: unknown;
}

export class InspectorPopup {
  private popup: HTMLDivElement | null = null;
  private headerEl: HTMLDivElement | null = null;
  private chatInfoEl: HTMLDivElement | null = null;
  private contentEl: HTMLDivElement | null = null;
  private eventBus: EventBus | null = null;
  private disposers: (() => void)[] = [];
  private eventosPorChat = new Map<string, TimelineItem[]>();
  private chatIdAtivo: string | null = null;
  private get eventos(): TimelineItem[] {
    if (!this.chatIdAtivo) return [];
    let arr = this.eventosPorChat.get(this.chatIdAtivo);
    if (!arr) {
      arr = [];
      this.eventosPorChat.set(this.chatIdAtivo, arr);
    }
    return arr;
  }
  private resolverNome: ((chatId: string) => string) | null = null;
  private envHeaderInfo: { businessName: string; today: string } | null = null;

  private atualizarHeader(envInfo?: { businessName: string; today: string }): void {
    if (!this.headerEl) return;
    if (envInfo) this.envHeaderInfo = envInfo;
    if (!this.envHeaderInfo) return;
    const title = this.headerEl.querySelector('#mettri-inspector-title');
    if (title) {
      title.textContent = `Mettri Inspector | ${this.envHeaderInfo.businessName} | ${this.envHeaderInfo.today.split(' ')[0]}`;
    }
  }

  private exporGlobal(): void {
    (window as unknown as Record<string, unknown>).__mettriInspector = this;
  }

  private injetarCSS(): void {
    if (document.getElementById('mettri-inspector-css')) return;
    const style = document.createElement('style');
    style.id = 'mettri-inspector-css';
    style.textContent = `
#mettri-inspector {
  position:fixed; bottom:20px; right:20px; width:560px; height:420px;
  background:#1a1a2e; border:1px solid #3a3a5c; border-radius:12px;
  box-shadow:0 8px 32px rgba(0,0,0,0.5); z-index:2147483646;
  display:flex; flex-direction:column;
  font-family:'SF Mono','Cascadia Code','Fira Code',monospace;
  font-size:11px; color:#e0e0e0; overflow:hidden;
}
#mettri-inspector-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:5px 10px; background:#16213e; border-bottom:1px solid #3a3a5c;
  cursor:grab; user-select:none; font-size:11px; color:#7ec8e3; gap:8px;
}
#mettri-inspector-title { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
#mettri-inspector-actions { display:flex; gap:4px; }
#mettri-inspector-actions button {
  background:none; border:none; color:#888; cursor:pointer;
  font-size:12px; padding:2px 6px; line-height:1; border-radius:4px;
}
#mettri-inspector-actions button:hover { background:#2a2a4a; color:#ccc; }
#mettri-inspector-chat-info {
  padding:4px 10px; background:#16213e; border-bottom:1px solid #2a2a4a;
  font-size:10px; color:#888; display:flex; gap:8px;
}
#mettri-inspector-content { flex:1; overflow-y:auto; padding:6px 10px; background:#1a1a2e; }
.mettri-inspector-empty { color:#666; text-align:center; margin-top:60px; font-size:11px; }
.mettri-inspector-event { padding:4px 0; border-bottom:1px solid #2a2a4a; }
.mettri-inspector-event-line { display:flex; gap:8px; align-items:flex-start; }
.mettri-inspector-time {
  color:#555; font-size:10px; white-space:nowrap; min-width:65px; flex-shrink:0; padding-top:1px;
}
.mettri-inspector-dot { font-size:8px; flex-shrink:0; padding-top:2px; }
.mettri-inspector-desc { flex:1; word-break:break-all; white-space:pre-wrap; line-height:1.5; }
.mettri-inspector-detalhes {
  padding-left:76px; font-size:10px; color:#888; line-height:1.4; white-space:pre-wrap; word-break:break-all;
}
.mettri-inspector-detalhes div { padding:1px 0; }
#mettri-inspector-resize {
  position:absolute; bottom:0; right:0; width:14px; height:14px;
  cursor:nwse-resize; background:linear-gradient(135deg,transparent 50%,#3a3a5c 50%);
}
#copy-toast {
  position:fixed; bottom:60px; right:20px; background:#2ecc71; color:#fff;
  padding:6px 14px; border-radius:6px; font-size:11px; font-family:monospace;
  z-index:2147483647; opacity:0; transition:opacity 0.3s;
}`;
    document.head.appendChild(style);
  }

  private criarPopup(): void {
    if (this.popup) return;
    this.injetarCSS();

    const popup = document.createElement('div');
    popup.id = 'mettri-inspector';
    popup.innerHTML = `
      <div id="mettri-inspector-header">
        <span id="mettri-inspector-title">Mettri Inspector</span>
        <div id="mettri-inspector-actions">
          <button id="mettri-inspector-copy" title="Copiar logs deste chat">📋</button>
          <button id="mettri-inspector-close" title="Fechar">✕</button>
        </div>
      </div>
      <div id="mettri-inspector-chat-info"></div>
      <div id="mettri-inspector-content">
        <div class="mettri-inspector-empty">Clique em um chat do WhatsApp para ver os logs.</div>
      </div>
      <div id="mettri-inspector-resize"></div>
    `;

    document.body.appendChild(popup);
    this.popup = popup;
    this.headerEl = popup.querySelector('#mettri-inspector-header') as HTMLDivElement;
    this.chatInfoEl = popup.querySelector('#mettri-inspector-chat-info') as HTMLDivElement;
    this.contentEl = popup.querySelector('#mettri-inspector-content') as HTMLDivElement;

    this.headerEl.addEventListener('mousedown', this.onDragStart);
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);

    const resize = popup.querySelector('#mettri-inspector-resize');
    resize?.addEventListener('mousedown', this.onResizeStart);
    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);

    popup.querySelector('#mettri-inspector-close')?.addEventListener('click', () => this.toggle());
    popup.querySelector('#mettri-inspector-copy')?.addEventListener('click', () => this.copiarTudo());
  }

  private onDragStart = (e: Event): void => {
    if (!this.popup) return;
    const me = e as MouseEvent;
    this.isDragging = true;
    const rect = this.popup.getBoundingClientRect();
    this.dragStart = { x: me.clientX, y: me.clientY, left: rect.left, top: rect.top };
    this.headerEl!.style.cursor = 'grabbing';
  };

  private onDragMove = (e: Event): void => {
    if (!this.isDragging || !this.popup) return;
    const me = e as MouseEvent;
    this.popup.style.left = `${this.dragStart.left + (me.clientX - this.dragStart.x)}px`;
    this.popup.style.top = `${this.dragStart.top + (me.clientY - this.dragStart.y)}px`;
    this.popup.style.right = 'auto';
    this.popup.style.bottom = 'auto';
  };

  private onDragEnd = (): void => {
    this.isDragging = false;
    if (this.headerEl) this.headerEl.style.cursor = 'grab';
  };

  private isDragging = false;
  private dragStart = { x: 0, y: 0, left: 0, top: 0 };
  private isResizing = false;
  private resizeStart = { x: 0, y: 0, w: 0, h: 0 };

  private onResizeStart = (e: Event): void => {
    if (!this.popup) return;
    const me = e as MouseEvent;
    this.isResizing = true;
    this.resizeStart = { x: me.clientX, y: me.clientY, w: this.popup.offsetWidth, h: this.popup.offsetHeight };
  };

  private onResizeMove = (e: Event): void => {
    if (!this.isResizing || !this.popup) return;
    const me = e as MouseEvent;
    this.popup.style.width = `${Math.max(300, this.resizeStart.w + (me.clientX - this.resizeStart.x))}px`;
    this.popup.style.height = `${Math.max(200, this.resizeStart.h + (me.clientY - this.resizeStart.y))}px`;
  };

  private onResizeEnd = (): void => {
    this.isResizing = false;
  };

  private onDisposable<T>(event: string, handler: EventHandler<T>): () => void {
    this.eventBus!.on(event, handler);
    return () => this.eventBus!.off(event, handler);
  }

  private nomeChat(chatId: string): string {
    const nome = this.resolverNome ? this.resolverNome(chatId) : '';
    return nome || chatId.substring(0, 20);
  }

  private registrarListeners(): void {
    if (!this.eventBus) return;

    // Escuta mudança de chat ativo (usuário clicou em outro chat)
    this.disposers.push(
      this.onDisposable<{ chatId: string | null }>('chat:active-changed', (data) => {
        const novoChatId = data.chatId;
        if (!novoChatId || novoChatId === this.chatIdAtivo) return;
        this.chatIdAtivo = novoChatId;
        // Preserva eventos do chat anterior — renderiza os já acumulados para o novo chat
        this.atualizarInfo();
        this.renderizarTimeline();
      }),
    );

    // Armazena eventos do AGENT_EVENTS, só renderiza se for o chat ativo
    this.disposers.push(
      this.onDisposable<AgentTurnoInicioEvent>(AGENT_EVENTS.TURNO_INICIO, (data) => {
        // Sempre segue o chat que gerou o turno — sobrepõe chat:active-changed
        if (data.chatId !== this.chatIdAtivo) {
          this.chatIdAtivo = data.chatId;
          this.eventosPorChat.set(data.chatId, []); // zera só o chat novo
        }
        const detalhes: string[] = [];
        const nome = this.resolverNome ? this.resolverNome(data.chatId) : '';
        if (nome) detalhes.push(`Cliente: ${nome}`);
        if (data.totalMemoriasCarregadas !== undefined) {
          detalhes.push(`Memórias: ${data.totalMemoriasCarregadas}`);
        }
        if (data.envInfo) {
          detalhes.push(`Ambiente: ${data.envInfo.businessName} — ${data.envInfo.today}`);
          this.atualizarHeader(data.envInfo);
        }
        detalhes.push(`${data.ferramentasDisponiveis.length} ferramentas`);
        this.adicionarEvento({
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
          tipo: 'turno-inicio',
          descricao: `🆕 Turno: "${data.mensagem}"`,
          detalhes,
          raw: data as unknown as Record<string, unknown>,
        });
      }),
    );

    this.disposers.push(
      this.onDisposable<AgentToolCallEvent>(AGENT_EVENTS.TOOL_CALL, (data) => {
        if (data.chatId !== this.chatIdAtivo) return;
        this.adicionarEvento({
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
          tipo: 'tool-call',
          descricao: `🔧 ${data.nome}(${JSON.stringify(data.argumentos, null, 2)})`,
          raw: data as unknown as Record<string, unknown>,
        });
      }),
    );

    this.disposers.push(
      this.onDisposable<AgentToolResultEvent>(AGENT_EVENTS.TOOL_RESULT, (data) => {
        if (data.chatId !== this.chatIdAtivo) return;
        const resumo = data.resultado.sucesso
          ? `sucesso: ${JSON.stringify(data.resultado.dados, null, 2)}`
          : `ERRO: ${data.resultado.erro}`;
        this.adicionarEvento({
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
          tipo: 'tool-result',
          descricao: `✅ ${data.nome}\n${resumo}`,
          raw: data as unknown as Record<string, unknown>,
        });
      }),
    );

    this.disposers.push(
      this.onDisposable<AgentRespostaProntaEvent>(AGENT_EVENTS.RESPOSTA_PRONTA, (data) => {
        if (data.chatId !== this.chatIdAtivo) return;
        this.adicionarEvento({
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
          tipo: 'resposta',
          descricao: `💬 "${data.texto}"`,
          detalhes: [`${data.ferramentasChamadas.length} tools usadas neste turno`],
          raw: data as unknown as Record<string, unknown>,
        });
      }),
    );

    this.disposers.push(
      this.onDisposable<AgentPrecisaFerramentaEvent>(AGENT_EVENTS.PRECISA_FERRAMENTA, (data) => {
        if (data.chatId !== this.chatIdAtivo) return;
        this.adicionarEvento({
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
          tipo: 'precisa-ferramenta',
          descricao: `🆕 Precisa ferramenta: ${data.nomeSugerido}\n${data.descricao}`,
          detalhes: [
            `Entrada esperada: ${JSON.stringify(data.entradaEsperada)}`,
            `Saída esperada: ${JSON.stringify(data.saidaEsperada)}`,
          ],
          raw: data as unknown as Record<string, unknown>,
        });
      }),
    );

    this.disposers.push(
      this.onDisposable<AgentErroEvent>(AGENT_EVENTS.ERRO, (data) => {
        if (data.chatId !== this.chatIdAtivo) return;
        this.adicionarEvento({
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
          tipo: 'erro',
          descricao: `❌ [${data.gravidade}] ${data.erro}`,
          raw: data as unknown as Record<string, unknown>,
        });
      }),
    );

    this.disposers.push(
      this.onDisposable<AgentMemoriaSalvaEvent>(AGENT_EVENTS.MEMORIA_SALVA, (data) => {
        if (data.chatId !== this.chatIdAtivo) return;
        const nome = this.resolverNome ? this.resolverNome(data.chatId) : '';
        const detalhes = [
          `Tipo: ${data.tipo}`,
          `Chat: ${nome || data.chatId.substring(0, 20)}`,
          `Aprendizado: ${data.descricao}`,
          `Turno: ${data.totalFerramentas} ferramentas, status: ${data.status}`,
          `Duração: ${Math.round(data.duracaoMs / 1000)}s`,
          `ID: #${data.memoriaId}`,
        ];
        this.adicionarEvento({
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
          tipo: 'info',
          descricao: `🧠 Memória salva — ${data.tipo}`,
          detalhes,
        });
      }),
    );
  }

  init(eventBus: EventBus, resolverNome?: (chatId: string) => string): () => void {
    this.eventBus = eventBus;
    this.resolverNome = resolverNome ?? null;
    this.criarPopup();
    this.registrarListeners();
    this.exporGlobal();
    return () => this.destruir();
  }

  private adicionarEvento(item: TimelineItem): void {
    this.eventos.push(item);
    this.atualizarInfo();
    this.renderizarTimeline();
  }

  private atualizarInfo(): void {
    if (!this.chatInfoEl) return;
    if (this.chatIdAtivo) {
      const total = this.eventos.length;
      const tools = this.eventos.filter(e => e.tipo === 'tool-call').length;
      this.chatInfoEl.textContent = `📌 ${this.nomeChat(this.chatIdAtivo)}  ·  ${total} eventos  ·  ${tools} tools`;
    } else {
      this.chatInfoEl.textContent = '';
    }
  }

  private renderizarTimeline(): void {
    if (!this.contentEl) return;
    if (!this.chatIdAtivo || this.eventos.length === 0) {
      const msg = !this.chatIdAtivo
        ? 'Clique em um chat do WhatsApp para ver os logs.'
        : 'Nenhum evento para este chat.';
      this.contentEl.innerHTML = `<div class="mettri-inspector-empty">${msg}</div>`;
      return;
    }

    this.contentEl.innerHTML = this.eventos.map(item => {
      const cor = this.corPorTipo(item.tipo);
      const tempo = new Date(item.timestamp).toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      const descHtml = this.escapeHtml(item.descricao);
      const detalhesHtml = item.detalhes?.length
        ? `<div class="mettri-inspector-detalhes">${item.detalhes.map(d => `<div>└ ${this.escapeHtml(d)}</div>`).join('')}</div>`
        : '';
      return `<div class="mettri-inspector-event">
        <div class="mettri-inspector-event-line">
          <span class="mettri-inspector-time">${tempo}</span>
          <span class="mettri-inspector-dot" style="color:${cor};">●</span>
          <span class="mettri-inspector-desc">${descHtml}</span>
        </div>
        ${detalhesHtml}
      </div>`;
    }).join('');

    this.contentEl.scrollTop = this.contentEl.scrollHeight;
  }

  private corPorTipo(tipo: TimelineItem['tipo']): string {
    switch (tipo) {
      case 'turno-inicio': return '#7ec8e3';
      case 'tool-call': return '#5dade2';
      case 'tool-result': return '#58d68d';
      case 'resposta': return '#58d68d';
      case 'info': return '#888';
      case 'precisa-ferramenta': return '#f5b041';
      case 'erro': return '#e74c3c';
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private copiarTudo(): void {
    if (!this.chatIdAtivo) return;

    const linhas: string[] = [];
    linhas.push('=== Mettri Inspector — Log do Chat ===');
    linhas.push(`Chat: ${this.nomeChat(this.chatIdAtivo)} (${this.chatIdAtivo})`);
    linhas.push(`Exportado em: ${new Date().toISOString()}`);
    linhas.push(`Total de eventos: ${this.eventos.length}`);
    linhas.push('');

    for (const ev of this.eventos) {
      const tempo = new Date(ev.timestamp).toISOString();
      linhas.push(`[${tempo}] [${ev.tipo}] ${ev.descricao}`);
      if (ev.detalhes?.length) {
        for (const d of ev.detalhes) {
          linhas.push(`  ${d}`);
        }
      }
      if (ev.raw) {
        linhas.push(`  raw: ${JSON.stringify(ev.raw, null, 2)}`);
      }
      linhas.push('');
    }

    linhas.push('=== Fim do Log ===');

    const texto = linhas.join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto).catch(() => this.fallbackCopy(texto));
    } else {
      this.fallbackCopy(texto);
    }

    this.mostrarToast('Copiado!');
  }

  private fallbackCopy(texto: string): void {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }

  private mostrarToast(msg: string): void {
    let toast = document.getElementById('copy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'copy-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast!.style.opacity = '0'; }, 2000);
  }

  toggle(): void {
    if (!this.popup) return;
    const hidden = this.popup.style.display === 'none';
    this.popup.style.display = hidden ? '' : 'none';
  }

  private destruir(): void {
    this.disposers.forEach(d => d());
    this.disposers = [];
    this.popup?.remove();
    this.popup = null;
    this.eventBus = null;
    delete (window as unknown as Record<string, unknown>).__mettriInspector;
  }
}
