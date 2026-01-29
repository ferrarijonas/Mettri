/**
 * UserSessionManager
 * 
 * Gerencia a sessão do usuário atual do WhatsApp.
 * Detecta o WID do usuário, obtém dados do contato (nome, foto) e persiste estado.
 * 
 * TEMPORÁRIO: Verbosidade reduzida para focar em detecção de conta
 * TODO: Restaurar logs completos após conta carregar com sucesso
 */

import { WhatsAppInterceptors } from './whatsapp-interceptors';

export interface UserSession {
  wid: string; // Ex: "5511987654321@c.us"
  name: string | null; // Nome do usuário
  phoneNumber: string | null; // Telefone formatado
  profilePicUrl: string | null; // URL da foto de perfil
}

export class UserSessionManager {
  private interceptors: WhatsAppInterceptors | null = null;
  private currentSession: UserSession | null = null;
  private static readonly STORAGE_KEY = 'mettri_current_user_wid';
  private initialized = false;

  /**
   * Inicializa o UserSessionManager e detecta o usuário atual.
   * 
   * @param interceptors Instância de WhatsAppInterceptors já inicializada
   * @returns UserSession do usuário atual ou null se não conseguir detectar
   */
  async initialize(interceptors: WhatsAppInterceptors): Promise<UserSession | null> {
    if (this.initialized) {
      return this.currentSession;
    }

    this.interceptors = interceptors;

    try {
      // Aguardar um pouco para garantir que WhatsApp está totalmente carregado
      // O painel de testes funciona, então precisamos aguardar o mesmo tempo
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Detectar WID do usuário atual
      const userWid = await this.detectUserWid();
      
      if (!userWid) {
        // Log removido temporariamente - foco em detecção de conta
        this.initialized = true;
        return null;
      }

      // Buscar dados do contato
      const session = await this.fetchUserData(userWid);
      this.currentSession = session;

      // Persistir WID em chrome.storage
      await this.saveUserWid(userWid);

      this.initialized = true;
      // Log removido temporariamente - foco em detecção de conta

      return session;
    } catch (error) {
      // Log removido temporariamente - foco em detecção de conta
      this.initialized = true;
      return null;
    }
  }

  /**
   * Retorna a sessão do usuário atual.
   */
  async getCurrentUser(): Promise<UserSession | null> {
    return this.currentSession;
  }

  /**
   * Detecta o WID do usuário atual via WhatsAppInterceptors.
   * Segue a mesma abordagem robusta do painel de testes.
   */
  private async detectUserWid(): Promise<string | null> {
    if (!this.interceptors) {
      // Log removido temporariamente - foco em detecção de conta
      return null;
    }

    try {
      let userData: any = null;
      const userModule = this.interceptors.User;
      
      if (!userModule) {
        // Log removido temporariamente - foco em detecção de conta
      }

      // Estratégia 1: Tentar como função direta
      if (userModule && typeof userModule === 'function') {
        try {
          userData = userModule();
        } catch (e) {
          // Log removido temporariamente - foco em detecção de conta
        }
      }

      // Estratégia 2: Tentar métodos do objeto User
      if (!userData && userModule && typeof userModule === 'object') {
        const methods = [
          'getMaybeMePnUser',
          'getMaybeMeLidUser',
          'getMePnUserOrThrow',
          'getMeLidUserOrThrow',
          'getMeUser',
          'getCurrentUser'
        ];

        for (const methodName of methods) {
          try {
            if (typeof userModule[methodName] === 'function') {
              const result = userModule[methodName]();
              if (result) {
                userData = result;
                break;
              }
            }
          } catch {
            // Continuar tentando outros métodos
          }
        }
      }

      // Estratégia 3: Tentar acessar via N.User (se disponível)
      if (!userData) {
        try {
          const interceptorsAny = this.interceptors as any;
          if (interceptorsAny.N && interceptorsAny.N.User) {
            const NUser = interceptorsAny.N.User;
            if (typeof NUser === 'function') {
              userData = NUser();
            } else if (typeof NUser === 'object') {
              const getters = ['getMaybeMePnUser', 'getMaybeMeLidUser', 'getMePnUserOrThrow'];
              for (const getter of getters) {
                if (typeof NUser[getter] === 'function') {
                  const result = NUser[getter]();
                  if (result) {
                    userData = result;
                    break;
                  }
                }
              }
            }
          }
        } catch {
          // Ignorar erros
        }
      }

      // Extrair WID do userData
      if (userData && typeof userData === 'object') {
        // Tentar diferentes propriedades onde o WID pode estar
        let wid: string | null = null;

        // Formato 1: id._serialized (mais comum)
        if (userData.id?._serialized) {
          wid = userData.id._serialized;
        }
        // Formato 2: _serialized direto
        else if (userData._serialized) {
          wid = userData._serialized;
        }
        // Formato 3: id como string
        else if (userData.id && typeof userData.id === 'string') {
          wid = userData.id;
        }
        // Formato 4: wid direto
        else if (userData.wid) {
          wid = userData.wid;
        }
        // Formato 5: construir de user e server
        else if (userData.user && typeof userData.user === 'string') {
          wid = `${userData.user}@${userData.server || 'c.us'}`;
        }

        if (wid && typeof wid === 'string') {
          // Log removido temporariamente - foco em detecção de conta
          return wid;
        }
      }

      // Estratégia 4: Tentar via Contact._models procurando contato com isMe
      if (!userData) {
        try {
          const Contact = this.interceptors.Contact;
          if (Contact && (Contact as any)._models && Array.isArray((Contact as any)._models)) {
            const meContact = (Contact as any)._models.find((c: any) => 
              c.isMe === true || 
              c.isMyContact === true ||
              c.isMyNumber === true ||
              (c.id && typeof c.id === 'string' && c.id.includes('@c.us') && c.isContactSyncCompleted === 1)
            );
            if (meContact) {
              userData = meContact;
              // Log removido temporariamente - foco em detecção de conta
            }
          }
        } catch {
          // Ignorar erros
        }
      }

      // Extrair WID novamente se userData foi encontrado na estratégia 4
      if (userData && typeof userData === 'object') {
        let wid: string | null = null;

        // Tentar diferentes formatos
        if (userData.id?._serialized) {
          wid = userData.id._serialized;
        } else if (userData._serialized) {
          wid = userData._serialized;
        } else if (userData.id && typeof userData.id === 'string') {
          wid = userData.id;
        } else if (userData.wid) {
          wid = userData.wid;
        } else if (userData.user && typeof userData.user === 'string') {
          wid = `${userData.user}@${userData.server || 'c.us'}`;
        }

        if (wid && typeof wid === 'string') {
          // Log removido temporariamente - foco em detecção de conta
          return wid;
        }
      }

      // Log removido temporariamente - foco em detecção de conta
      return null;
    } catch (error) {
      // Log removido temporariamente - foco em detecção de conta
      return null;
    }
  }

  /**
   * Busca dados do contato (nome, foto, telefone) via WhatsAppInterceptors.
   */
  private async fetchUserData(wid: string): Promise<UserSession> {
    const session: UserSession = {
      wid,
      name: null,
      phoneNumber: null,
      profilePicUrl: null,
    };

    if (!this.interceptors) {
      return session;
    }

    try {
      const Contact = this.interceptors.Contact;
      if (!Contact || typeof Contact.get !== 'function') {
        // Log removido temporariamente - foco em detecção de conta
        return session;
      }

      // Buscar dados do contato
      const contact = Contact.get(wid);
      if (!contact) {
        // Log removido temporariamente - foco em detecção de conta
        return session;
      }

      // Extrair nome - tentar múltiplas propriedades (igual painel de testes)
      session.name = contact.name || 
                     contact.pushName || 
                     contact.notifyName || 
                     contact.formattedName ||
                     contact.displayName ||
                     contact.shortName ||
                     contact.fullName ||
                     null;

      // Extrair telefone formatado
      if (contact.formattedPhoneNumber) {
        session.phoneNumber = contact.formattedPhoneNumber;
      } else if (contact.phoneNumber) {
        session.phoneNumber = contact.phoneNumber;
      } else {
        // Tentar extrair do WID (formato: "5511987654321@c.us")
        const phoneMatch = wid.match(/^(\d+)@/);
        if (phoneMatch) {
          session.phoneNumber = phoneMatch[1];
        }
      }

      // Extrair foto de perfil
      if (contact.profilePicThumbObj) {
        const picObj = contact.profilePicThumbObj;
        // Tentar diferentes propriedades onde a URL pode estar
        session.profilePicUrl =
          picObj.eurl ||
          picObj.url ||
          picObj.img ||
          picObj.thumb ||
          picObj.thumbnail ||
          null;
      } else if (contact.profilePicUrl) {
        session.profilePicUrl = contact.profilePicUrl;
      } else if (contact.pic) {
        session.profilePicUrl = contact.pic;
      }

      return session;
    } catch (error) {
      // Log removido temporariamente - foco em detecção de conta
      return session;
    }
  }

  /**
   * Sanitiza WID para uso como nome de banco de dados.
   * Remove caracteres especiais e substitui por underscore.
   */
  sanitizeWidForDB(wid: string): string {
    return wid.replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  }

  /**
   * Salva WID do usuário atual em chrome.storage.local.
   */
  private async saveUserWid(wid: string): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          [UserSessionManager.STORAGE_KEY]: wid,
        });
        // Log removido temporariamente - foco em detecção de conta
      } else {
        // Fallback para localStorage
        localStorage.setItem(UserSessionManager.STORAGE_KEY, wid);
        // Log removido temporariamente - foco em detecção de conta
      }
    } catch (error) {
      // Log removido temporariamente - foco em detecção de conta
    }
  }

  /**
   * Carrega WID do usuário salvo em chrome.storage.local.
   */
  async loadSavedUserWid(): Promise<string | null> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(UserSessionManager.STORAGE_KEY);
        return result[UserSessionManager.STORAGE_KEY] || null;
      } else {
        // Fallback para localStorage
        return localStorage.getItem(UserSessionManager.STORAGE_KEY);
      }
    } catch (error) {
      // Log removido temporariamente - foco em detecção de conta
      return null;
    }
  }
}
