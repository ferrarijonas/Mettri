import type { SelectorTarget, ScanResult, ScanSession, ScanConfig, SelectorCategory } from '../types/selector-scanner';
import { SelectorGenerator } from './auto-mapper/selector-generator';
import { SelectorValidator, type SelectorContext } from './auto-mapper/selector-validator';
import { SelectorManager } from './selector-manager';
import { VisualScanner } from './visual-scanner';
import { MettriElementFilter } from './mettri-element-filter';

/**
 * Motor de varredura automática de seletores.
 * 
 * @deprecated Usar interceptação webpack quando disponível.
 * Mantido como fallback para casos onde webpack não está disponível.
 * 
 * TODO: Remover apenas após 3+ meses de webpack funcionando 100% em produção.
 * 
 * Responsabilidades:
 * - Analisar DOM hierarquicamente
 * - Identificar elementos candidatos
 * - Gerar múltiplos seletores candidatos
 * - Coordenar validação de cada seletor
 * - Gerenciar sessão de varredura
 */
export class SelectorScanner {
  private generator: SelectorGenerator;
  private validator: SelectorValidator;
  private selectorManager: SelectorManager;
  private visualScanner: VisualScanner;
  private session: ScanSession | null = null;
  private onProgressCallback?: (progress: number) => void;
  private onStatusCallback?: (status: string) => void;
  /**
   * Rastreamento de seletores já atribuídos a targets durante uma sessão de varredura.
   * CSS selector -> selectorId (target.id)
   */
  private usedSelectors: Map<string, string> = new Map();

  constructor() {
    this.generator = new SelectorGenerator();
    this.validator = new SelectorValidator();
    this.selectorManager = new SelectorManager();
    this.visualScanner = new VisualScanner();
  }

  /**
   * Varre todos os seletores especificados.
   * 
   * @param config Configuração de varredura
   * @returns Array de resultados da varredura
   */
  async scanAll(config: ScanConfig): Promise<ScanResult[]> {
    // Limpar rastreamento de exclusividade no início de cada varredura
    this.usedSelectors.clear();

    this.session = {
      id: `scan-${Date.now()}`,
      startedAt: new Date(),
      status: 'scanning',
      progress: 0,
      results: [],
      errors: [],
    };

    const results: ScanResult[] = [];
    const total = config.targets.length;

    for (let i = 0; i < config.targets.length; i++) {
      const target = config.targets[i];
      this.updateStatus(`Varrendo ${target.description}...`);

      try {
        const result = await this.scanSelector(target, config);
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        this.session.errors.push(`Erro ao varrer ${target.id}: ${errorMessage}`);
        results.push({
          selectorId: target.id,
          candidates: [],
          bestSelector: null,
          validated: false,
          validationErrors: [errorMessage],
          testDuration: 0,
          elementFound: false,
          elementCount: 0,
        });
      }

      const progress = ((i + 1) / total) * 100;
      this.updateProgress(progress);
    }

    // Validar resultados
    const p0Results = results.filter(r => {
      const target = config.targets.find(t => t.id === r.selectorId);
      return target?.priority === 'P0';
    });

    const p0Validated = p0Results.filter(r => r.validated).length;
    const p0Total = p0Results.length;

    if (config.requireP0Validation && p0Validated < p0Total) {
      this.session.status = 'failed';
      this.session.errors.push(
        `Falha: Apenas ${p0Validated} de ${p0Total} seletores P0 foram validados (requerido: 100%)`
      );
    } else {
      this.session.status = 'completed';
    }

    this.session.results = results;
    this.session.completedAt = new Date();
    this.updateStatus('Varredura concluída');

    return results;
  }

  /**
   * Varre um seletor específico.
   * 
   * @param target Seletor a varrer
   * @param config Configuração de varredura
   * @returns Resultado da varredura
   */
  async scanSelector(target: SelectorTarget, config: ScanConfig): Promise<ScanResult> {
    const startTime = Date.now();

    // Encontrar elementos candidatos
    const candidateElements = await this.findCandidatesForTarget(target);

    if (candidateElements.length === 0) {
      return {
        selectorId: target.id,
        candidates: [],
        bestSelector: null,
        validated: false,
        validationErrors: ['Nenhum elemento candidato encontrado'],
        testDuration: Date.now() - startTime,
        elementFound: false,
        elementCount: 0,
      };
    }

    // Gerar seletores candidatos para cada elemento
    const allCandidates: string[] = [];
    for (const element of candidateElements.slice(0, 5)) {
      // Limitar a 5 elementos para performance
      const candidates = this.generator.generateCandidates(element);
      allCandidates.push(...candidates);
    }

    // Remover duplicatas
    const uniqueCandidates = Array.from(new Set(allCandidates)).slice(0, config.maxCandidatesPerSelector);

    // Validar cada candidato
    let bestSelector: string | null = null;
    const validationErrors: string[] = [];

    for (const candidate of uniqueCandidates) {
      try {
        const isValid = await this.validateCandidate(candidate, target, candidateElements[0]);
        if (isValid) {
          // Validação de exclusividade: evitar que o mesmo seletor seja usado para múltiplos targets diferentes
          const existingOwner = this.usedSelectors.get(candidate);
          if (existingOwner && existingOwner !== target.id) {
            console.warn(
              `Mettri: Seletor "${candidate}" já foi usado para "${existingOwner}", rejeitando para "${target.id}" por exclusividade`
            );
            continue; // tentar próximo candidato mais específico
          }

          if (!bestSelector) {
            this.usedSelectors.set(candidate, target.id);
            bestSelector = candidate;
            break; // Primeiro válido e exclusivo é suficiente
          }
        }
      } catch (error) {
        validationErrors.push(
          `Erro ao validar "${candidate}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        );
      }
    }

    // Verificar se seletor encontrou elementos
    const elementCount = bestSelector
      ? document.querySelectorAll(bestSelector).length
      : 0;

    return {
      selectorId: target.id,
      candidates: uniqueCandidates,
      bestSelector,
      validated: bestSelector !== null,
      validationErrors,
      testDuration: Date.now() - startTime,
      elementFound: bestSelector !== null,
      elementCount,
    };
  }

  /**
   * Encontra elementos candidatos para um target específico usando sistema de busca em camadas.
   * 
   * @param target Target a encontrar
   * @returns Array de elementos candidatos
   */
  private async findCandidatesForTarget(target: SelectorTarget): Promise<HTMLElement[]> {
    const candidates: HTMLElement[] = [];
    
    // Camada 1: Busca específica (seletores exatos)
    const specific = this.findBySpecificSelectors(target);
    candidates.push(...specific);
    
    // Filtrar elementos do Mettri
    const filteredSpecific = MettriElementFilter.filterMettriElements(candidates);
    if (filteredSpecific.length > 0) {
      return filteredSpecific;
    }
    
    // Camada 2: Busca por padrões estruturais
    const patterns = this.findByPattern(target);
    candidates.push(...patterns);
    
    const filteredPatterns = MettriElementFilter.filterMettriElements(candidates);
    if (filteredPatterns.length > 0) {
      return filteredPatterns;
    }
    
    // Camada 3: Busca semântica (texto, aria-label, contexto)
    const semantic = this.findBySemantic(target);
    candidates.push(...semantic);
    
    const filteredSemantic = MettriElementFilter.filterMettriElements(candidates);
    if (filteredSemantic.length > 0) {
      return filteredSemantic;
    }
    
    // Camada 4: Busca hierárquica (TreeWalker)
    const hierarchy = this.findByHierarchy(target);
    candidates.push(...hierarchy);
    
    const filteredHierarchy = MettriElementFilter.filterMettriElements(candidates);
    if (filteredHierarchy.length > 0) {
      return filteredHierarchy;
    }
    
    // Camada 5: Busca visual básica (posição, tamanho)
    const visual = this.findByVisualCues(target);
    candidates.push(...visual);
    
    const filteredVisual = MettriElementFilter.filterMettriElements(candidates);
    if (filteredVisual.length > 0) {
      return filteredVisual;
    }
    
    // Camada 7: Busca por acessibilidade (ARIA, teclado, landmarks)
    const accessibility = this.findByAccessibility(target);
    candidates.push(...accessibility);
    
    const filteredAccessibility = MettriElementFilter.filterMettriElements(candidates);
    if (filteredAccessibility.length > 0) {
      return filteredAccessibility;
    }
    
    // Camada 6: Busca por visão computacional (análise de pixels, coordenadas precisas)
    // Usar apenas para seletores P0 e P1 que falharam nas outras camadas
    if (target.priority === 'P0' || target.priority === 'P1') {
      try {
        const visualResults = await this.findByComputerVision(target);
        candidates.push(...visualResults);
      } catch (error) {
        console.warn(`Mettri: Erro na detecção visual para ${target.id}:`, error);
      }
    }
    
    // Filtrar elementos do Mettri do resultado final
    return MettriElementFilter.filterMettriElements(candidates);
  }

  /**
   * Camada 1: Busca por seletores específicos (data-testid, id, role, etc).
   */
  private findBySpecificSelectors(target: SelectorTarget): HTMLElement[] {
    // Estratégias específicas por categoria
    switch (target.category) {
      case 'navigation':
        return this.findNavigationElements(target);
      case 'message':
        return this.findMessageElements(target);
      case 'input':
        return this.findInputElements(target);
      case 'metadata':
        return this.findMetadataElements(target);
      case 'ui':
        return this.findUIElements(target);
      default:
        return this.findGenericElements(target);
    }
  }

  /**
   * Encontra elementos de navegação (chatList, chatListItem, etc).
   */
  private findNavigationElements(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];

    if (target.id === 'chatList') {
      // Buscar sidebar esquerda
      const sidebar = document.querySelector('#pane-side') as HTMLElement;
      if (sidebar && this.isInCorrectContext(sidebar, target)) {
        candidates.push(sidebar);
      }

      // Buscar por data-testid
      const testId = document.querySelector('[data-testid="chat-list"]') as HTMLElement;
      if (testId && this.isInCorrectContext(testId, target)) {
        candidates.push(testId);
      }

      // Buscar por role
      const roleList = document.querySelector('[role="listbox"]') as HTMLElement;
      if (roleList && this.isInCorrectContext(roleList, target)) {
        candidates.push(roleList);
      }
    } else if (target.id === 'chatListItem') {
      // Buscar itens na lista de conversas
      const items = document.querySelectorAll('[data-testid="cell-frame-container"]');
      items.forEach(item => {
        if (item instanceof HTMLElement && this.isInCorrectContext(item, target)) {
          candidates.push(item);
        }
      });
    } else if (target.id === 'chatUnreadBadge') {
      // Badge de não lidas
      const badge = document.querySelector('[data-testid="icon-unread-count"]') as HTMLElement;
      if (badge && this.isInCorrectContext(badge, target)) {
        candidates.push(badge);
      }
      
      // Buscar badges numéricos dentro de chat items
      const chatItems = document.querySelectorAll('[data-testid="cell-frame-container"]');
      chatItems.forEach(item => {
        const badges = item.querySelectorAll('span, div');
        badges.forEach(b => {
          if (b instanceof HTMLElement && this.isInCorrectContext(b, target)) {
            const text = b.textContent?.trim() || '';
            if (/^\d+$/.test(text) && text.length <= 3) {
              const rect = b.getBoundingClientRect();
              if (rect.width < 30 && rect.height < 30 && this.isInCorrectContext(b, target)) {
                candidates.push(b);
              }
            }
          }
        });
      });
    } else if (target.id === 'chatLastMessage') {
      // Última mensagem na lista
      const subtitle = document.querySelector('[data-testid="subtitle"]') as HTMLElement;
      if (subtitle && this.isInCorrectContext(subtitle, target)) {
        candidates.push(subtitle);
      }
      
      // Buscar subtítulos dentro de chat items
      const chatItems = document.querySelectorAll('[data-testid="cell-frame-container"]');
      chatItems.forEach(item => {
        const spans = item.querySelectorAll('span');
        if (spans.length >= 2) {
          const preview = spans[1] as HTMLElement;
          if (preview && preview.textContent && preview.textContent.length > 5 && 
              this.isInCorrectContext(preview, target)) {
            candidates.push(preview);
          }
        }
      });
    } else if (target.id === 'chatName') {
      // Nome do contato na lista
      const title = document.querySelector('[data-testid="conversation-info-header-chat-title"]') as HTMLElement;
      if (title && this.isInCorrectContext(title, target)) {
        candidates.push(title);
      }
      
      // Buscar nomes dentro de chat items
      const chatItems = document.querySelectorAll('[data-testid="cell-frame-container"]');
      chatItems.forEach(item => {
        const spans = item.querySelectorAll('span[title], span[dir="auto"]');
        spans.forEach(span => {
          if (span instanceof HTMLElement && span.textContent && span.textContent.length > 0 &&
              this.isInCorrectContext(span, target)) {
            candidates.push(span);
          }
        });
      });
    }

    return MettriElementFilter.filterMettriElements(candidates);
  }

  /**
   * Encontra elementos de mensagem (messageIn, messageOut, etc).
   */
  private findMessageElements(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];

    if (target.id === 'messageIn' || target.id === 'messageOut') {
      // Buscar containers de mensagem
      const containers = document.querySelectorAll('[data-testid="msg-container"]');
      containers.forEach(container => {
        if (container instanceof HTMLElement && this.isInCorrectContext(container, target)) {
          // Detectar direção pela posição visual
          const rect = container.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const isLeft = rect.left < viewportWidth / 2;

          if ((target.id === 'messageIn' && isLeft) || (target.id === 'messageOut' && !isLeft)) {
            // Validação já aplicada antes do forEach
            candidates.push(container);
          }
        }
      });
    } else if (target.id === 'messageContainer') {
      const containers = document.querySelectorAll('[data-testid="msg-container"]');
      containers.forEach(container => {
        if (container instanceof HTMLElement && this.isInCorrectContext(container, target)) {
          candidates.push(container);
        }
      });
    } else if (target.id === 'messageText') {
      const texts = document.querySelectorAll('[data-testid="msg-text"]');
      texts.forEach(text => {
        if (text instanceof HTMLElement && this.isInCorrectContext(text, target)) {
          candidates.push(text);
        }
      });
    } else if (target.id === 'messageStatus') {
      // Status (enviado, entregue, lido)
      const statuses = document.querySelectorAll('[data-testid="msg-status"]');
      statuses.forEach(status => {
        if (status instanceof HTMLElement && this.isInCorrectContext(status, target)) {
          candidates.push(status);
        }
      });
      
      // Buscar ícones de check
      const checkIcons = document.querySelectorAll('[data-icon="check"], [data-icon="double-check"]');
      checkIcons.forEach(icon => {
        if (icon instanceof HTMLElement && this.isInCorrectContext(icon, target)) {
          candidates.push(icon);
        }
      });
    }

    return MettriElementFilter.filterMettriElements(candidates);
  }

  /**
   * Encontra elementos de input (searchBox, composeBox, sendButton).
   */
  private findInputElements(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];

    if (target.id === 'searchBox') {
      // Buscar caixa de pesquisa
      const searchBox = document.querySelector('[data-testid="chat-list-search"]') as HTMLElement;
      if (searchBox && this.isInCorrectContext(searchBox, target)) {
        candidates.push(searchBox);
      }

      // Buscar input com placeholder contendo "Pesquisar"
      const inputs = document.querySelectorAll('input[placeholder*="Pesquisar"], input[aria-label*="Pesquisar"]');
      inputs.forEach(input => {
        if (input instanceof HTMLElement && this.isInCorrectContext(input, target)) {
          candidates.push(input);
        }
      });

      // Buscar na sidebar (#pane-side)
      const sidebar = document.querySelector('#pane-side');
      if (sidebar) {
        const sidebarInputs = sidebar.querySelectorAll('input[type="text"], input:not([type])');
        sidebarInputs.forEach(input => {
          if (input instanceof HTMLElement && this.isInCorrectContext(input, target)) {
            const placeholder = input.getAttribute('placeholder') || '';
            const ariaLabel = input.getAttribute('aria-label') || '';
            if (placeholder.toLowerCase().includes('pesquisar') || 
                ariaLabel.toLowerCase().includes('pesquisar')) {
              candidates.push(input);
            }
          }
        });
      }
    } else if (target.id === 'composeBox') {
      // Buscar campo de digitação
      const composeBox = document.querySelector('[data-testid="conversation-compose-box-input"]') as HTMLElement;
      if (composeBox && this.isInCorrectContext(composeBox, target)) {
        candidates.push(composeBox);
      }

      // Buscar contenteditable no footer
      const footer = document.querySelector('footer');
      if (footer) {
        const editable = footer.querySelector('[contenteditable="true"]') as HTMLElement;
        if (editable && this.isInCorrectContext(editable, target)) {
          candidates.push(editable);
        }
      }
    } else if (target.id === 'sendButton') {
      // Buscar botão de enviar
      const sendBtn = document.querySelector('[data-testid="send"]') as HTMLElement;
      if (sendBtn && this.isInCorrectContext(sendBtn, target)) {
        candidates.push(sendBtn);
      }

      // Buscar por aria-label
      const ariaBtn = document.querySelector('button[aria-label*="Enviar"], button[aria-label*="Send"]') as HTMLElement;
      if (ariaBtn && this.isInCorrectContext(ariaBtn, target)) {
        candidates.push(ariaBtn);
      }
    }

    return MettriElementFilter.filterMettriElements(candidates);
  }

  /**
   * Encontra elementos de metadata (timestamp, status, etc).
   */
  private findMetadataElements(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];

    if (target.id === 'messageTimestamp' || target.id === 'messageMeta') {
      const metas = document.querySelectorAll('[data-testid="msg-meta"]');
      metas.forEach(meta => {
        if (meta instanceof HTMLElement && this.isInCorrectContext(meta, target)) {
          candidates.push(meta);
        }
      });
      
      // Buscar também por data-testid="msg-time"
      const times = document.querySelectorAll('[data-testid="msg-time"]');
      times.forEach(time => {
        if (time instanceof HTMLElement && this.isInCorrectContext(time, target)) {
          candidates.push(time);
        }
      });
      
      // Buscar spans dentro de msg-container que podem ser timestamps
      const containers = document.querySelectorAll('[data-testid="msg-container"]');
      containers.forEach(container => {
        const spans = container.querySelectorAll('span');
        spans.forEach(span => {
          if (span instanceof HTMLElement && this.isInCorrectContext(span, target)) {
            const text = span.textContent?.trim() || '';
            // Timestamps geralmente têm formato de hora (ex: "14:30")
            if (/^\d{1,2}:\d{2}$/.test(text)) {
              candidates.push(span);
            }
          }
        });
      });
    } else if (target.id === 'messageStatus') {
      const statuses = document.querySelectorAll('[data-testid="msg-status"]');
      statuses.forEach(status => {
        if (status instanceof HTMLElement && this.isInCorrectContext(status, target)) {
          candidates.push(status);
        }
      });
      
      // Buscar ícones de check
      const checkIcons = document.querySelectorAll('[data-icon="check"], [data-icon="double-check"]');
      checkIcons.forEach(icon => {
        if (icon instanceof HTMLElement && this.isInCorrectContext(icon, target)) {
          candidates.push(icon);
        }
      });
    }

    return MettriElementFilter.filterMettriElements(candidates);
  }

  /**
   * Encontra elementos de UI (header, scroll, etc).
   */
  private findUIElements(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];

    if (target.id === 'chatHeader' || target.id === 'chatHeaderName') {
      const header = document.querySelector('[data-testid="conversation-info-header"]') as HTMLElement;
      if (header && this.isInCorrectContext(header, target)) {
        candidates.push(header);
      }
      
      // Buscar também por header genérico
      if (target.id === 'chatHeaderName') {
        const title = header?.querySelector('[data-testid="conversation-info-header-chat-title"]') as HTMLElement;
        if (title && this.isInCorrectContext(title, target)) {
          candidates.push(title);
        }
        
        // Buscar span com title dentro do header
        const titleSpan = header?.querySelector('span[title]') as HTMLElement;
        if (titleSpan && this.isInCorrectContext(titleSpan, target)) {
          candidates.push(titleSpan);
        }
      }
    } else if (target.id === 'chatHeaderInfo') {
      // Botão de informações
      const header = document.querySelector('[data-testid="conversation-info-header"]');
      if (header) {
        const infoBtn = header.querySelector('button[aria-label*="info"], button[aria-label*="Info"]') as HTMLElement;
        if (infoBtn && this.isInCorrectContext(infoBtn, target)) {
          candidates.push(infoBtn);
        }
        
        // Buscar qualquer botão no header
        const buttons = header.querySelectorAll('button');
        buttons.forEach(btn => {
          if (btn instanceof HTMLElement && this.isInCorrectContext(btn, target)) {
            candidates.push(btn);
          }
        });
      }
    } else if (target.id === 'scrollContainer') {
      const scroll = document.querySelector('[data-testid="conversation-panel-messages"]') as HTMLElement;
      if (scroll && this.isInCorrectContext(scroll, target)) {
        candidates.push(scroll);
      }
      
      // Buscar também por role="log"
      const logContainer = document.querySelector('[role="log"]') as HTMLElement;
      if (logContainer && this.isInCorrectContext(logContainer, target)) {
        candidates.push(logContainer);
      }
    } else if (target.id === 'scrollToTop') {
      // Indicador de scroll no topo
      const scrollTop = document.querySelector('[data-testid="scroll-to-top"]') as HTMLElement;
      if (scrollTop && this.isInCorrectContext(scrollTop, target)) {
        candidates.push(scrollTop);
      }
      
      // Buscar botões no topo do scroll container
      const scrollContainer = document.querySelector('[data-testid="conversation-panel-messages"]') || 
                              document.querySelector('[role="log"]');
      if (scrollContainer) {
        const topButtons = scrollContainer.querySelectorAll('button, div[role="button"]');
        topButtons.forEach(btn => {
          if (btn instanceof HTMLElement && this.isInCorrectContext(btn, target)) {
            const rect = btn.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            if (rect.top <= containerRect.top + 100) {
              candidates.push(btn);
            }
          }
        });
      }
    } else if (target.id === 'typingIndicator') {
      // Indicador de digitação
      const typing = document.querySelector('[data-testid="typing"]') as HTMLElement;
      if (typing && this.isInCorrectContext(typing, target)) {
        candidates.push(typing);
      }
      
      // Buscar no footer
      const footer = document.querySelector('footer');
      if (footer) {
        const indicators = footer.querySelectorAll('[aria-label*="digitando"], [aria-label*="typing"]');
        indicators.forEach(ind => {
          if (ind instanceof HTMLElement && this.isInCorrectContext(ind, target)) {
            candidates.push(ind);
          }
        });
      }
    } else if (target.id === 'conversationPanel') {
      // Painel principal da conversa - múltiplas estratégias
      const panel = document.querySelector('[data-testid="conversation-panel-messages"]') as HTMLElement;
      if (panel && this.isInCorrectContext(panel, target)) {
        candidates.push(panel);
      }
      
      // Buscar por role="application"
      const appPanel = document.querySelector('[role="application"]') as HTMLElement;
      if (appPanel && this.isInCorrectContext(appPanel, target)) {
        candidates.push(appPanel);
      }
      
      // Buscar por role="log"
      const logPanel = document.querySelector('[role="log"]') as HTMLElement;
      if (logPanel && this.isInCorrectContext(logPanel, target)) {
        candidates.push(logPanel);
      }
      
      // Buscar dentro de #main
      const main = document.querySelector('#main');
      if (main) {
        const panels = main.querySelectorAll('[role="region"], div[style*="overflow"]');
        panels.forEach(p => {
          if (p instanceof HTMLElement && this.isInCorrectContext(p, target)) {
            candidates.push(p);
          }
        });
      }
    }

    return MettriElementFilter.filterMettriElements(candidates);
  }

  /**
   * Busca genérica de elementos.
   */
  private findGenericElements(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];

    // Tentar buscar por data-testid primeiro
    if (target.hints?.characteristics) {
      for (const hint of target.hints.characteristics) {
        if (hint.startsWith('data-testid=')) {
          const testId = hint.replace('data-testid=', '').replace(/['"]/g, '');
          const element = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
          if (element && this.isInCorrectContext(element, target)) {
            candidates.push(element);
          }
        }
      }
    }

    return MettriElementFilter.filterMettriElements(candidates);
  }

  /**
   * Valida um candidato de seletor.
   * 
   * @param candidate Seletor candidato
   * @param target Target esperado
   * @param expectedElement Elemento esperado (se conhecido)
   * @returns true se válido
   */
  private async validateCandidate(
    candidate: string,
    target: SelectorTarget,
    expectedElement?: HTMLElement
  ): Promise<boolean> {
    try {
      // Rejeitar se elemento esperado for do Mettri
      if (expectedElement && MettriElementFilter.isMettriElement(expectedElement)) {
        return false;
      }
      
      const elements = document.querySelectorAll(candidate);
      if (elements.length === 0) {
        return false;
      }

      // Filtrar elementos do Mettri
      const htmlElements = Array.from(elements).filter(
        (el): el is HTMLElement => el instanceof HTMLElement
      );
      const filteredElements = MettriElementFilter.filterMettriElements(htmlElements);
      
      if (filteredElements.length === 0) {
        return false;
      }

      // Se temos elemento esperado, verificar se está na lista
      if (expectedElement) {
        const found = filteredElements.includes(expectedElement);
        if (!found) {
          return false;
        }
      }

      // Validação básica: elemento deve estar visível
      const firstElement = filteredElements[0];
      const style = window.getComputedStyle(firstElement);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }

      // Rejeitar seletores baseados em aria-label muito específicos (ex: contendo nome de contato)
      const ariaLabel = firstElement.getAttribute('aria-label') || '';
      if (ariaLabel && this.isAriaLabelTooSpecific(ariaLabel, target)) {
        console.warn(
          `Mettri: Seletor rejeitado por aria-label muito específico para "${target.id}":`,
          ariaLabel,
          candidate
        );
        return false;
      }

      // Validação de contexto - aplicar antes de outras validações
      if (!this.isInCorrectContext(firstElement, target)) {
        return false;
      }

      // VALIDAÇÃO DE ESPECIFICIDADE: Verificar se seletor não é muito genérico
      const totalElements = filteredElements.length;
      
      // Se seletor corresponde a muitos elementos (>10), validar amostra representativa
      if (totalElements > 10) {
        // Pegar amostra aleatória de até 20 elementos
        const sampleSize = Math.min(20, totalElements);
        const sample: HTMLElement[] = [];
        const indices = new Set<number>();
        
        // Selecionar índices aleatórios
        while (indices.size < sampleSize) {
          const randomIndex = Math.floor(Math.random() * totalElements);
          indices.add(randomIndex);
        }
        
        // Coletar elementos da amostra
        indices.forEach(index => {
          sample.push(filteredElements[index]);
        });
        
        // Validar cada elemento da amostra
        let validCount = 0;
        for (const element of sample) {
          const isVisible = window.getComputedStyle(element).display !== 'none' && 
                           window.getComputedStyle(element).visibility !== 'hidden';
          const isInContext = this.isInCorrectContext(element, target);
          
          if (isVisible && isInContext) {
            validCount++;
          }
        }
        
        // Calcular precisão
        const precision = (validCount / sampleSize) * 100;
        
        // Log detalhado
        console.log(`Mettri: Validação de especificidade para "${target.id}":`, {
          candidate,
          totalElements,
          sampleSize,
          validCount,
          precision: `${precision.toFixed(1)}%`,
        });
        
        // Rejeitar se precisão < 80%
        if (precision < 80) {
          console.warn(`Mettri: Seletor rejeitado por baixa precisão (${precision.toFixed(1)}% < 80%):`, candidate);
          return false;
        }
        
        // Rejeitar se seletor corresponde a muitos elementos mas tem precisão baixa
        // (mesmo que passe 80%, se corresponder a centenas de elementos, pode ser genérico demais)
        if (totalElements > 50 && precision < 95) {
          console.warn(`Mettri: Seletor rejeitado por ser muito genérico (${totalElements} elementos, ${precision.toFixed(1)}% precisão):`, candidate);
          return false;
        }
      } else {
        // Para poucos elementos (<=10), validar todos
        let validCount = 0;
        for (const element of filteredElements) {
          const isVisible = window.getComputedStyle(element).display !== 'none' && 
                           window.getComputedStyle(element).visibility !== 'hidden';
          const isInContext = this.isInCorrectContext(element, target);
          
          if (isVisible && isInContext) {
            validCount++;
          }
        }
        
        const precision = (validCount / filteredElements.length) * 100;
        
        // Log detalhado
        console.log(`Mettri: Validação de especificidade para "${target.id}":`, {
          candidate,
          totalElements,
          validCount,
          precision: `${precision.toFixed(1)}%`,
        });
        
        // Rejeitar se precisão < 80%
        if (precision < 80) {
          console.warn(`Mettri: Seletor rejeitado por baixa precisão (${precision.toFixed(1)}% < 80%):`, candidate);
          return false;
        }
      }

      // Validação de contexto
      const context: SelectorContext = {
        selectorId: target.id,
        expectedCount: target.required ? 1 : undefined,
        mustBeVisible: true,
      };

      if (expectedElement) {
        const result = await this.validator.validate(candidate, expectedElement, context);
        return result.isValid;
      }

      return true;
    } catch (error) {
      console.warn(`Mettri: Erro ao validar candidato "${candidate}":`, error);
      return false;
    }
  }

  /**
   * Verifica se um aria-label é específico demais (ex: contém nome de contato).
   *
   * @param ariaLabel Valor de aria-label
   * @param target Target do seletor
   */
  private isAriaLabelTooSpecific(ariaLabel: string, target: SelectorTarget): boolean {
    const lower = ariaLabel.toLowerCase().trim();

    // Regras específicas para composeBox e inputs
    if (target.id === 'composeBox' || target.category === 'input') {
      // Exemplos problemáticos: "Digitar na conversa com Bill", "Digitar na conversa com Auxiliar_padeiro: Emilly"
      if (lower.includes('digitar na conversa com') || lower.includes('type a message to')) {
        return true;
      }
    }

    // Heurística geral: aria-label muito longo com múltiplas palavras pode indicar nome específico
    const words = ariaLabel.split(/\s+/);
    if (words.length >= 5) {
      return true;
    }

    return false;
  }

  /**
   * Obtém a sessão atual.
   * 
   * @returns Sessão atual ou null
   */
  getSession(): ScanSession | null {
    return this.session;
  }

  /**
   * Define callback para progresso.
   * 
   * @param callback Função chamada quando progresso muda
   */
  onProgress(callback: (progress: number) => void): void {
    this.onProgressCallback = callback;
  }

  /**
   * Define callback para status.
   * 
   * @param callback Função chamada quando status muda
   */
  onStatus(callback: (status: string) => void): void {
    this.onStatusCallback = callback;
  }

  /**
   * Atualiza progresso e chama callback.
   */
  private updateProgress(progress: number): void {
    if (this.session) {
      this.session.progress = Math.round(progress);
    }
    if (this.onProgressCallback) {
      this.onProgressCallback(this.session?.progress || 0);
    }
  }

  /**
   * Atualiza status e chama callback.
   */
  private updateStatus(status: string): void {
    if (this.onStatusCallback) {
      this.onStatusCallback(status);
    }
  }

  /**
   * Camada 2: Busca por padrões estruturais do DOM.
   */
  private findByPattern(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];

    // Buscar por padrões comuns baseados na estrutura
    if (target.id === 'chatUnreadBadge') {
      // Badges numéricos dentro de chat items
      const chatItems = document.querySelectorAll('[data-testid="cell-frame-container"]');
      chatItems.forEach(item => {
        const badges = item.querySelectorAll('span, div');
        badges.forEach(badge => {
          if (badge instanceof HTMLElement) {
            const text = badge.textContent?.trim() || '';
            const isNumeric = /^\d+$/.test(text);
            const rect = badge.getBoundingClientRect();
            const isSmall = rect.width < 30 && rect.height < 30;
            if (isNumeric && isSmall && text.length <= 3 && this.isInCorrectContext(badge, target)) {
              candidates.push(badge);
            }
          }
        });
      });
    } else if (target.id === 'chatLastMessage') {
      // Subtítulos dentro de chat items
      const chatItems = document.querySelectorAll('[data-testid="cell-frame-container"]');
      chatItems.forEach(item => {
        const spans = item.querySelectorAll('span');
        // Geralmente o segundo ou terceiro span é o preview
        if (spans.length >= 2) {
          const preview = spans[1] as HTMLElement;
          if (preview && preview.textContent && preview.textContent.length > 0 &&
              this.isInCorrectContext(preview, target)) {
            candidates.push(preview);
          }
        }
      });
    } else if (target.id === 'messageStatus') {
      // Ícones de check dentro de mensagens enviadas
      const messageContainers = document.querySelectorAll('[data-testid="msg-container"]');
      messageContainers.forEach(container => {
        const rect = container.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const isOutgoing = rect.left > viewportWidth / 2;
        
        if (isOutgoing) {
          // Buscar ícones SVG ou elementos com data-icon
          const icons = container.querySelectorAll('[data-icon*="check"], svg');
          icons.forEach(icon => {
            if (icon instanceof HTMLElement && this.isInCorrectContext(icon, target)) {
              candidates.push(icon);
            }
          });
        }
      });
    } else if (target.id === 'scrollToTop') {
      // Indicadores no topo do scroll container
      const scrollContainer = document.querySelector('[data-testid="conversation-panel-messages"]') || 
                              document.querySelector('[role="log"]');
      if (scrollContainer) {
        const topElements = scrollContainer.querySelectorAll('button, div[role="button"]');
        topElements.forEach(el => {
          if (el instanceof HTMLElement) {
            const rect = el.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            // Elemento próximo ao topo do container
            if (rect.top <= containerRect.top + 50 && this.isInCorrectContext(el, target)) {
              candidates.push(el);
            }
          }
        });
      }
    } else if (target.id === 'typingIndicator') {
      // Indicadores de digitação no footer
      const footer = document.querySelector('footer');
      if (footer) {
        const indicators = footer.querySelectorAll('[aria-label*="digitando"], [aria-label*="typing"], span');
        indicators.forEach(ind => {
          if (ind instanceof HTMLElement && ind.textContent?.toLowerCase().includes('digitando') &&
              this.isInCorrectContext(ind, target)) {
            candidates.push(ind);
          }
        });
      }
    }

    return MettriElementFilter.filterMettriElements(candidates);
  }

  /**
   * Camada 3: Busca semântica (texto, aria-label, contexto).
   */
  private findBySemantic(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];

    // Buscar por texto ou aria-label
    if (target.id === 'chatUnreadBadge') {
      // Buscar elementos com texto numérico ou aria-label relacionado
      const allElements = document.querySelectorAll('#pane-side span, #pane-side div');
      allElements.forEach(el => {
        if (el instanceof HTMLElement) {
          const text = el.textContent?.trim() || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          const isNumeric = /^\d+$/.test(text);
          const mentionsUnread = ariaLabel.toLowerCase().includes('não lidas') || 
                                 ariaLabel.toLowerCase().includes('unread');
          
          if ((isNumeric && text.length <= 3) || mentionsUnread) {
            if (this.isInCorrectContext(el, target)) {
              candidates.push(el);
            }
          }
        }
      });
    } else if (target.id === 'chatLastMessage') {
      // Buscar subtítulos por texto ou data-testid
      const subtitle = document.querySelector('[data-testid*="subtitle"]') as HTMLElement;
      if (subtitle && this.isInCorrectContext(subtitle, target)) {
        candidates.push(subtitle);
      }
      
      // Buscar dentro de chat items
      const chatItems = document.querySelectorAll('[data-testid="cell-frame-container"]');
      chatItems.forEach(item => {
        const spans = item.querySelectorAll('span');
        spans.forEach(span => {
          if (span instanceof HTMLElement && span.textContent && span.textContent.length > 5 &&
              this.isInCorrectContext(span, target)) {
            // Provavelmente é preview de mensagem
            candidates.push(span);
          }
        });
      });
    } else if (target.id === 'messageStatus') {
      // Buscar por data-icon ou aria-label
      const statusIcons = document.querySelectorAll('[data-icon="check"], [data-icon="double-check"]');
      statusIcons.forEach(icon => {
        if (icon instanceof HTMLElement && this.isInCorrectContext(icon, target)) {
          candidates.push(icon);
        }
      });
    } else if (target.id === 'chatHeaderInfo') {
      // Buscar botão de info no header
      const header = document.querySelector('[data-testid="conversation-info-header"]');
      if (header) {
        const infoBtn = header.querySelector('button[aria-label*="info"], button[aria-label*="Info"]') as HTMLElement;
        if (infoBtn && this.isInCorrectContext(infoBtn, target)) {
          candidates.push(infoBtn);
        }
      }
    } else if (target.id === 'typingIndicator') {
      // Buscar por aria-label ou texto
      const footer = document.querySelector('footer');
      if (footer) {
        const typing = footer.querySelector('[aria-label*="digitando"], [aria-label*="typing"]') as HTMLElement;
        if (typing && this.isInCorrectContext(typing, target)) {
          candidates.push(typing);
        }
      }
    } else if (target.id === 'conversationPanel') {
      // Buscar painel por contexto (área central)
      const main = document.querySelector('#main');
      if (main) {
        const panels = main.querySelectorAll('[role="application"], [role="log"], div[style*="overflow"]');
        panels.forEach(panel => {
          if (panel instanceof HTMLElement && this.isInCorrectContext(panel, target)) {
            candidates.push(panel);
          }
        });
      }
    }

    return MettriElementFilter.filterMettriElements(candidates);
  }

  /**
   * Camada 4: Busca hierárquica usando TreeWalker.
   */
  private findByHierarchy(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];
    const maxDepth = 10; // Limitar profundidade para performance

    // Determinar contexto raiz baseado no target
    let root: HTMLElement | null = null;
    
    if (target.category === 'navigation') {
      root = document.querySelector('#pane-side') as HTMLElement;
    } else if (target.category === 'message' || target.category === 'metadata') {
      root = document.querySelector('#main') as HTMLElement;
    } else if (target.category === 'ui') {
      root = document.querySelector('#main') as HTMLElement;
    } else if (target.category === 'input') {
      root = document.querySelector('footer') as HTMLElement;
    }

    if (!root) {
      root = document.body;
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node: Node) => {
          if (!(node instanceof HTMLElement)) {
            return NodeFilter.FILTER_REJECT;
          }

          // Verificar profundidade
          let depth = 0;
          let parent = node.parentElement;
          while (parent && depth < maxDepth) {
            depth++;
            parent = parent.parentElement;
          }
          if (depth >= maxDepth) {
            return NodeFilter.FILTER_REJECT;
          }

          // Filtros específicos por target
          if (target.id === 'chatUnreadBadge') {
            const text = node.textContent?.trim() || '';
            if (/^\d+$/.test(text) && text.length <= 3 && this.isInCorrectContext(node, target)) {
              return NodeFilter.FILTER_ACCEPT;
            }
          } else if (target.id === 'chatLastMessage') {
            // Elementos com texto mas não muito longo (preview)
            const text = node.textContent?.trim() || '';
            if (text.length > 5 && text.length < 100 && node.tagName === 'SPAN' &&
                this.isInCorrectContext(node, target)) {
              return NodeFilter.FILTER_ACCEPT;
            }
          } else if (target.id === 'messageStatus') {
            if (node.getAttribute('data-icon')?.includes('check') && this.isInCorrectContext(node, target)) {
              return NodeFilter.FILTER_ACCEPT;
            }
          }

          return NodeFilter.FILTER_SKIP;
        },
      }
    );

    let node: Node | null = walker.nextNode();
    while (node) {
      if (node instanceof HTMLElement) {
        candidates.push(node);
      }
      node = walker.nextNode();
    }

    const limited = candidates.slice(0, 10); // Limitar resultados
    return MettriElementFilter.filterMettriElements(limited);
  }

  /**
   * Camada 5: Busca por características visuais (posição, tamanho, cor).
   */
  private findByVisualCues(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];

    if (target.id === 'chatUnreadBadge') {
      // Elementos pequenos com números no canto direito de chat items
      const chatItems = document.querySelectorAll('[data-testid="cell-frame-container"]');
      chatItems.forEach(item => {
        const rect = item.getBoundingClientRect();
        const allChildren = item.querySelectorAll('*');
        allChildren.forEach(child => {
          if (child instanceof HTMLElement) {
            const childRect = child.getBoundingClientRect();
            const isSmall = childRect.width < 30 && childRect.height < 30;
            const isInRightArea = childRect.right > rect.right - 50;
            const text = child.textContent?.trim() || '';
            const isNumeric = /^\d+$/.test(text);
            
            if (isSmall && isInRightArea && isNumeric && this.isInCorrectContext(child, target)) {
              candidates.push(child);
            }
          }
        });
      });
    } else if (target.id === 'messageStatus') {
      // Elementos pequenos no canto inferior direito de mensagens enviadas
      const messageContainers = document.querySelectorAll('[data-testid="msg-container"]');
      messageContainers.forEach(container => {
        if (container instanceof HTMLElement) {
          const rect = container.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const isOutgoing = rect.left > viewportWidth / 2;
          
          if (isOutgoing) {
            const allChildren = container.querySelectorAll('*');
            allChildren.forEach(child => {
              if (child instanceof HTMLElement) {
                const childRect = child.getBoundingClientRect();
                const isSmall = childRect.width < 20 && childRect.height < 20;
                const isInBottomRight = childRect.bottom > rect.bottom - 10 && 
                                       childRect.right > rect.right - 30;
                
                if (isSmall && isInBottomRight && this.isInCorrectContext(child, target)) {
                  candidates.push(child);
                }
              }
            });
          }
        }
      });
    } else if (target.id === 'scrollToTop') {
      // Elementos fixos ou próximos ao topo
      const scrollContainer = document.querySelector('[data-testid="conversation-panel-messages"]') || 
                              document.querySelector('[role="log"]');
      if (scrollContainer instanceof HTMLElement) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const allChildren = scrollContainer.querySelectorAll('*');
        allChildren.forEach(child => {
          if (child instanceof HTMLElement) {
            const childRect = child.getBoundingClientRect();
            const isNearTop = childRect.top <= containerRect.top + 100;
            const isVisible = childRect.width > 0 && childRect.height > 0;
            
            if (isNearTop && isVisible) {
              candidates.push(child);
            }
          }
        });
      }
    }

    return MettriElementFilter.filterMettriElements(candidates);
  }

  /**
   * Camada 7: Busca baseada em recursos de acessibilidade.
   * 
   * Usa os mesmos recursos que leitores de tela e navegação por teclado:
   * - ARIA attributes (aria-label, role, aria-live)
   * - Navegação por teclado (elementos focáveis)
   * - Landmarks semânticos (main, navigation, region)
   * - Live regions para mensagens dinâmicas
   * 
   * @param target Target do seletor
   * @returns Array de elementos encontrados via acessibilidade
   */
  private findByAccessibility(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];
    
    // Estratégia 1: Buscar por ARIA attributes sistematicamente
    candidates.push(...this.findByARIA(target));
    
    // Estratégia 2: Buscar elementos focáveis (navegação por teclado)
    candidates.push(...this.findByKeyboardNavigation(target));
    
    // Estratégia 3: Buscar por landmarks semânticos
    candidates.push(...this.findByLandmarks(target));
    
    // Estratégia 4: Buscar live regions (para mensagens)
    candidates.push(...this.findByLiveRegions(target));
    
    return MettriElementFilter.filterMettriElements(candidates);
  }

  /**
   * Busca sistemática por ARIA attributes.
   * 
   * @param target Target do seletor
   * @returns Array de elementos encontrados via ARIA
   */
  private findByARIA(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];
    const contextRoot = this.getContextRoot(target);
    
    // Buscar por role específico baseado na categoria
    const roleMap: Record<SelectorCategory, string[]> = {
      navigation: ['listbox', 'list', 'navigation'],
      message: ['log', 'application', 'article'],
      input: ['textbox', 'button'],
      metadata: ['status', 'timer'],
      ui: ['banner', 'region', 'complementary'],
    };
    
    const roles = roleMap[target.category] || [];
    for (const role of roles) {
      const searchRoot = contextRoot || document.body;
      const elements = searchRoot.querySelectorAll(`[role="${role}"]`);
      elements.forEach(el => {
        if (el instanceof HTMLElement && this.isInCorrectContext(el, target)) {
          candidates.push(el);
        }
      });
    }
    
    // Buscar por aria-label que contenha palavras-chave específicas do target
    const ariaLabelKeywords = this.getAriaLabelKeywords(target);
    for (const keyword of ariaLabelKeywords) {
      const searchRoot = contextRoot || document.body;
      const allElements = searchRoot.querySelectorAll('[aria-label]');
      allElements.forEach(el => {
        if (el instanceof HTMLElement) {
          const ariaLabel = el.getAttribute('aria-label') || '';
          if (ariaLabel.toLowerCase().includes(keyword.toLowerCase())) {
            // Validar contexto antes de adicionar
            if (this.isInCorrectContext(el, target)) {
              candidates.push(el);
            }
          }
        }
      });
    }
    
    return candidates;
  }

  /**
   * Busca elementos focáveis (navegação por teclado).
   * 
   * @param target Target do seletor
   * @returns Array de elementos focáveis encontrados
   */
  private findByKeyboardNavigation(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];
    
    // Elementos nativamente focáveis
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
      'select:not([disabled])',
      'textarea:not([disabled])',
    ];
    
    // Buscar no contexto apropriado
    let root: HTMLElement | null = null;
    if (target.category === 'navigation') {
      root = document.querySelector('#pane-side') as HTMLElement;
    } else if (target.category === 'input') {
      root = document.querySelector('footer') as HTMLElement;
    } else if (target.category === 'message' || target.category === 'ui') {
      root = document.querySelector('#main') as HTMLElement;
    }
    
    const searchRoot = root || document.body;
    
    for (const selector of focusableSelectors) {
      try {
        const elements = searchRoot.querySelectorAll(selector);
        elements.forEach(el => {
          if (el instanceof HTMLElement && this.isElementFocusable(el) && 
              this.isInCorrectContext(el, target)) {
            candidates.push(el);
          }
        });
      } catch (error) {
        // Seletor inválido, pular
        console.warn(`Mettri: Seletor inválido em findByKeyboardNavigation: ${selector}`, error);
      }
    }
    
    return candidates;
  }

  /**
   * Busca por landmarks semânticos.
   * 
   * @param target Target do seletor
   * @returns Array de elementos encontrados via landmarks
   */
  private findByLandmarks(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];
    const contextRoot = this.getContextRoot(target);
    
    const landmarkMap: Record<SelectorCategory, string[]> = {
      navigation: ['nav', '[role="navigation"]'],
      message: ['main', '[role="main"]', '[role="application"]'],
      input: ['footer', '[role="contentinfo"]'],
      metadata: ['[role="status"]', '[role="timer"]'],
      ui: ['header', '[role="banner"]', '[role="region"]'],
    };
    
    const landmarks = landmarkMap[target.category] || [];
    for (const landmark of landmarks) {
      try {
        const searchRoot = contextRoot || document.body;
        const elements = searchRoot.querySelectorAll(landmark);
        elements.forEach(el => {
          if (el instanceof HTMLElement && this.isInCorrectContext(el, target)) {
            candidates.push(el);
          }
        });
      } catch (error) {
        // Seletor inválido, pular
        console.warn(`Mettri: Seletor inválido em findByLandmarks: ${landmark}`, error);
      }
    }
    
    return candidates;
  }

  /**
   * Busca live regions (containers de mensagens dinâmicas).
   * 
   * @param target Target do seletor
   * @returns Array de elementos encontrados via live regions
   */
  private findByLiveRegions(target: SelectorTarget): HTMLElement[] {
    const candidates: HTMLElement[] = [];
    const contextRoot = this.getContextRoot(target);
    
    // Live regions são usadas para mensagens dinâmicas
    if (target.category === 'message') {
      const searchRoot = contextRoot || document.body;
      const liveRegions = searchRoot.querySelectorAll('[aria-live]');
      liveRegions.forEach(region => {
        if (region instanceof HTMLElement && this.isInCorrectContext(region, target)) {
          // Live region pode ser o container de mensagens
          candidates.push(region);
          
          // Buscar mensagens dentro da live region
          const messages = region.querySelectorAll('[role="article"], [role="listitem"]');
          messages.forEach(msg => {
            if (msg instanceof HTMLElement && this.isInCorrectContext(msg, target)) {
              candidates.push(msg);
            }
          });
        }
      });
    }
    
    return candidates;
  }

  /**
   * Obtém o contexto raiz correto para buscar elementos baseado no target.
   * 
   * @param target Target do seletor
   * @returns Elemento raiz do contexto ou null
   */
  private getContextRoot(target: SelectorTarget): HTMLElement | null {
    // Casos específicos por ID
    if (target.id === 'conversationPanel' || target.id === 'messageContainer' || 
        target.id === 'messageIn' || target.id === 'messageOut' || 
        target.id === 'messageText' || target.id === 'messageTimestamp' ||
        target.id === 'messageStatus' || target.id === 'scrollContainer') {
      // Elementos de mensagem devem estar no painel principal (#main), não na sidebar
      return document.querySelector('#main') as HTMLElement;
    }
    
    if (target.id === 'chatHeader' || target.id === 'chatHeaderName' || 
        target.id === 'chatHeaderInfo') {
      // Cabeçalho deve estar no #main, não na sidebar
      return document.querySelector('#main') as HTMLElement;
    }
    
    if (target.id === 'searchBox') {
      // Caixa de pesquisa deve estar na sidebar
      return document.querySelector('#pane-side') as HTMLElement;
    }
    
    if (target.id === 'composeBox' || target.id === 'sendButton' || 
        target.id === 'typingIndicator') {
      // Inputs devem estar no footer
      return document.querySelector('footer') as HTMLElement;
    }
    
    if (target.id === 'chatList' || target.id === 'chatListItem' || 
        target.id === 'chatName' || target.id === 'chatUnreadBadge' || 
        target.id === 'chatLastMessage') {
      // Navegação deve estar na sidebar
      return document.querySelector('#pane-side') as HTMLElement;
    }
    
    // Fallback baseado na categoria
    if (target.category === 'navigation') {
      return document.querySelector('#pane-side') as HTMLElement;
    } else if (target.category === 'input') {
      return document.querySelector('footer') as HTMLElement;
    } else if (target.category === 'message' || target.category === 'ui' || target.category === 'metadata') {
      return document.querySelector('#main') as HTMLElement;
    }
    
    return null;
  }

  /**
   * Valida se um elemento está no contexto correto baseado no target.
   * 
   * @param element Elemento a validar
   * @param target Target do seletor
   * @returns true se elemento está no contexto correto
   */
  private isInCorrectContext(element: HTMLElement, target: SelectorTarget): boolean {
    const contextRoot = this.getContextRoot(target);
    const tagName = element.tagName.toLowerCase();
    const ariaLabel = element.getAttribute('aria-label') || '';
    const ariaLabelLower = ariaLabel.toLowerCase();
    
    // Se não há contexto específico, aceitar
    if (!contextRoot) {
      return true;
    }
    
    // Verificar se elemento está dentro do contexto raiz
    if (!contextRoot.contains(element)) {
      return false;
    }
    
    // Validações específicas por ID - elementos de mensagem e painel principal
    if (target.id === 'conversationPanel' || target.id === 'messageContainer' || 
        target.id === 'messageIn' || target.id === 'messageOut' || 
        target.id === 'messageText' || target.id === 'messageTimestamp') {
      // conversationPanel e elementos de mensagem NÃO devem estar na sidebar
      const sidebar = document.querySelector('#pane-side');
      if (sidebar && sidebar.contains(element)) {
        return false;
      }
      // NÃO devem ser botões
      if (tagName === 'button') {
        return false;
      }
      // Deve estar no #main
      const main = document.querySelector('#main');
      if (!main || !main.contains(element)) {
        return false;
      }

      // Regras específicas por tipo de target
      if (target.id === 'conversationPanel') {
        // Preferir containers conhecidos de mensagens
        if (
          !element.matches('[data-testid="conversation-panel-messages"]') &&
          !element.matches('[role="log"]') &&
          !element.matches('[role="application"]') &&
          !element.closest('[data-testid="conversation-panel-messages"]')
        ) {
          return false;
        }
        return true;
      }

      if (target.id === 'messageContainer') {
        // Deve ser (ou conter) um container de mensagem conhecido
        const container = element.closest('[data-testid="msg-container"], [data-testid="conversation-turn"], [role="row"]');
        return container !== null;
      }

      if (target.id === 'messageIn' || target.id === 'messageOut') {
        // Trabalhar sempre com o container da mensagem
        const container = (element.closest('[data-testid="msg-container"]') || element) as HTMLElement;
        const rect = container.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const isLeft = rect.left < viewportWidth / 2;

        if (target.id === 'messageIn') {
          return isLeft;
        }
        // messageOut
        return !isLeft;
      }

      if (target.id === 'messageText') {
        const container = element.closest('[data-testid="msg-container"]');
        const text = element.textContent?.trim() || '';
        if (!container || !text) {
          return false;
        }
        // Evitar timestamps sendo confundidos com texto
        if (/^\d{1,2}:\d{2}$/.test(text)) {
          return false;
        }
        return true;
      }

      if (target.id === 'messageTimestamp') {
        const text = element.textContent?.trim() || '';
        if (!text || !/^\d{1,2}:\d{2}$/.test(text)) {
          return false;
        }
        const container = element.closest('[data-testid="msg-container"]');
        return container !== null;
      }

      return true;
    }
    
    if (target.id === 'chatHeader' || target.id === 'chatHeaderName') {
      // Cabeçalho NÃO deve estar na sidebar
      const sidebar = document.querySelector('#pane-side');
      if (sidebar && sidebar.contains(element)) {
        return false;
      }
      // NÃO deve ser composeBox (que tem aria-label "Digitar na conversa...")
      if (ariaLabelLower.includes('digitar na conversa')) {
        return false;
      }
      // NÃO deve ser barra de pesquisa
      if (ariaLabelLower.includes('pesquisar') || ariaLabelLower.includes('search')) {
        return false;
      }
      // Deve estar no #main
      const main = document.querySelector('#main');
      return main ? main.contains(element) : false;
    }
    
    if (target.id === 'scrollContainer') {
      // scrollContainer NÃO deve ser barra de pesquisa
      if (ariaLabelLower.includes('pesquisar') || ariaLabelLower.includes('search')) {
        return false;
      }
      // NÃO deve ser composeBox
      if (ariaLabelLower.includes('digitar na conversa')) {
        return false;
      }
      // Deve estar no #main
      const main = document.querySelector('#main');
      return main ? main.contains(element) : false;
    }
    
    if (target.id === 'composeBox') {
      // composeBox deve estar no footer e ser contenteditable
      const footer = document.querySelector('footer');
      if (!footer || !footer.contains(element)) {
        return false;
      }
      return element.hasAttribute('contenteditable') && 
             element.getAttribute('contenteditable') === 'true';
    }
    
    if (target.id === 'sendButton') {
      // sendButton deve estar no footer e ser um botão
      const footer = document.querySelector('footer');
      if (!footer || !footer.contains(element)) {
        return false;
      }
      const role = element.getAttribute('role');
      if (tagName !== 'button' && role !== 'button') {
        return false;
      }
      // NÃO deve ser botão de anexar
      if (ariaLabelLower.includes('anexar') || 
          ariaLabelLower.includes('attach') ||
          ariaLabelLower.includes('emoticon') ||
          ariaLabelLower.includes('emoji')) {
        return false;
      }
      // Deve conter palavras-chave de "enviar"
      const sendKeywords = ['enviar', 'send'];
      const hasSendKeyword = sendKeywords.some(keyword => 
        ariaLabelLower.includes(keyword)
      );
      return hasSendKeyword;
    }
    
    return true;
  }

  /**
   * Obtém palavras-chave específicas para busca por aria-label baseado no target.
   * 
   * @param target Target do seletor
   * @returns Array de palavras-chave para aria-label
   */
  private getAriaLabelKeywords(target: SelectorTarget): string[] {
    // Elementos que NÃO devem usar aria-label (muito genérico ou não aplicável)
    const noAriaLabel: string[] = [
      'conversationPanel',
      'chatHeader',
      'chatHeaderName',
      'scrollContainer',
      'messageContainer',
      'messageIn',
      'messageOut',
      'messageText',
      'messageTimestamp',
      'messageStatus',
    ];
    
    if (noAriaLabel.includes(target.id)) {
      return [];
    }
    
    // Mapeamento específico por ID para maior precisão
    const specificKeywords: Record<string, string[]> = {
      composeBox: ['digitar na conversa', 'type a message', 'type message'],
      sendButton: ['enviar', 'send'],
      chatHeaderInfo: ['info', 'informação', 'information'],
      typingIndicator: ['digitando', 'typing', 'escrevendo', 'writing'],
    };
    
    if (specificKeywords[target.id]) {
      return specificKeywords[target.id];
    }
    
    // Fallback: extrair palavras-chave da descrição
    return this.extractKeywords(target.description);
  }

  /**
   * Extrai palavras-chave relevantes de uma descrição.
   * 
   * @param description Descrição do target
   * @returns Array de palavras-chave
   */
  private extractKeywords(description: string): string[] {
    // Extrair palavras-chave relevantes da descrição
    const stopWords = ['de', 'da', 'do', 'em', 'na', 'no', 'para', 'com', 'o', 'a', 'os', 'as'];
    const words = description.toLowerCase().split(/\s+/);
    return words.filter(w => w.length > 3 && !stopWords.includes(w));
  }

  /**
   * Verifica se um elemento pode receber foco.
   * 
   * @param element Elemento a verificar
   * @returns true se elemento pode receber foco
   */
  private isElementFocusable(element: HTMLElement): boolean {
    // Verificar se elemento pode receber foco
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
    
    const tagName = element.tagName.toLowerCase();
    const tabIndex = element.tabIndex;
    
    // Elementos nativamente focáveis
    if (['button', 'input', 'a', 'select', 'textarea'].includes(tagName)) {
      return !element.hasAttribute('disabled');
    }
    
    // Elementos com tabindex >= 0
    if (tabIndex >= 0) {
      return true;
    }
    
    // Contenteditable
    if (element.hasAttribute('contenteditable') && element.getAttribute('contenteditable') === 'true') {
      return true;
    }
    
    return false;
  }

  /**
   * Camada 6: Busca por visão computacional.
   * 
   * @param target Target do seletor
   * @returns Array de elementos encontrados visualmente
   */
  private async findByComputerVision(target: SelectorTarget): Promise<HTMLElement[]> {
    try {
      const visualResult = await this.visualScanner.scanVisual(target);
      
      if (visualResult.validated && visualResult.elements.length > 0) {
        return MettriElementFilter.filterMettriElements(visualResult.elements);
      }
      
      return [];
    } catch (error) {
      console.warn(`Mettri: Erro na detecção visual para ${target.id}:`, error);
      return [];
    }
  }

  /**
   * Varre um seletor testando cada camada separadamente.
   * 
   * @param target Seletor a varrer
   * @param config Configuração de varredura
   * @returns Array de resultados por camada
   */
  async scanSelectorByLayer(
    target: SelectorTarget,
    config: ScanConfig
  ): Promise<import('../types/selector-scanner').LayerScanResult[]> {
    const layerResults: import('../types/selector-scanner').LayerScanResult[] = [];
    
    const layerDefinitions = [
      { number: 1, name: 'Seletores Específicos', method: () => this.findBySpecificSelectors(target) },
      { number: 2, name: 'Padrões Estruturais', method: () => this.findByPattern(target) },
      { number: 3, name: 'Busca Semântica', method: () => this.findBySemantic(target) },
      { number: 4, name: 'Hierarquia (TreeWalker)', method: () => this.findByHierarchy(target) },
      { number: 5, name: 'Características Visuais', method: () => this.findByVisualCues(target) },
      { number: 7, name: 'Acessibilidade (ARIA)', method: () => this.findByAccessibility(target) },
    ];

    // Testar camadas 1-5 e 7 (síncronas)
    for (const layer of layerDefinitions) {
      const startTime = Date.now();
      const errors: string[] = [];
      let elementsFound = 0;
      let candidatesGenerated = 0;
      let bestSelector: string | null = null;
      let precision = 0;

      try {
        const candidateElements = layer.method();
        elementsFound = candidateElements.length;

        if (candidateElements.length > 0) {
          // Gerar seletores para os primeiros 5 elementos
          const elementsToProcess = candidateElements.slice(0, 5);
          const allCandidates: string[] = [];

          for (const element of elementsToProcess) {
            const candidates = this.generator.generateCandidates(element);
            allCandidates.push(...candidates);
          }

          const uniqueCandidates = Array.from(new Set(allCandidates)).slice(0, config.maxCandidatesPerSelector);
          candidatesGenerated = uniqueCandidates.length;

          // Validar cada candidato
          for (const candidate of uniqueCandidates) {
            try {
              const isValid = await this.validateCandidate(candidate, target, candidateElements[0]);
              if (isValid && !bestSelector) {
                bestSelector = candidate;
                break;
              }
            } catch (error) {
              errors.push(`Erro ao validar "${candidate}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
            }
          }

          // Calcular precisão se temos seletor válido
          if (bestSelector) {
            const matchedElements = document.querySelectorAll(bestSelector);
            const htmlMatched = Array.from(matchedElements).filter((el): el is HTMLElement => el instanceof HTMLElement);
            const filteredMatched = MettriElementFilter.filterMettriElements(htmlMatched);
            
            if (filteredMatched.length > 0) {
              const sampleSize = Math.min(20, filteredMatched.length);
              let validCount = 0;
              
              for (let i = 0; i < sampleSize; i++) {
                const element = filteredMatched[i];
                if (this.isInCorrectContext(element, target)) {
                  validCount++;
                }
              }
              
              precision = (validCount / sampleSize) * 100;
            }
          }
        }
      } catch (error) {
        errors.push(`Erro na camada ${layer.number}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }

      layerResults.push({
        layer: layer.number,
        layerName: layer.name,
        elementsFound,
        candidatesGenerated,
        bestSelector,
        precision,
        executionTime: Date.now() - startTime,
        errors,
      });
    }

    // Testar Camada 6 (visão computacional) - assíncrona
    if (target.priority === 'P0' || target.priority === 'P1') {
      const startTime = Date.now();
      const errors: string[] = [];
      let elementsFound = 0;
      let candidatesGenerated = 0;
      let bestSelector: string | null = null;
      let precision = 0;

      try {
        const candidateElements = await this.findByComputerVision(target);
        elementsFound = candidateElements.length;

        if (candidateElements.length > 0) {
          const elementsToProcess = candidateElements.slice(0, 5);
          const allCandidates: string[] = [];

          for (const element of elementsToProcess) {
            const candidates = this.generator.generateCandidates(element);
            allCandidates.push(...candidates);
          }

          const uniqueCandidates = Array.from(new Set(allCandidates)).slice(0, config.maxCandidatesPerSelector);
          candidatesGenerated = uniqueCandidates.length;

          for (const candidate of uniqueCandidates) {
            try {
              const isValid = await this.validateCandidate(candidate, target, candidateElements[0]);
              if (isValid && !bestSelector) {
                bestSelector = candidate;
                break;
              }
            } catch (error) {
              errors.push(`Erro ao validar "${candidate}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
            }
          }

          if (bestSelector) {
            const matchedElements = document.querySelectorAll(bestSelector);
            const htmlMatched = Array.from(matchedElements).filter((el): el is HTMLElement => el instanceof HTMLElement);
            const filteredMatched = MettriElementFilter.filterMettriElements(htmlMatched);
            
            if (filteredMatched.length > 0) {
              const sampleSize = Math.min(20, filteredMatched.length);
              let validCount = 0;
              
              for (let i = 0; i < sampleSize; i++) {
                const element = filteredMatched[i];
                if (this.isInCorrectContext(element, target)) {
                  validCount++;
                }
              }
              
              precision = (validCount / sampleSize) * 100;
            }
          }
        }
      } catch (error) {
        errors.push(`Erro na camada 6: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }

      layerResults.push({
        layer: 6,
        layerName: 'Visão Computacional',
        elementsFound,
        candidatesGenerated,
        bestSelector,
        precision,
        executionTime: Date.now() - startTime,
        errors,
      });
    }

    // Ordenar por número da camada
    layerResults.sort((a, b) => a.layer - b.layer);

    return layerResults;
  }

  /**
   * Testa funcionalidade completa com um número de telefone específico.
   * 
   * @param phoneNumber Número de telefone para testar (ex: "7591" ou "34999277591")
   * @returns Resultado do teste
   */
  async testWithPhoneNumber(phoneNumber: string): Promise<import('../types/selector-scanner').PhoneNumberTestResult> {
    const startTime = Date.now();
    const steps: Array<{
      step: string;
      selectorId: string;
      success: boolean;
      error?: string;
      elementFound?: boolean;
    }> = [];

    // Normalizar número (remover espaços, traços, etc)
    const normalizedPhone = phoneNumber.replace(/\D/g, '');

    try {
      // Passo 1: Encontrar e usar searchBox
      steps.push({
        step: 'Pesquisar contato',
        selectorId: 'searchBox',
        success: false,
      });

      const searchBoxSelector = await this.selectorManager.getSelector('searchBox');
      if (!searchBoxSelector) {
        steps[0].error = 'Seletor searchBox não encontrado';
        return {
          phoneNumber: normalizedPhone,
          steps,
          overallSuccess: false,
          duration: Date.now() - startTime,
        };
      }

      const searchBox = document.querySelector(searchBoxSelector) as HTMLInputElement;
      if (!searchBox) {
        steps[0].error = 'Elemento searchBox não encontrado no DOM';
        return {
          phoneNumber: normalizedPhone,
          steps,
          overallSuccess: false,
          duration: Date.now() - startTime,
        };
      }

      // Limpar e digitar número
      searchBox.value = '';
      searchBox.focus();
      searchBox.value = normalizedPhone;
      searchBox.dispatchEvent(new Event('input', { bubbles: true }));
      searchBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      // Aguardar resultados aparecerem
      await new Promise(resolve => setTimeout(resolve, 1000));

      steps[0].success = true;
      steps[0].elementFound = true;

      // Passo 2: Clicar no primeiro resultado (chatListItem)
      steps.push({
        step: 'Abrir conversa',
        selectorId: 'chatListItem',
        success: false,
      });

      const chatListItemSelector = await this.selectorManager.getSelector('chatListItem');
      if (!chatListItemSelector) {
        steps[1].error = 'Seletor chatListItem não encontrado';
        return {
          phoneNumber: normalizedPhone,
          steps,
          overallSuccess: false,
          duration: Date.now() - startTime,
        };
      }

      const chatItems = document.querySelectorAll(chatListItemSelector);
      if (chatItems.length === 0) {
        steps[1].error = 'Nenhum item de conversa encontrado';
        return {
          phoneNumber: normalizedPhone,
          steps,
          overallSuccess: false,
          duration: Date.now() - startTime,
        };
      }

      // Clicar no primeiro item
      const firstItem = chatItems[0] as HTMLElement;
      firstItem.click();
      await new Promise(resolve => setTimeout(resolve, 1500));

      steps[1].success = true;
      steps[1].elementFound = true;

      // Passo 3: Validar que chatHeaderName mostra o número correto
      steps.push({
        step: 'Validar cabeçalho da conversa',
        selectorId: 'chatHeaderName',
        success: false,
      });

      const chatHeaderNameSelector = await this.selectorManager.getSelector('chatHeaderName');
      if (!chatHeaderNameSelector) {
        steps[2].error = 'Seletor chatHeaderName não encontrado';
        return {
          phoneNumber: normalizedPhone,
          steps,
          overallSuccess: false,
          duration: Date.now() - startTime,
        };
      }

      const headerName = document.querySelector(chatHeaderNameSelector);
      if (!headerName) {
        steps[2].error = 'Elemento chatHeaderName não encontrado';
        return {
          phoneNumber: normalizedPhone,
          steps,
          overallSuccess: false,
          duration: Date.now() - startTime,
        };
      }

      const headerText = headerName.textContent || '';
      const containsPhone = headerText.includes(normalizedPhone) || 
                           headerText.includes(phoneNumber) ||
                           normalizedPhone.includes(headerText.replace(/\D/g, ''));

      steps[2].success = containsPhone;
      steps[2].elementFound = true;
      if (!containsPhone) {
        steps[2].error = `Cabeçalho não contém número esperado. Encontrado: "${headerText}"`;
      }

      // Passo 4: Ler mensagens recebidas (messageIn)
      steps.push({
        step: 'Ler mensagens recebidas',
        selectorId: 'messageIn',
        success: false,
      });

      const messageInSelector = await this.selectorManager.getSelector('messageIn');
      if (!messageInSelector) {
        steps[3].error = 'Seletor messageIn não encontrado';
      } else {
        const messagesIn = document.querySelectorAll(messageInSelector);
        steps[3].success = messagesIn.length > 0;
        steps[3].elementFound = messagesIn.length > 0;
        if (messagesIn.length === 0) {
          steps[3].error = 'Nenhuma mensagem recebida encontrada';
        }
      }

      // Passo 5: Ler mensagens enviadas (messageOut)
      steps.push({
        step: 'Ler mensagens enviadas',
        selectorId: 'messageOut',
        success: false,
      });

      const messageOutSelector = await this.selectorManager.getSelector('messageOut');
      if (!messageOutSelector) {
        steps[4].error = 'Seletor messageOut não encontrado';
      } else {
        const messagesOut = document.querySelectorAll(messageOutSelector);
        steps[4].success = messagesOut.length > 0;
        steps[4].elementFound = messagesOut.length > 0;
        if (messagesOut.length === 0) {
          steps[4].error = 'Nenhuma mensagem enviada encontrada';
        }
      }

      // Passo 6: Testar envio de mensagem (composeBox + sendButton)
      steps.push({
        step: 'Enviar mensagem de teste',
        selectorId: 'composeBox+sendButton',
        success: false,
      });

      const composeBoxSelector = await this.selectorManager.getSelector('composeBox');
      const sendButtonSelector = await this.selectorManager.getSelector('sendButton');

      if (!composeBoxSelector || !sendButtonSelector) {
        steps[5].error = `Seletores não encontrados: composeBox=${!!composeBoxSelector}, sendButton=${!!sendButtonSelector}`;
      } else {
        const composeBox = document.querySelector(composeBoxSelector) as HTMLElement;
        const sendButton = document.querySelector(sendButtonSelector) as HTMLElement;

        if (!composeBox || !sendButton) {
          steps[5].error = `Elementos não encontrados: composeBox=${!!composeBox}, sendButton=${!!sendButton}`;
        } else {
          // Testar digitação (não enviar de verdade para não spammar)
          composeBox.focus();
          composeBox.dispatchEvent(new Event('focus', { bubbles: true }));
          
          // Verificar se composeBox está funcionando
          const canType = composeBox.hasAttribute('contenteditable') || 
                         (composeBox as HTMLInputElement).tagName === 'INPUT' ||
                         (composeBox as HTMLTextAreaElement).tagName === 'TEXTAREA';
          
          steps[5].success = canType && sendButton !== null;
          steps[5].elementFound = composeBox !== null && sendButton !== null;
          
          if (!canType) {
            steps[5].error = 'composeBox não é editável';
          }
        }
      }

      const overallSuccess = steps.every(s => s.success);

      return {
        phoneNumber: normalizedPhone,
        steps,
        overallSuccess,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        phoneNumber: normalizedPhone,
        steps: [
          ...steps,
          {
            step: 'Erro geral',
            selectorId: 'unknown',
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          },
        ],
        overallSuccess: false,
        duration: Date.now() - startTime,
      };
    }
  }
}
