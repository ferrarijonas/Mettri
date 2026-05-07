/**
 * SendMessageService - Envia mensagens de texto via WhatsApp Web.
 * Baseado no fluxo do test-panel (addAndSendMsgToChat).
 */

import { whatsappInterceptors } from '../whatsapp-interceptors';
import { digitsOnly, normalizePhoneDigitsWithAliases } from '../../storage/client-db';

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

/** Conjunto de aliases do mesmo telefone (BR com/sem 55 e com/sem 9). */
function aliasDigitSet(phoneDigits: string): Set<string> {
  return new Set(normalizePhoneDigitsWithAliases(phoneDigits).aliasesDigits);
}

/** Há interseção entre os “apelidos” de dois números? */
function phoneAliasesIntersect(aDigits: string, bDigits: string): boolean {
  const sa = aliasDigitSet(aDigits);
  const sb = aliasDigitSet(bDigits);
  for (const x of sa) {
    if (sb.has(x)) return true;
  }
  return false;
}

/**
 * WIDs @c.us a tentar: mesma lógica do import Retomar (aliases BR), sem duplicar 55 no número.
 */
function buildWidCandidates(phoneNumber: string, currentUserWid: string | null): string[] {
  const { aliasesDigits } = normalizePhoneDigitsWithAliases(phoneNumber);
  const wids = new Set<string>();
  for (const a of aliasesDigits) {
    if (a.length >= 10) wids.add(`${a}@c.us`);
  }
  // Extra: se o número parece só nacional (10–11) e o usuário tem DDI de 2 dígitos, prefixar uma vez
  if (currentUserWid && phoneNumber.length >= 10 && phoneNumber.length <= 11 && !phoneNumber.startsWith('55')) {
    const bare = currentUserWid.replace('@c.us', '').replace('@lid', '');
    const m = bare.match(/^(\d{2})\d+/);
    if (m && !phoneNumber.startsWith(m[1])) {
      wids.add(`${m[1]}${phoneNumber}@c.us`);
    }
  }
  return [...wids];
}

/**
 * Procura na lista de chats já carregada no WA (getModelsArray / _models) por @c.us cujo user bate com aliases.
 * Metáfora: se o endereço exato falha, varre a agenda até achar o mesmo telefone com outro “uniforme”.
 */
async function findChatMatchingPhoneInModels(Chat: any, phoneDigits: string): Promise<any> {
  const lists: unknown[][] = [];
  try {
    if (typeof Chat.getModelsArray === 'function') {
      const raw = Chat.getModelsArray();
      const arr = await Promise.resolve(raw);
      if (Array.isArray(arr)) lists.push(arr);
    }
  } catch {
    /* ignore */
  }
  if (Array.isArray(Chat._models)) lists.push(Chat._models);

  for (const chats of lists) {
    for (const c of chats) {
      const m = c as { id?: { _serialized?: string } | string };
      const sid: string =
        (m.id && typeof m.id === 'object' && '_serialized' in m.id
          ? m.id._serialized
          : typeof m.id === 'string'
            ? m.id
            : '') || '';
      if (!sid.endsWith('@c.us')) continue;
      const userDigits = digitsOnly(sid.split('@')[0] || '');
      if (!userDigits) continue;
      if (phoneAliasesIntersect(phoneDigits, userDigits)) return c;
    }
  }
  return null;
}

function readCurrentUserWid(User: any): string | null {
  let currentUser: unknown = null;
  try {
    if (User) {
      if (typeof User === 'function') {
        currentUser = User();
      } else if (typeof User.getMaybeMePnUser === 'function') {
        currentUser = User.getMaybeMePnUser();
      } else if (typeof User.getMaybeMeLidUser === 'function') {
        currentUser = User.getMaybeMeLidUser();
      }
      if (currentUser && typeof currentUser === 'object') {
        const u = currentUser as {
          id?: { _serialized?: string };
          _serialized?: string;
          user?: string;
          server?: string;
        };
        return (
          u.id?._serialized ??
          u._serialized ??
          (u.user ? `${u.user}@${u.server || 'c.us'}` : null) ??
          null
        );
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function chatModelHasRequiredProps(chat: unknown): boolean {
  if (!chat || typeof chat !== 'object') return false;
  const c = chat as { id?: { isGroup?: unknown; isLid?: unknown; user?: unknown } };
  return !!(
    c.id &&
    (typeof c.id.isGroup === 'function' || typeof c.id.isLid === 'function') &&
    c.id.user
  );
}

function createWidObject(WidFactory: any, wid: string): any {
  if (!WidFactory) return null;
  try {
    if (typeof WidFactory === 'function') return WidFactory(wid);
    if (typeof WidFactory.createWid === 'function') return WidFactory.createWid(wid);
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Materializa chat no WA: find → openChatAt → espera → get/find de novo → scan por aliases.
 * Usado após as estratégias “rápidas” falharem.
 *
 * Importante: **nunca** chamar `Chat.find` só com string `5511...@c.us` — versões recentes do WA
 * esperam objeto WID e lançam `e.isLid is not a function` (throw síncrono, fora de `.catch`).
 */
async function tryMaterializeChatInWa(
  Chat: any,
  WidFactory: any,
  Cmd: any,
  wid: string,
  phoneDigits: string
): Promise<any> {
  try {
    const widObj = createWidObject(WidFactory, wid);
    const widForFind = widObj?.user ? widObj : null;

    if (widForFind && typeof Chat.find === 'function') {
      let found: any = null;
      try {
        found = await Promise.resolve(Chat.find(widForFind)).catch(() => null);
      } catch {
        found = null;
      }
      if (found && chatModelHasRequiredProps(found)) return found;
    }

    if (widObj?.user && Cmd?.openChatAt) {
      try {
        Cmd.openChatAt({ id: widObj });
        await new Promise(r => setTimeout(r, 3000));
      } catch {
        /* ignore */
      }
    }

    let chat: any = null;
    try {
      chat = typeof Chat.get === 'function' ? Chat.get(wid) : null;
    } catch {
      chat = null;
    }
    if (!chat && widForFind && typeof Chat.find === 'function') {
      try {
        chat = await Promise.resolve(Chat.find(widForFind)).catch(() => null);
      } catch {
        chat = null;
      }
    }
    if (chat && chatModelHasRequiredProps(chat)) return chat;

    const scanned = await findChatMatchingPhoneInModels(Chat, phoneDigits);
    if (scanned && chatModelHasRequiredProps(scanned)) return scanned;
    return null;
  } catch {
    return null;
  }
}

export type EnsureChatLoadedResult =
  | { ok: true; chat: unknown }
  | {
      ok: false;
      reason: 'not_registered' | 'not_found' | 'no_chat_module' | 'invalid_phone';
      phoneDigits?: string;
    };

/**
 * Fallback quando `Chat.get` / `find` / scan da lista já falharam: `QueryExist` (se existir) + materialização.
 * Exportado para Respostas Agênticas pré-carregarem o chat no WA (ajuda captura; não grava MessageDB).
 */
export async function ensureChatLoaded(chatIdOrPhone: string): Promise<EnsureChatLoadedResult> {
  const phoneDigits = normalizeInputToPhoneNumber(chatIdOrPhone);
  if (!phoneDigits) {
    return { ok: false, reason: 'invalid_phone' };
  }

  try {
    await whatsappInterceptors.initialize();
    const i = whatsappInterceptors;
    const Chat = i.Chat;
    const WidFactory = i.WidFactory;
    const Cmd = i.Cmd;
    const User = i.User;
    const queryExist = i.QueryExist;

    if (!Chat) {
      return { ok: false, reason: 'no_chat_module' };
    }

    const currentUserWid = readCurrentUserWid(User);
    const widsToTry = buildWidCandidates(phoneDigits, currentUserWid);

    for (const wid of widsToTry) {
      try {
        if (typeof queryExist === 'function') {
          let exists: unknown;
          try {
            exists = await Promise.resolve(queryExist(wid)).catch(() => undefined);
          } catch {
            exists = undefined;
          }
          if (exists === false) continue;
        }
        const chat = await tryMaterializeChatInWa(Chat, WidFactory, Cmd, wid, phoneDigits);
        if (chat) {
          return { ok: true, chat };
        }
      } catch {
        /* próximo alias */
      }
    }

    if (typeof queryExist === 'function' && widsToTry.length > 0) {
      let allFalse = true;
      for (const wid of widsToTry) {
        let ex: unknown;
        try {
          ex = await Promise.resolve(queryExist(wid)).catch(() => undefined);
        } catch {
          ex = undefined;
        }
        if (ex !== false) {
          allFalse = false;
          break;
        }
      }
      if (allFalse) {
        return { ok: false, reason: 'not_registered', phoneDigits };
      }
    }

    return { ok: false, reason: 'not_found', phoneDigits };
  } catch {
    return { ok: false, reason: 'not_found', phoneDigits };
  }
}

/** Resolve modelo Chat do WA para um chatId @c.us (aliases + scan). */
async function resolveChatModelForRetomar(chatIdParam: string): Promise<any> {
  const phoneNumber = normalizeInputToPhoneNumber(chatIdParam);
  if (!phoneNumber) return null;

  await whatsappInterceptors.initialize();
  const i = whatsappInterceptors;
  const Chat = i.Chat;
  const WidFactory = i.WidFactory;
  const User = i.User;
  if (!Chat) return null;

  const currentUserWid = readCurrentUserWid(User);
  const wids = buildWidCandidates(phoneNumber, currentUserWid);

  for (const wid of wids) {
    try {
      const c = Chat.get?.(wid);
      if (c) return c;
    } catch {
      /* ignore */
    }
  }

  if (typeof Chat.find === 'function') {
    for (const wid of wids) {
      try {
        let widToFind: unknown = wid;
        if (WidFactory?.createWid) {
          try {
            widToFind = WidFactory.createWid(wid);
          } catch {
            widToFind = wid;
          }
        }
        const c = await Promise.resolve(Chat.find(widToFind)).catch(() => null);
        if (c) return c;
      } catch {
        /* ignore */
      }
    }
  }

  const scanned = await findChatMatchingPhoneInModels(Chat, phoneNumber);
  if (scanned) return scanned;

  const ensured = await ensureChatLoaded(chatIdParam);
  if (ensured.ok) return ensured.chat;
  return null;
}

function outgoingUnixFromMsgModel(m: unknown): number | null {
  if (!m || typeof m !== 'object') return null;
  const msg = m as {
    fromMe?: boolean;
    id?: { fromMe?: boolean };
    __x_fromMe?: boolean;
    t?: number;
    __x_t?: number;
  };
  const fromMe = msg.fromMe === true || msg.id?.fromMe === true || msg.__x_fromMe === true;
  if (!fromMe) return null;
  const t = msg.t ?? msg.__x_t;
  return typeof t === 'number' && t > 0 ? t : null;
}

/**
 * Última mensagem enviada por nós neste chat, a partir do modelo WA (não usa MessageDB).
 */
async function extractLastOurOutgoingTimeFromChat(chat: unknown): Promise<Date | null> {
  if (!chat || typeof chat !== 'object') return null;
  const c = chat as {
    lastMessage?: unknown;
    __x_lastMessage?: unknown;
    _lastMessage?: unknown;
    ms?: { getModelsArray?: () => unknown; _models?: unknown[] };
    msgs?: { getModelsArray?: () => unknown; _models?: unknown[] };
  };

  let best: number | null = null;
  const bump = (u: number | null) => {
    if (u != null && (best === null || u > best)) best = u;
  };

  bump(outgoingUnixFromMsgModel(c.lastMessage));
  bump(outgoingUnixFromMsgModel(c.__x_lastMessage));
  bump(outgoingUnixFromMsgModel(c._lastMessage));

  // Early-exit: se lastMessage já é outgoing, não precisa escanear mensagens
  if (best != null) return new Date(best * 1000);

  const ms = c.ms || c.msgs;
  if (ms && typeof ms === 'object') {
    try {
      let models: unknown[] = [];
      const coll = ms as { getModelsArray?: () => unknown; _models?: unknown[] };
      if (typeof coll.getModelsArray === 'function') {
        const raw = coll.getModelsArray();
        const arr = await Promise.resolve(raw);
        if (Array.isArray(arr)) models = arr;
      } else if (Array.isArray(coll._models)) {
        models = coll._models;
      }
      let n = 0;
      for (const m of models) {
        if (n++ > 120) break;
        bump(outgoingUnixFromMsgModel(m));
      }
    } catch {
      /* ignore */
    }
  }

  return best != null ? new Date(best * 1000) : null;
}

/**
 * Para cada chatId, consulta o Store do WhatsApp e devolve a data da última mensagem enviada por nós.
 * Usar só como fallback quando MessageDB + storage Retomar não têm dado (custo: 1 resolução de chat por id).
 */
export async function getLastOutgoingFromWhatsAppForChatIds(
  chatIds: string[],
): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  const BATCH_SIZE = 5;
  for (let i = 0; i < chatIds.length; i += BATCH_SIZE) {
    const batch = chatIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (chatId) => {
        if (!chatId || !chatId.includes('@c.us')) return null;
        try {
          const chat = await resolveChatModelForRetomar(chatId);
          if (!chat) return null;
          const d = await extractLastOurOutgoingTimeFromChat(chat);
          return d && !Number.isNaN(d.getTime()) ? [chatId, d] as const : null;
        } catch {
          return null;
        }
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        out.set(r.value[0], r.value[1]);
      }
    }
  }
  return out;
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

      // 3. WIDs a tentar (aliases BR + sem bug 55+55)
      const widsToTry = buildWidCandidates(phoneNumber, currentUserWid);
      
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

      // Estratégia 6: varrer chats carregados (mesmo telefone, outro formato de @c.us)
      if (!chat) {
        chat = await findChatMatchingPhoneInModels(chatModule, phoneNumber);
      }

      // Estratégia 7: QueryExist + materializar chat (find + openChatAt + espera)
      if (!chat) {
        const ensured = await ensureChatLoaded(chatIdOrPhone);
        if (ensured.ok) {
          chat = ensured.chat;
        } else if (ensured.reason === 'not_registered') {
          throw new Error(
            `Número não registado no WhatsApp: ${phoneNumber}. Verifique o telefone (formato: 11999999999, com ou sem DDI 55 e 9 do celular conforme o caso).`
          );
        }
      }

      // Validação: Chat não encontrado (TestPanel linhas 2490-2495)
      if (!chat) {
        throw new Error(
          `Chat não encontrado para ${phoneNumber} (tentámos ${widsToTry.length} formato(s) de número + busca na lista + materialização WA). O chat precisa existir no WhatsApp (ter pelo menos uma mensagem trocada) ou estar na lista de conversas. Tente:\n1. Abrir a conversa manualmente no WhatsApp primeiro\n2. Enviar uma mensagem manualmente para criar o chat\n3. Verificar se o número está correto (formato: 11999999999 sem espaços ou caracteres especiais)`
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
