import { MettriPanel } from '../ui/panel';
import { MessageCapturer } from '../core/message-capturer';

class MettriApp {
  private panel: MettriPanel | null = null;
  private capturer: MessageCapturer | null = null;
  private isInitialized = false;

  constructor() {
    this.waitForWhatsApp();
  }

  private waitForWhatsApp(): void {
    // Wait for WhatsApp to fully load
    const checkInterval = setInterval(() => {
      const app = document.querySelector('#app');
      const mainPanel = document.querySelector('[data-testid="conversation-panel-wrapper"]');

      if (app && mainPanel) {
        clearInterval(checkInterval);
        this.init();
      }
    }, 500);

    // Timeout after 30 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!this.isInitialized) {
        console.warn('Mettri: WhatsApp Web did not load in time');
      }
    }, 30000);
  }

  private init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('Mettri: Initializing...');

    // Create UI panel
    this.panel = new MettriPanel();

    // Create message capturer
    this.capturer = new MessageCapturer();

    // Connect capturer to panel
    this.capturer.onMessage(message => {
      this.panel?.addMessage(message);
    });

    // Start capturing
    this.capturer.start();
    this.panel.setCapturing(true);

    console.log('Mettri: Initialized successfully');
  }

  public destroy(): void {
    this.capturer?.stop();
    this.isInitialized = false;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MettriApp();
  });
} else {
  new MettriApp();
}
