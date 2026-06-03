import type { EventBus, EventHandler } from '../../ui/core/event-bus';
import { AGENT_EVENTS } from './types';
import type {
  AgentTurnoInicioEvent,
  AgentToolCallEvent,
  AgentToolResultEvent,
  AgentRespostaProntaEvent,
  AgentPrecisaFerramentaEvent,
  AgentErroEvent,
} from './types';

interface TimelineItem {
  timestamp: string;
  chatId: string;
  tipo: 'tool-call' | 'tool-result' | 'resposta' | 'precisa-ferramenta' | 'erro' | 'turno-inicio' | 'info';
  descricao: string;
}

const MAX_VISIVEIS = 5;
const JANELA_ATIVO_MS = 60 * 60 * 1000; // 1 hora

export class InspectorPopup {
  private popup: HTMLDivElement | null = null;
  private headerEl: HTMLDivElement | null = null;
  private tabBar: HTMLDivElement | null = null;
  private contentEl: HTMLDivElement | null = null;
  private eventBus: EventBus | null = null;
  private disposers: (() => void)[] = [];
  private abas = new Map<string, TimelineItem[]>();
  private lastActivity = new Map<string, number>();
  private overflowAberto = false;
  private abaAtiva: string | null = null;
  private isDragging = false;
  private dragStart = { x: 0, y: 0, left: 0, top: 0 };
  private isResizing = false;
  private resizeStart = { x: 0, y: 0, w: 0, h: 0 };
  resolverNome: ((chatId: string) => string) | null = null;

  private exporGlobal(): void {
    (window as unknown as Record<string, unknown>).__mettriInspector = this;
  }

  /** Injeta o CSS do inspector no <head> da página (fora do Shadow DOM) */
  private injetarCSS(): void {
    if (document.getElementById('mettri-inspector-css')) return;
    const style = document.createElement('style');
    style.id = 'mettri-inspector-css';
    style.textContent = `
#mettri-inspector {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 480px;
  height: 360px;
  background: #1a1a2e;
  border: 1px solid #3a3a5c;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  font-family: 'SF Mono','Cascadia Code','Fira Code',monospace;
  font-size: 12px;
  color: #e0e0e0;
  overflow: hidden;
}
#mettri-inspector-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:6px 12px; background:#16213e; border-bottom:1px solid #3a3a5c;
  cursor:grab; user-select:none; font-weight:600; font-size:11px; color:#7ec8e3;
}
#mettri-inspector-actions { display:flex; gap:6px; }
#mettri-inspector-actions button {
  background:none; border:none; color:#888; cursor:pointer;
  font-size:14px; padding:0 4px; line-height:1;
}
#mettri-inspector-actions button:hover { color:#ccc; }
#mettri-inspector-tabs {
  display:flex; gap:2px; padding:4px 8px 0; background:#16213e;
  border-bottom:1px solid #3a3a5c; overflow-x:auto; min-height:28px;
}
.mettri-inspector-tab {
  padding:3px 10px; border-radius:6px 6px 0 0; cursor:pointer;
  font-size:10px; background:#16213e; color:#666;
  border:1px solid transparent; border-bottom:1px solid #3a3a5c;
  white-space:nowrap; position:relative; flex-shrink:0;
}
.mettri-inspector-tab.active {
  background:#1a1a2e; color:#7ec8e3;
  border-color:#3a3a5c; border-bottom-color:#1a1a2e;
}
.mettri-inspector-tab:hover { color:#aaa; }
#mettri-inspector-content { flex:1; overflow-y:auto; padding:8px; background:#1a1a2e; }
.mettri-inspector-empty { color:#666; text-align:center; margin-top:60px; font-size:11px; }
.mettri-inspector-event {
  padding:3px 0; border-bottom:1px solid #2a2a4a; display:flex; gap:8px; align-items:flex-start;
}
.mettri-inspector-time {
  color:#555; font-size:10px; white-space:nowrap; min-width:60px; flex-shrink:0; padding-top:1px;
}
.mettri-inspector-dot { font-size:8px; flex-shrink:0; padding-top:2px; }
.mettri-inspector-desc { flex:1; word-break:break-word; }
#mettri-inspector-resize {
  position:absolute; bottom:0; right:0; width:14px; height:14px;
  cursor:nwse-resize; background:linear-gradient(135deg,transparent 50%,#3a3a5c 50%);
}
#mettri-inspector-overflow {
  padding:3px 8px; border-radius:6px 6px 0 0; cursor:pointer;
  font-size:10px; background:#16213e; color:#888;
  border:1px solid transparent; border-bottom:1px solid #3a3a5c;
  white-space:nowrap; flex-shrink:0; position:relative;
}
#mettri-inspector-overflow:hover { color:#aaa; }
#mettri-inspector-overflow-list {
  display:none; position:absolute; top:100%; right:0; z-index:2147483647;
  background:#1a1a2e; border:1px solid #3a3a5c; border-radius:6px;
  max-height:200px; overflow-y:auto; min-width:160px;
}
#mettri-inspector-overflow-list.open { display:block; }
.mettri-inspector-overflow-item {
  padding:4px 10px; cursor:pointer; font-size:10px; color:#aaa;
  border-bottom:1px solid #2a2a4a;
}
.mettri-inspector-overflow-item:hover { background:#16213e; color:#7ec8e3; }
.mettri-inspector-overflow-item:last-child { border-bottom:none; }`;
    document.head.appendChild(style);
  }

  private criarPopup(): void {
    if (this.popup) return;
    this.injetarCSS();

    const popup = document.createElement('div');
    popup.id = 'mettri-inspector';
    popup.innerHTML = `
      <div id="mettri-inspector-header">
        <span>🤖 Agent Inspector</span>
        <div id="mettri-inspector-actions">
          <button id="mettri-inspector-detach" title="Destacar">↗</button>
          <button id="mettri-inspector-close" title="Fechar">✕</button>
        </div>
      </div>
      <div id="mettri-inspector-tabs"></div>
      <div id="mettri-inspector-content">
        <div class="mettri-inspector-empty">Nenhuma atividade do agente ainda.</div>
      </div>
      <div id="mettri-inspector-resize"></div>
    `;

    document.body.appendChild(popup);
    this.popup = popup;
    this.headerEl = popup.querySelector('#mettri-inspector-header') as HTMLDivElement;
    this.tabBar = popup.querySelector('#mettri-inspector-tabs') as HTMLDivElement;
    this.contentEl = popup.querySelector('#mettri-inspector-content') as HTMLDivElement;

    this.headerEl.addEventListener('mousedown', this.onDragStart);
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);

    const resize = popup.querySelector('#mettri-inspector-resize');
    resize?.addEventListener('mousedown', this.onResizeStart);
    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);

    popup.querySelector('#mettri-inspector-close')?.addEventListener('click', () => this.toggle());
    popup.querySelector('#mettri-inspector-detach')?.addEventListener('click', () => this.detach());
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

  private registrarListeners(): void {
    if (!this.eventBus) return;

    this.disposers.push(
      this.onDisposable<AgentTurnoInicioEvent>(AGENT_EVENTS.TURNO_INICIO, (data) => {
        // Limpa eventos anteriores — cada turno começa do zero
        this.abas.set(data.chatId, []);
        this.adicionarEvento(data.chatId, {
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
          tipo: 'turno-inicio',
          descricao: `Início: "${data.mensagem.substring(0, 50)}"`,
        });
      }),
    );

    this.disposers.push(
      this.onDisposable<AgentToolCallEvent>(AGENT_EVENTS.TOOL_CALL, (data) => {
        this.adicionarEvento(data.chatId, {
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
          tipo: 'tool-call',
          descricao: `🔧 ${data.nome}(${this.resumirArgs(data.argumentos)})`,
        });
      }),
    );

    this.disposers.push(
      this.onDisposable<AgentToolResultEvent>(AGENT_EVENTS.TOOL_RESULT, (data) => {
        const resumo = this.resumirResultado(data.resultado);
        this.adicionarEvento(data.chatId, {
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
          tipo: 'tool-result',
          descricao: `✅ ${data.nome} → ${resumo}`,
        });
      }),
    );

    this.disposers.push(
      this.onDisposable<AgentRespostaProntaEvent>(AGENT_EVENTS.RESPOSTA_PRONTA, (data) => {
        this.adicionarEvento(data.chatId, {
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
          tipo: 'resposta',
          descricao: `💬 "${data.texto.substring(0, 80)}"`,
        });
        this.adicionarEvento(data.chatId, {
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
          tipo: 'info',
          descricao: `🛌 Dormindo (${data.ferramentasChamadas.length} tools usadas)`,
        });
      }),
    );

    this.disposers.push(
      this.onDisposable<AgentPrecisaFerramentaEvent>(AGENT_EVENTS.PRECISA_FERRAMENTA, (data) => {
        this.adicionarEvento(data.chatId, {
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
          tipo: 'precisa-ferramenta',
          descricao: `🆕 Precisa: ${data.nomeSugerido} — ${data.descricao.substring(0, 50)}`,
        });
      }),
    );

    this.disposers.push(
      this.onDisposable<AgentErroEvent>(AGENT_EVENTS.ERRO, (data) => {
        this.adicionarEvento(data.chatId, {
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
          tipo: 'erro',
          descricao: `❌ [${data.gravidade}] ${data.erro.substring(0, 100)}`,
        });
      }),
    );
  }

  private resumirArgs(args: Record<string, unknown>): string {
    const str = JSON.stringify(args);
    return str.length > 50 ? str.substring(0, 50) + '…' : str;
  }

  private resumirResultado(resultado: { sucesso: boolean; dados?: unknown; erro?: string }): string {
    if (!resultado.sucesso) return `ERRO: ${(resultado.erro || 'desconhecido').substring(0, 60)}`;
    if (typeof resultado.dados === 'string') return resultado.dados.substring(0, 60);
    const str = JSON.stringify(resultado.dados);
    return str.length > 60 ? str.substring(0, 60) + '…' : str;
  }

  init(eventBus: EventBus, resolverNome?: (chatId: string) => string): () => void {
    this.eventBus = eventBus;
    this.resolverNome = resolverNome ?? null;
    this.criarPopup();
    this.registrarListeners();
    this.exporGlobal();
    return () => this.destruir();
  }

  private adicionarEvento(chatId: string, item: TimelineItem): void {
    this.lastActivity.set(chatId, Date.now());
    if (!this.abas.has(chatId)) {
      this.abas.set(chatId, []);
    }
    this.abas.get(chatId)!.push(item);

    if (this.abaAtiva === chatId) {
      this.renderizarTimeline();
      this.renderizarAbas();
    } else if (!this.abaAtiva) {
      this.abaAtiva = chatId;
      this.renderizarAbas();
      this.renderizarTimeline();
    } else {
      this.renderizarAbas();
    }
  }

  private renderizarAbas(): void {
    if (!this.tabBar) return;
    this.tabBar.innerHTML = '';

    const agora = Date.now();
    const ordenados = [...this.abas.keys()]
      .sort((a, b) => (this.lastActivity.get(b) ?? 0) - (this.lastActivity.get(a) ?? 0));
    const visiveis = ordenados
      .filter((id) => (this.lastActivity.get(id) ?? 0) > agora - JANELA_ATIVO_MS)
      .slice(0, MAX_VISIVEIS);
    const inativos = ordenados.filter((id) => !visiveis.includes(id));

    for (const chatId of visiveis) {
      this.criarTab(chatId);
    }

    if (inativos.length > 0) {
      this.criarOverflowBtn(inativos);
    }
  }

  private criarTab(chatId: string): void {
    if (!this.tabBar) return;
    const tab = document.createElement('div');
    tab.className = 'mettri-inspector-tab' + (chatId === this.abaAtiva ? ' active' : '');
    const nome = this.resolverNome ? this.resolverNome(chatId) : chatId;
    const label = nome.length > 16 ? nome.substring(0, 14) + '…' : nome;
    tab.textContent = label;
    tab.title = chatId + (nome !== chatId ? ' — ' + nome : '');
    tab.addEventListener('click', () => {
      this.abaAtiva = chatId;
      this.fecharOverflow();
      this.renderizarAbas();
      this.renderizarTimeline();
    });
    this.tabBar.appendChild(tab);
  }

  private criarOverflowBtn(inativos: string[]): void {
    if (!this.tabBar) return;
    const container = document.createElement('div');
    container.id = 'mettri-inspector-overflow';
    container.textContent = `📋 +${inativos.length}`;
    container.title = 'Conversas inativas';

    const lista = document.createElement('div');
    lista.id = 'mettri-inspector-overflow-list';
    lista.className = this.overflowAberto ? 'open' : '';
    for (const chatId of inativos) {
      const item = document.createElement('div');
      item.className = 'mettri-inspector-overflow-item';
      const nome = this.resolverNome ? this.resolverNome(chatId) : chatId;
      const label = nome.length > 20 ? nome.substring(0, 18) + '…' : nome;
      item.textContent = label;
      item.title = chatId + (nome !== chatId ? ' — ' + nome : '');
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.abaAtiva = chatId;
        this.fecharOverflow();
        this.renderizarAbas();
        this.renderizarTimeline();
      });
      lista.appendChild(item);
    }
    container.appendChild(lista);

    container.addEventListener('click', (e) => {
      e.stopPropagation();
      this.overflowAberto = !this.overflowAberto;
      this.renderizarAbas();
    });

    // Fecha overflow ao clicar fora
    const fechar = (e: MouseEvent) => {
      if (this.overflowAberto && !container.contains(e.target as Node)) {
        this.fecharOverflow();
        this.renderizarAbas();
      }
    };
    document.addEventListener('click', fechar, { once: true });

    this.tabBar.appendChild(container);
  }

  private fecharOverflow(): void {
    this.overflowAberto = false;
  }

  private renderizarTimeline(): void {
    if (!this.contentEl || !this.abaAtiva) return;
    const eventos = this.abas.get(this.abaAtiva);
    if (!eventos || eventos.length === 0) {
      this.contentEl.innerHTML = '<div class="mettri-inspector-empty">Nenhum evento para este chat.</div>';
      return;
    }

    this.contentEl.innerHTML = eventos.map(item => {
      const cor = this.corPorTipo(item.tipo);
      const tempo = new Date(item.timestamp).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      return `<div class="mettri-inspector-event">
        <span class="mettri-inspector-time">${tempo}</span>
        <span class="mettri-inspector-dot" style="color:${cor};">●</span>
        <span class="mettri-inspector-desc">${this.escapeHtml(item.descricao)}</span>
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

  toggle(): void {
    if (!this.popup) return;
    const isHidden = this.popup.style.display === 'none';
    this.popup.style.display = isHidden ? '' : 'none';
  }

  detach(): void {
    if (!this.popup || !this.abaAtiva) return;
    const eventos = this.abas.get(this.abaAtiva);
    if (!eventos) return;

    const rect = this.popup.getBoundingClientRect();
    const w = window.open(
      '',
      'mettri-inspector-detached',
      `width=${rect.width},height=${rect.height},left=${rect.left},top=${rect.top}`,
    );
    if (!w) return;

    const html = eventos
      .map(item => {
        const cor = this.corPorTipo(item.tipo);
        const tempo = new Date(item.timestamp).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        return `<div class="event"><span class="time">${tempo}</span><span class="dot" style="color:${cor};">●</span><span class="desc">${this.escapeHtml(item.descricao)}</span></div>`;
      })
      .join('');

    w.document.write(`<!DOCTYPE html>
<html><head><title>Agent Inspector — ${this.abaAtiva}</title>
<style>
  body { margin:0; background:#1a1a2e; color:#e0e0e0; font-family:'SF Mono','Cascadia Code','Fira Code',monospace; font-size:12px; }
  .event { padding:3px 8px; border-bottom:1px solid #2a2a4a; display:flex; gap:8px; }
  .time { color:#555; font-size:10px; white-space:nowrap; min-width:60px; }
  .dot { font-size:10px; }
  .desc { flex:1; }
</style></head><body>${html}</body></html>`);
    w.document.close();
  }

  private destruir(): void {
    this.disposers.forEach(d => d());
    this.disposers = [];
    this.popup?.remove();
    this.popup = null;
    this.eventBus = null;
    delete (window as unknown as Record<string, unknown>).__mettriInspector;
  }

  getAbas(): number {
    return this.abas.size;
  }

  getEventos(chatId: string): TimelineItem[] | undefined {
    return this.abas.get(chatId);
  }
}
