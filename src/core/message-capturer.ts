import type { CapturedMessage } from '../types';
import selectorsConfig from '../../config/selectors.json';

type MessageCallback = (message: CapturedMessage) => void;

export class MessageCapturer {
  private observer: MutationObserver | null = null;
  private callbacks: MessageCallback[] = [];
  private processedIds = new Set<string>();
  private isRunning = false;

  constructor() {
    // Load selectors from config
    this.loadSelectors();
  }

  private loadSelectors(): void {
    // Selectors are loaded from config/selectors.json
    console.log('Mettri: Loaded selectors version', selectorsConfig.version);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const targetNode = this.findMessageContainer();
    if (!targetNode) {
      console.warn('Mettri: Message container not found, retrying...');
      setTimeout(() => this.start(), 1000);
      return;
    }

    // Process existing messages first
    this.processExistingMessages(targetNode);

    // Start observing for new messages
    this.observer = new MutationObserver(mutations => {
      this.handleMutations(mutations);
    });

    this.observer.observe(targetNode, {
      childList: true,
      subtree: true,
    });

    console.log('Mettri: Message capturer started');
  }

  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.isRunning = false;
    console.log('Mettri: Message capturer stopped');
  }

  public onMessage(callback: MessageCallback): void {
    this.callbacks.push(callback);
  }

  private findMessageContainer(): Element | null {
    const selectors = selectorsConfig.selectors.conversationPanel.selectors;

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    return null;
  }

  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) {
            this.processMessageNode(node);
          }
        });
      }
    }
  }

  private processExistingMessages(container: Element): void {
    // Find all existing messages
    const inSelectors = selectorsConfig.selectors.messageIn.selectors;
    const outSelectors = selectorsConfig.selectors.messageOut.selectors;

    const allSelectors = [...inSelectors, ...outSelectors];

    for (const selector of allSelectors) {
      const messages = container.querySelectorAll(selector);
      messages.forEach(node => {
        if (node instanceof HTMLElement) {
          this.processMessageNode(node);
        }
      });
    }
  }

  private processMessageNode(node: HTMLElement): void {
    // Check if this is a message container
    const isMessageIn = this.matchesAnySelector(node, selectorsConfig.selectors.messageIn.selectors);
    const isMessageOut = this.matchesAnySelector(
      node,
      selectorsConfig.selectors.messageOut.selectors
    );

    if (!isMessageIn && !isMessageOut) {
      // Check children
      const inChild = this.findMatchingChild(node, selectorsConfig.selectors.messageIn.selectors);
      const outChild = this.findMatchingChild(node, selectorsConfig.selectors.messageOut.selectors);

      if (inChild) {
        this.extractMessage(inChild, false);
      }
      if (outChild) {
        this.extractMessage(outChild, true);
      }
      return;
    }

    this.extractMessage(node, isMessageOut);
  }

  private matchesAnySelector(element: HTMLElement, selectors: string[]): boolean {
    return selectors.some(selector => {
      try {
        return element.matches(selector);
      } catch {
        return false;
      }
    });
  }

  private findMatchingChild(parent: HTMLElement, selectors: string[]): HTMLElement | null {
    for (const selector of selectors) {
      try {
        const child = parent.querySelector(selector);
        if (child instanceof HTMLElement) return child;
      } catch {
        // Invalid selector, skip
      }
    }
    return null;
  }

  private extractMessage(element: HTMLElement, isOutgoing: boolean): void {
    // Generate unique ID based on element content
    const messageId = this.generateMessageId(element);

    // Skip if already processed
    if (this.processedIds.has(messageId)) return;
    this.processedIds.add(messageId);

    // Extract text
    const text = this.extractText(element);
    if (!text) return;

    // Extract sender (for groups)
    const sender = this.extractSender(element);

    // Extract timestamp
    const timestamp = this.extractTimestamp(element);

    // Get current chat info
    const chatInfo = this.getCurrentChatInfo();

    const message: CapturedMessage = {
      id: messageId,
      chatId: chatInfo.id,
      chatName: chatInfo.name,
      sender: sender || chatInfo.name,
      text,
      timestamp: timestamp || new Date(),
      isOutgoing,
      type: 'text',
    };

    // Notify all callbacks
    this.callbacks.forEach(callback => callback(message));

    // Save to storage
    this.saveMessage(message);
  }

  private extractText(element: HTMLElement): string | null {
    const selectors = selectorsConfig.selectors.messageText.selectors;

    for (const selector of selectors) {
      try {
        const textEl = element.querySelector(selector);
        if (textEl?.textContent) {
          return textEl.textContent.trim();
        }
      } catch {
        // Invalid selector, skip
      }
    }

    return null;
  }

  private extractSender(element: HTMLElement): string | null {
    const selectors = selectorsConfig.selectors.senderName.selectors;

    for (const selector of selectors) {
      try {
        const senderEl = element.querySelector(selector);
        if (senderEl) {
          const ariaLabel = senderEl.getAttribute('aria-label');
          if (ariaLabel) return ariaLabel;
          if (senderEl.textContent) return senderEl.textContent.trim();
        }
      } catch {
        // Invalid selector, skip
      }
    }

    return null;
  }

  private extractTimestamp(element: HTMLElement): Date | null {
    const selectors = selectorsConfig.selectors.messageMeta.selectors;

    for (const selector of selectors) {
      try {
        const metaEl = element.querySelector(selector);
        if (metaEl) {
          // Try to parse time from content
          const timeText = metaEl.textContent?.trim();
          if (timeText) {
            const now = new Date();
            const [hours, minutes] = timeText.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
              now.setHours(hours, minutes, 0, 0);
              return now;
            }
          }
        }
      } catch {
        // Invalid selector, skip
      }
    }

    return null;
  }

  private getCurrentChatInfo(): { id: string; name: string } {
    const nameSelectors = selectorsConfig.selectors.chatName.selectors;

    for (const selector of nameSelectors) {
      try {
        const nameEl = document.querySelector(selector);
        if (nameEl?.textContent) {
          const name = nameEl.textContent.trim();
          const id = name.toLowerCase().replace(/\s+/g, '-');
          return { id, name };
        }
      } catch {
        // Invalid selector, skip
      }
    }

    return { id: 'unknown', name: 'Unknown Chat' };
  }

  private generateMessageId(element: HTMLElement): string {
    const text = element.textContent || '';
    const hash = this.simpleHash(text + Date.now().toString());
    return `msg-${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private saveMessage(message: CapturedMessage): void {
    chrome.runtime.sendMessage({
      type: 'SAVE_MESSAGE',
      payload: message,
    });
  }
}
