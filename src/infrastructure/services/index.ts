/**
 * Serviços WhatsApp – uso compartilhado por módulos da extensão.
 * @see README.md
 */
export {
  sendMessageService,
  getLastOutgoingFromWhatsAppForChatIds,
  getLastMessageDatesFromWhatsAppStore,
  ensureChatLoaded,
  type EnsureChatLoadedResult,
} from './send-message';
