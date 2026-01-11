// Core message types
export interface CapturedMessage {
  id: string;
  chatId: string;
  chatName: string;
  sender: string;
  text: string;
  timestamp: Date;
  isOutgoing: boolean;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker';
}

// Chat types
export interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
  isGroup: boolean;
}

// Selector types
export interface SelectorDefinition {
  id: string;
  description: string;
  selectors: string[];
  lastVerified?: Date;
  status: 'working' | 'broken' | 'unknown';
}

export interface SelectorsConfig {
  version: string;
  updatedAt: string;
  selectors: Record<string, SelectorDefinition>;
}

// Panel state
export interface PanelState {
  isVisible: boolean;
  isCapturing: boolean;
  messages: CapturedMessage[];
  currentChatId: string | null;
}

// Storage types
export interface StoredSettings {
  panelEnabled: boolean;
  captureEnabled: boolean;
  theme: 'light' | 'dark' | 'auto';
}
