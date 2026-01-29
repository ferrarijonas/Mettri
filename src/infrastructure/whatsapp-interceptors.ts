/**
 * WhatsAppInterceptors (Wrapper Simples)
 * 
 * Wrapper que acessa módulos diretamente de window.Mettri
 * (agora que content script roda em world: "MAIN", não precisa mais de bridge)
 */

declare global {
  interface Window {
    Mettri?: {
      __ready?: boolean;
      // Coleções principais
      Msg: any;
      Chat: any;
      Contact: any;
      Label: any;
      ChatCollection: any;
      PresenceCollection: any;
      GroupMetadata: any;
      ConversationMsgs: any;

      // Core
      User: any;
      Conn: any;

      // Mensagens
      MsgKey: any;
      SendDelete: any;
      addAndSendMsgToChat: any;
      sendTextMsgToChat: any;
      getEphemeralFields: any;
      canReplyMsg: any;

      // Comandos e ações
      Cmd: any;
      ChatState: any;
      Presence: any;

      // Grupos
      createGroup: any;
      getParticipants: any;

      // Contatos
      blockContact: any;
      VCard: any;
      QueryExist: any;

      // Mídia
      uploadMedia: any;
      MediaPrep: any;
      MediaObject: any;
      MediaTypes: any;
      MediaCollection: any;
      UploadUtils: any;
      DownloadManager: any;

      // Utilitários
      OpaqueData: any;
      UserConstructor: any;
      WidFactory: any;
      USyncQuery: any;
      USyncUser: any;

      // Links e busca
      genMinimalLinkPreview: any;
      findFirstWebLink: any;
      getSearchContext: any;

      // Reações e status
      sendReactionToMsg: any;
      colorIndexToHex: any;
      StatusUtils: any;
      Composing: any;
      ConversationSeen: any;
      Playing: any;
      StatusState: any;
      Classes: any;

      // Objeto N
      N: any;

      // Métodos auxiliares
      isWebpackAvailable: () => boolean;
      initialize: () => Promise<void>;
    };
  }
}

export class WhatsAppInterceptors {
  private initialized = false;

  /**
   * Inicializa e aguarda window.Mettri estar disponível
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Log removido temporariamente - foco em detecção de conta

    // Aguardar window.Mettri estar disponível E pronto (evita falso "verde")
    return new Promise((resolve) => {
      const start = Date.now();
      const checkInit = () => {
        const mettri = window.Mettri;
        const ready = !!mettri && (mettri.__ready === true || !!mettri.Chat || !!mettri.Msg);

        // Fail-safe: não travar infinito
        const timedOut = Date.now() - start > 60_000;

        if (ready || timedOut) {
          this.initialized = true;
          // Log removido temporariamente - foco em detecção de conta
          resolve();
        } else {
          setTimeout(checkInit, 100);
        }
      };
      checkInit();
    });
  }

  /**
   * Verifica se webpack está disponível
   */
  isWebpackAvailable(): boolean {
    return window.Mettri?.isWebpackAvailable() ?? false;
  }

  // Coleções principais
  get Msg(): any { return window.Mettri?.Msg; }
  get Chat(): any { return window.Mettri?.Chat; }
  get Contact(): any { return window.Mettri?.Contact; }
  get Label(): any { return window.Mettri?.Label; }
  get ChatCollection(): any { return window.Mettri?.ChatCollection; }
  get ConversationMsgs(): any { return window.Mettri?.ConversationMsgs; }
  get PresenceCollection(): any { return window.Mettri?.PresenceCollection; }
  get GroupMetadata(): any { return window.Mettri?.GroupMetadata; }

  // Core
  get User(): any { return window.Mettri?.User; }
  get Conn(): any { return window.Mettri?.Conn; }

  // Mensagens
  get MsgKey(): any { return window.Mettri?.MsgKey; }
  get SendDelete(): any { return window.Mettri?.SendDelete; }
  get addAndSendMsgToChat(): any { return window.Mettri?.addAndSendMsgToChat; }
  get sendTextMsgToChat(): any { return window.Mettri?.sendTextMsgToChat; }
  get getEphemeralFields(): any { return window.Mettri?.getEphemeralFields; }
  get canReplyMsg(): any { return window.Mettri?.canReplyMsg; }

  // Comandos e ações
  get Cmd(): any { return window.Mettri?.Cmd; }
  get ChatState(): any { return window.Mettri?.ChatState; }
  get Presence(): any { return window.Mettri?.Presence; }

  // Grupos
  get createGroup(): any { return window.Mettri?.createGroup; }
  get getParticipants(): any { return window.Mettri?.getParticipants; }

  // Contatos
  get blockContact(): any { return window.Mettri?.blockContact; }
  get VCard(): any { return window.Mettri?.VCard; }
  get QueryExist(): any { return window.Mettri?.QueryExist; }

  // Mídia
  get uploadMedia(): any { return window.Mettri?.uploadMedia; }
  get MediaPrep(): any { return window.Mettri?.MediaPrep; }
  get MediaObject(): any { return window.Mettri?.MediaObject; }
  get MediaTypes(): any { return window.Mettri?.MediaTypes; }
  get MediaCollection(): any { return window.Mettri?.MediaCollection; }
  get UploadUtils(): any { return window.Mettri?.UploadUtils; }
  get DownloadManager(): any { return window.Mettri?.DownloadManager; }

  // Utilitários
  get OpaqueData(): any { return window.Mettri?.OpaqueData; }
  get UserConstructor(): any { return window.Mettri?.UserConstructor; }
  get USyncQuery(): any { return window.Mettri?.USyncQuery; }
  get USyncUser(): any { return window.Mettri?.USyncUser; }

  // Links e busca
  get genMinimalLinkPreview(): any { return window.Mettri?.genMinimalLinkPreview; }
  get findFirstWebLink(): any { return window.Mettri?.findFirstWebLink; }
  get getSearchContext(): any { return window.Mettri?.getSearchContext; }

  // Reações e status
  get sendReactionToMsg(): any { return window.Mettri?.sendReactionToMsg; }
  get colorIndexToHex(): any { return window.Mettri?.colorIndexToHex; }
  get StatusUtils(): any { return window.Mettri?.StatusUtils; }
  get Composing(): any { return window.Mettri?.Composing; }
  get ConversationSeen(): any { return window.Mettri?.ConversationSeen; }
  get Playing(): any { return window.Mettri?.Playing; }
  get StatusState(): any { return window.Mettri?.StatusState; }
  get Classes(): any { return window.Mettri?.Classes; }

  // WidFactory (alias para compatibilidade)
  get WidFactory(): any { return window.Mettri?.WidFactory; }

  /**
   * Testa se um módulo está disponível
   */
  async testModule(id: string): Promise<'success' | 'error'> {
    try {
      const module = (this as any)[id];
      return module ? 'success' : 'error';
    } catch {
      return 'error';
    }
  }

  /**
   * Método de compatibilidade (não usado mais, mas mantido para não quebrar código)
   */
  handleResponse(_data: any): void {
    // Não faz nada - eventos agora são diretos via .on()
  }
}

export const whatsappInterceptors = new WhatsAppInterceptors();
