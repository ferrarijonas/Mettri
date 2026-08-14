/**
 * Serviços WhatsApp – uso compartilhado por módulos da extensão.
 * @see README.md
 */
export {
  sendMessageService,
  getLastOutgoingFromWhatsAppForChatIds,
  getLastMessageDatesFromWhatsAppStore,
  extractLastMessageDateFromChatModelAsync,
  ensureChatLoaded,
  type EnsureChatLoadedResult,
} from './send-message';
