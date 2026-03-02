/**
 * SendMessageService - Envia mensagens de texto via WhatsApp Web.
 * Baseado no fluxo do test-panel (addAndSendMsgToChat).
 */

import { whatsappInterceptors } from '../whatsapp-interceptors';
import { digitsOnly } from '../../storage/client-db';

/**
 * Normaliza entrada para número puro (extrai dígitos de qualquer formato).
 * Aceita número puro (ex: "11999999999") ou chatId formatado (ex: "5511999999999@c.us").
 */
function normalizeInputToPhoneNumber(chatIdOrPhone: string): string {
  // Se não contém @c.us, já é número puro
  if (!chatIdOrPhone.includes('@c.us')) {
    return digitsOnly(chatIdOrPhone);
  }
  // Se contém @c.us, extrair apenas dígitos
  return digitsOnly(chatIdOrPhone);
}

/**
 * Cria variantes de WID exatamente como o TestPanel (linhas 2296-2311).
 * Recebe número PURO como entrada e cria: [número@c.us, 55+número@c.us, countryCode+número@c.us]
 */
function createWidVariants(phoneNumber: string, currentUserWid: string | null): string[] {
  // TestPanel linha 2297-2298: cria testWid1 e testWid2
  const testWid1 = `${phoneNumber}@c.us`;
  const testWid2 = `55${phoneNumber}@c.us`;
  
  // TestPanel linhas 2299-2309: cria testWid3 com código do país do usuário atual
  let testWid3: string | null = null;
  if (currentUserWid) {
    const match = currentUserWid.match(/^(\d{2})(\d+)/);
    if (match) {
      const countryCode = match[1];
      if (!phoneNumber.startsWith(countryCode)) {
        testWid3 = `${countryCode}${phoneNumber}@c.us`;
      }
    }
  }
  
  // TestPanel linha 2311: filtra valores nulos
  return [testWid1, testWid2, testWid3].filter(Boolean) as string[];
}

export class SendMessageService {
  async sendText(chatIdOrPhone: string, text: string): Promise<void> {
    try {
      if (!chatIdOrPhone || !text) {
        throw new Error(`Parâmetros inválidos: chatIdOrPhone=${chatIdOrPhone}, text=${text}`);
      }
      
      await whatsappInterceptors.initialize();

      const i = whatsappInterceptors;
      const Chat = i.Chat;
      const Cmd = i.Cmd;
      const User = i.User;
      const MsgKey = i.MsgKey;
      const WidFactory = i.WidFactory;
      const getEphemeralFields = i.getEphemeralFields;
      const addAndSendMsg = i.addAndSendMsgToChat;
      const sendTextMsg = i.sendTextMsgToChat;

      if (!Chat) throw new Error('Módulo Chat não encontrado');

      // 1. Normalizar entrada: aceitar número puro OU chatId formatado
      const phoneNumber = normalizeInputToPhoneNumber(chatIdOrPhone);
      if (!phoneNumber) {
        throw new Error(`Número inválido: ${chatIdOrPhone}`);
      }

      // 2. Obter usuário atual (igual TestPanel linhas 2272-2294)
      let currentUserWid: string | null = null;
      let currentUser: any = null;
      
      if (User) {
        try {
          if (typeof User === 'function') {
            currentUser = User();
          } else if (typeof User.getMaybeMePnUser === 'function') {
            currentUser = User.getMaybeMePnUser();
          } else if (typeof User.getMaybeMeLidUser === 'function') {
            currentUser = User.getMaybeMeLidUser();
          }

          if (currentUser) {
            currentUserWid = currentUser.id?._serialized ?? currentUser._serialized ??
              (currentUser.user ? `${currentUser.user}@${currentUser.server || 'c.us'}` : null);
          }
        } catch {
          // ignore
        }
      }

      if (!currentUser) throw new Error('Não foi possível obter usuário atual (User)');

      // 3. Criar variantes de WID (igual TestPanel linhas 2296-2311)
      const widsToTry = createWidVariants(phoneNumber, currentUserWid);
      
      // Verificar se está enviando para si mesmo (igual TestPanel linhas 2315-2325)
      const isSendingToSelf = currentUserWid && widsToTry.some(wid => {
        const normalizedWid = wid.replace('@c.us', '');
        const normalizedCurrent = currentUserWid!.replace('@c.us', '').replace('@lid', '');
        return normalizedWid === normalizedCurrent || 
               normalizedWid.endsWith(normalizedCurrent) || 
               normalizedCurrent.endsWith(normalizedWid);
      });

      // 4. Buscar chat com todas as estratégias (igual TestPanel linhas 2330-2516)
      let chat: any = null;
      const chatModule = Chat;

      // Estratégia 1: Abrir chat primeiro via Cmd.openChatAt() (TestPanel linhas 2341-2364)
      if (Cmd?.openChatAt && typeof chatModule.get === 'function') {
        for (const wid of widsToTry) {
          try {
            const basicChat = chatModule.get(wid);
            if (basicChat) {
              Cmd.openChatAt(basicChat);
              await new Promise(r => setTimeout(r, 500));
              break;
            }
          } catch { /* ignore */ }
        }
      }

      // Estratégia 2: Se enviando para si mesmo, usar chat ativo (TestPanel linhas 2374-2396)
      if (isSendingToSelf && typeof chatModule.getActive === 'function') {
        try {
          const activeChat = chatModule.getActive();
          if (activeChat && activeChat.id) {
            const activeChatId = activeChat.id._serialized || 
                                (typeof activeChat.id === 'string' ? activeChat.id : activeChat.id.toString());
            const activeChatMatches = widsToTry.some(wid => {
              const normalizedWid = wid.replace('@c.us', '');
              const normalizedActive = activeChatId.replace('@c.us', '').replace('@lid', '');
              return normalizedWid === normalizedActive || 
                     normalizedWid.endsWith(normalizedActive) || 
                     normalizedActive.endsWith(normalizedWid);
            });
            if (activeChatMatches) {
              chat = activeChat;
            }
          }
        } catch { /* ignore */ }
      }

      // Estratégia 3: Tentar Chat.get() com todos os formatos (TestPanel linhas 2398-2412)
      if (!chat && typeof chatModule.get === 'function') {
        for (const wid of widsToTry) {
          try {
            const foundChat = chatModule.get(wid);
            if (foundChat) {
              chat = foundChat;
              break;
            }
          } catch { /* ignore */ }
        }
      }

      // Estratégia 4: Tentar Chat.find() com WID factory (TestPanel linhas 2414-2444)
      if (!chat && typeof chatModule.find === 'function') {
        for (const wid of widsToTry) {
          try {
            let widToFind: any = wid;
            if (WidFactory) {
              try {
                if (typeof WidFactory === 'function') {
                  widToFind = WidFactory(wid);
                } else if (typeof WidFactory.createWid === 'function') {
                  widToFind = WidFactory.createWid(wid);
                }
                if (!widToFind || (typeof widToFind === 'string' && widToFind === wid)) {
                  widToFind = wid;
                }
              } catch {
                widToFind = wid;
              }
            }
            const foundChat = await Promise.resolve(chatModule.find(widToFind)).catch(() => null);
            if (foundChat) {
              chat = foundChat;
              break;
            }
          } catch { /* ignore */ }
        }
      }

      // Estratégia 5: Forçar abertura com WID objeto e aguardar (TestPanel linhas 2448-2488)
      if (!chat && WidFactory && Cmd?.openChatAt) {
        for (const wid of widsToTry) {
          try {
            let widObj: any = null;
            if (typeof WidFactory === 'function') {
              widObj = WidFactory(wid);
            } else if (typeof WidFactory.createWid === 'function') {
              widObj = WidFactory.createWid(wid);
            }
            
            if (widObj && widObj.user) {
              try {
                const tempChatForOpen = { id: widObj };
                Cmd.openChatAt(tempChatForOpen);
                await new Promise(r => setTimeout(r, 2000));
                
                chat = chatModule.get(wid);
                if (!chat && typeof chatModule.find === 'function') {
                  chat = await Promise.resolve(chatModule.find(widObj)).catch(() => null);
                }
                
                if (chat) {
                  break;
                }
              } catch { /* ignore */ }
            }
          } catch { /* ignore */ }
        }
      }

      // Validação: Chat não encontrado (TestPanel linhas 2490-2495)
      if (!chat) {
        throw new Error(
          `Chat não encontrado para ${phoneNumber}. O chat precisa existir no WhatsApp (ter pelo menos uma mensagem trocada) ou estar na lista de conversas. Tente:\n1. Abrir a conversa manualmente no WhatsApp primeiro\n2. Enviar uma mensagem manualmente para criar o chat\n3. Verificar se o número está correto (formato: 11999999999 sem espaços ou caracteres especiais)`
        );
      }

      // Validação: Verificar propriedades necessárias (TestPanel linhas 2498-2516)
      const hasRequiredProps = chat.id && 
        (typeof chat.id.isGroup === 'function' || typeof chat.id.isLid === 'function') &&
        chat.id.user;
        
      if (!hasRequiredProps) {
        throw new Error(
          `Chat obtido não tem estrutura válida. O chat precisa ser um objeto completo do WhatsApp, não um objeto mínimo. Tente abrir a conversa manualmente no WhatsApp primeiro.`
        );
      }

      // 5. Criar MsgKey (igual TestPanel linhas 2562-2671)
      if (addAndSendMsg && typeof addAndSendMsg === 'function') {
          if (!MsgKey?.newId || typeof MsgKey.newId !== 'function') {
            throw new Error('MsgKey.newId() não disponível');
          }

          const newMsgId = await Promise.resolve(MsgKey.newId());
          const isGroup = chat.id && typeof chat.id.isGroup === 'function' ? chat.id.isGroup() : false;

          const msgKeyData = {
            from: currentUser,
            to: chat.id,
            id: newMsgId,
            participant: isGroup ? currentUser : undefined,
            selfDir: 'out'
          };

          // Criar MsgKey como CLASSE com todas as estratégias (TestPanel linhas 2603-2637)
          let msgKeyObj: any = null;
          let MsgKeyClass: any = null;

          // Estratégia 1: msgKeyModule é a classe diretamente (TestPanel linha 2604)
          if (typeof MsgKey === 'function' && MsgKey.prototype) {
            MsgKeyClass = MsgKey;
          }
          // Estratégia 2: msgKeyModule tem .default que é a classe (TestPanel linha 2609)
          else if (MsgKey?.default && typeof MsgKey.default === 'function' && MsgKey.default.prototype) {
            MsgKeyClass = MsgKey.default;
          }
          // Estratégia 3: msgKeyModule tem constructor (TestPanel linha 2614)
          else if (MsgKey?.constructor && typeof MsgKey.constructor === 'function' && MsgKey.constructor !== Object) {
            MsgKeyClass = MsgKey.constructor;
          }
          // Estratégia 4: Tentar encontrar MsgKey no window.N (TestPanel linhas 2619-2627)
          else if ((window as any).N?.MsgKey) {
            const nMsgKey = (window as any).N.MsgKey;
            if (typeof nMsgKey === 'function' && nMsgKey.prototype) {
              MsgKeyClass = nMsgKey;
            } else if (nMsgKey?.default && typeof nMsgKey.default === 'function') {
              MsgKeyClass = nMsgKey.default;
            }
          }
          // Estratégia 5: Tentar acessar via interceptors.N se disponível (TestPanel linhas 2631-2637)
          if (!MsgKeyClass && (i as any).N?.MsgKey) {
            const nMsgKey = (i as any).N.MsgKey;
            if (typeof nMsgKey === 'function' && nMsgKey.prototype) {
              MsgKeyClass = nMsgKey;
            }
          }

          if (MsgKeyClass && typeof MsgKeyClass === 'function') {
            try {
              msgKeyObj = new MsgKeyClass(msgKeyData);
            } catch {
              msgKeyObj = msgKeyData; // Fallback objeto simples
            }
          } else {
            msgKeyObj = msgKeyData;
          }

          // 6. Obter campos efêmeros (TestPanel linhas 2681-2691)
          let ephemeralFields: Record<string, unknown> = {};
          if (getEphemeralFields && typeof getEphemeralFields === 'function') {
            try {
              ephemeralFields = (await Promise.resolve(getEphemeralFields(chat))) || {};
            } catch { /* ignore */ }
          }

          // 7. Criar objeto de mensagem completo (TestPanel linhas 2693-2723)
          const messageObj: any = {
            id: msgKeyObj,
            ack: 0,
            body: text,
            from: currentUser,
            to: chat.id,
            local: true,
            self: 'out',
            t: Math.floor(Date.now() / 1000),
            isNewMsg: true,
            type: 'chat',
            ...ephemeralFields
          };
          // Definir tipo (TestPanel linha 2710)
          messageObj.type = messageObj.type || messageObj.__x_type || 'chat';

          // 8. Enviar e aguardar promises (TestPanel linhas 2725-2757)
          const result = await Promise.resolve(addAndSendMsg(chat, messageObj));
          
          // WA-Sync: addAndSendMsgToChat retorna [sendPromise, waitPromise]
          let sendPromiseOrValue: any = null;
          let waitPromiseOrValue: any = null;

          if (Array.isArray(result)) {
            sendPromiseOrValue = result[0];
            waitPromiseOrValue = result[1];
          } else {
            sendPromiseOrValue = result;
          }

          // Aguardar sendPromise, depois waitPromise (se existir)
          await Promise.resolve(sendPromiseOrValue);
          if (waitPromiseOrValue) {
            await Promise.resolve(waitPromiseOrValue);
          }
          
          return;
      }

      // 9. Método de Envio 2: sendTextMsgToChat (Fallback)
      if (sendTextMsg && typeof sendTextMsg === 'function') {
          try {
            await Promise.resolve(sendTextMsg(chat, text));
            return;
          } catch (e: any) {
            // Tratamento de erros específicos (TestPanel linhas 2816-2831)
            const errorMsg = e?.message || 'Erro desconhecido';
            const errorStack = e?.stack || '';
            
            // Erro específico: isLid is not a function (ID não é objeto WID)
            if (errorMsg.includes('isLid') || errorStack.includes('isLid')) {
              throw new Error(
                `ID do chat não é objeto WID válido. O chat.id precisa ser um objeto WID (com métodos como isLid), não uma string. Tente abrir a conversa no WhatsApp primeiro para garantir que o chat está carregado.`
              );
            }
            // Se erro contém 'toLogString', é erro interno do WhatsApp (objeto undefined)
            if (errorMsg.includes('toLogString') || errorStack.includes('toLogString')) {
              throw new Error(
                `Erro interno do WhatsApp: objeto não inicializado. O chat pode não estar totalmente carregado. Tente abrir a conversa no WhatsApp primeiro.`
              );
            }
            throw new Error(`Falha no fallback sendTextMsgToChat: ${errorMsg}`);
          }
      }

      throw new Error('Nenhum método de envio disponível (addAndSendMsgToChat ou sendTextMsgToChat).');
    } catch (error: any) {
      throw error;
    }
  }
}

export const sendMessageService = new SendMessageService();
