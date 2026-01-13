import type { SelectorTarget } from '../types/selector-scanner';

/**
 * Lista completa de seletores a serem mapeados.
 * 
 * Total: 19 seletores
 * - 8 P0 (críticos)
 * - 6 P1 (importantes)
 * - 5 P2 (opcionais)
 */
export const SELECTOR_TARGETS: SelectorTarget[] = [
  // P0 - Críticos
  {
    id: 'chatList',
    description: 'Lista de conversas (sidebar esquerda)',
    priority: 'P0',
    category: 'navigation',
    required: true,
    hints: {
      location: 'sidebar esquerda',
      characteristics: ['data-testid=chat-list', 'role=listbox'],
    },
  },
  {
    id: 'chatListItem',
    description: 'Item individual na lista de conversas',
    priority: 'P0',
    category: 'navigation',
    required: true,
    hints: {
      location: 'dentro da lista de conversas',
      characteristics: ['data-testid=cell-frame-container'],
    },
  },
  {
    id: 'conversationPanel',
    description: 'Painel principal da conversa',
    priority: 'P0',
    category: 'message',
    required: true,
    hints: {
      location: 'área central onde mensagens aparecem',
      characteristics: ['data-testid=conversation-panel-messages', 'role=application', 'role=log'],
      visualCues: 'container scrollável no centro da tela com mensagens',
    },
  },
  {
    id: 'messageContainer',
    description: 'Container de mensagem individual',
    priority: 'P0',
    category: 'message',
    required: true,
    hints: {
      characteristics: ['data-testid=msg-container'],
    },
  },
  {
    id: 'messageIn',
    description: 'Mensagem recebida',
    priority: 'P0',
    category: 'message',
    required: true,
    hints: {
      visualCues: 'lado esquerdo, fundo branco/cinza',
      characteristics: ['class*="message-in"'],
    },
  },
  {
    id: 'messageOut',
    description: 'Mensagem enviada',
    priority: 'P0',
    category: 'message',
    required: true,
    hints: {
      visualCues: 'lado direito, fundo verde',
      characteristics: ['class*="message-out"'],
    },
  },
  {
    id: 'messageText',
    description: 'Texto da mensagem',
    priority: 'P0',
    category: 'message',
    required: true,
    hints: {
      characteristics: ['data-testid=msg-text'],
    },
  },
  {
    id: 'searchBox',
    description: 'Caixa de pesquisa de contatos',
    priority: 'P0',
    category: 'input',
    required: true,
    hints: {
      location: 'sidebar esquerda, topo da lista de conversas',
      characteristics: ['data-testid=chat-list-search', 'input[placeholder*="Pesquisar"]', 'input[aria-label*="Pesquisar"]'],
    },
  },
  {
    id: 'composeBox',
    description: 'Campo de digitação',
    priority: 'P0',
    category: 'input',
    required: true,
    hints: {
      location: 'footer, campo de texto',
      characteristics: ['contenteditable=true', 'data-testid=conversation-compose-box-input'],
    },
  },
  {
    id: 'sendButton',
    description: 'Botão enviar',
    priority: 'P0',
    category: 'input',
    required: true,
    hints: {
      location: 'próximo ao campo de digitação',
      characteristics: ['data-testid=send', 'aria-label*="Enviar"'],
    },
  },
  {
    id: 'chatHeader',
    description: 'Cabeçalho da conversa',
    priority: 'P0',
    category: 'ui',
    required: true,
    hints: {
      location: 'topo da conversa',
      characteristics: ['data-testid=conversation-info-header'],
    },
  },
  {
    id: 'chatHeaderName',
    description: 'Nome no cabeçalho',
    priority: 'P0',
    category: 'ui',
    required: true,
    hints: {
      location: 'dentro do cabeçalho',
      characteristics: ['data-testid=conversation-info-header-chat-title'],
    },
  },
  {
    id: 'scrollContainer',
    description: 'Container scrollável de mensagens',
    priority: 'P0',
    category: 'ui',
    required: true,
    hints: {
      location: 'dentro do painel de conversa',
      characteristics: ['role=log', 'overflow'],
    },
  },
  {
    id: 'chatName',
    description: 'Nome do contato na lista',
    priority: 'P0',
    category: 'navigation',
    required: true,
    hints: {
      location: 'dentro do item da lista',
      characteristics: ['data-testid=conversation-info-header-chat-title'],
    },
  },
  {
    id: 'messageTimestamp',
    description: 'Timestamp da mensagem',
    priority: 'P0',
    category: 'metadata',
    required: true,
    hints: {
      location: 'abaixo da mensagem',
      characteristics: ['data-testid=msg-meta', 'data-testid=msg-time'],
      visualCues: 'span com formato de hora (ex: "14:30") dentro de msg-container',
    },
  },
  // P1 - Importantes
  {
    id: 'chatUnreadBadge',
    description: 'Badge de não lidas',
    priority: 'P1',
    category: 'navigation',
    required: false,
    hints: {
      location: 'dentro do item da lista',
      characteristics: ['data-testid=icon-unread-count'],
      visualCues: 'elemento pequeno (width < 30px) com número',
    },
  },
  {
    id: 'chatLastMessage',
    description: 'Última mensagem na lista',
    priority: 'P1',
    category: 'navigation',
    required: false,
    hints: {
      location: 'dentro do item da lista',
      characteristics: ['data-testid=subtitle'],
      visualCues: 'segundo ou terceiro span dentro do chat item',
    },
  },
  {
    id: 'messageStatus',
    description: 'Status (enviado, entregue, lido)',
    priority: 'P1',
    category: 'metadata',
    required: false,
    hints: {
      location: 'dentro da mensagem enviada',
      characteristics: ['data-testid=msg-status', 'data-icon=check'],
      visualCues: 'elemento pequeno no canto inferior direito de mensagens enviadas',
    },
  },
  {
    id: 'scrollToTop',
    description: 'Indicador de scroll no topo',
    priority: 'P1',
    category: 'ui',
    required: false,
    hints: {
      location: 'topo do container de mensagens',
      characteristics: ['data-testid=scroll-to-top'],
      visualCues: 'botão ou indicador fixo próximo ao topo do scroll container',
    },
  },
  // P2 - Opcionais
  {
    id: 'chatHeaderInfo',
    description: 'Botão de informações',
    priority: 'P2',
    category: 'ui',
    required: false,
    hints: {
      location: 'no cabeçalho',
      characteristics: ['aria-label*="info"'],
      visualCues: 'botão dentro do header da conversa',
    },
  },
  {
    id: 'typingIndicator',
    description: 'Indicador de digitação',
    priority: 'P2',
    category: 'ui',
    required: false,
    hints: {
      location: 'no rodapé da conversa',
      characteristics: ['data-testid=typing', 'aria-label*="digitando"'],
      visualCues: 'elemento no footer que mostra "digitando..." ou similar',
    },
  },
];

/**
 * Obtém targets por prioridade.
 */
export function getTargetsByPriority(priority: 'P0' | 'P1' | 'P2'): SelectorTarget[] {
  return SELECTOR_TARGETS.filter(target => target.priority === priority);
}

/**
 * Obtém todos os targets P0 (críticos).
 */
export function getCriticalTargets(): SelectorTarget[] {
  return getTargetsByPriority('P0');
}

/**
 * Obtém apenas os seletores essenciais para o funcionamento básico do robô.
 * 
 * Total: 12 seletores essenciais
 * - searchBox (pesquisa)
 * - chatList, chatListItem, chatName, chatUnreadBadge (navegação)
 * - conversationPanel, messageContainer (containers)
 * - messageIn, messageOut, messageText, messageTimestamp (mensagens)
 * - composeBox, sendButton (envio)
 */
export function getEssentialTargets(): SelectorTarget[] {
  const essentialIds = [
    'searchBox',
    'chatList',
    'chatListItem',
    'chatName',
    'chatUnreadBadge',
    'conversationPanel',
    'messageContainer',
    'messageIn',
    'messageOut',
    'messageText',
    'messageTimestamp',
    'composeBox',
    'sendButton',
  ];
  
  return SELECTOR_TARGETS.filter(target => essentialIds.includes(target.id));
}
