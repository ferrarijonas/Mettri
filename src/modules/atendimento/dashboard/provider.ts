import { orderDB } from '../../../storage/order-db';
import { purchaseDB } from '../../../storage/purchase-db';
import { digitsOnly } from '../../../storage/client-db';
import { whatsappInterceptors } from '../../../infrastructure/whatsapp-interceptors';
import type { AtendimentoViewModel } from './view-model';
import {
  buildClientBadges,
  buildPhoneLabel,
  pickStrongDisplayName,
  resolveClientByChatId,
} from './client-resolver';
import { getRetomarSupportSnapshot } from './retomar-support';

function extractChatId(chatLike: any): string | null {
  const id =
    chatLike?.id?._serialized ??
    (typeof chatLike?.id === 'string' ? chatLike.id : null) ??
    (typeof chatLike?.id?.toString === 'function' ? chatLike.id.toString() : null);
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

export async function getActiveChatIdDirect(): Promise<string | null> {
  // 1) window.Store.Chat.getActive()
  try {
    const storeChat = (window as any)?.Store?.Chat;
    if (storeChat && typeof storeChat.getActive === 'function') {
      const active = storeChat.getActive();
      const id = extractChatId(active);
      if (id) return id;
    }
  } catch {
    // ignore
  }

  // 2) Interceptors.Chat.getActive()
  try {
    await whatsappInterceptors.initialize();
    const Chat: any = whatsappInterceptors.Chat;
    if (Chat && typeof Chat.getActive === 'function') {
      const active = Chat.getActive();
      const id = extractChatId(active);
      if (id) return id;
    }
  } catch {
    // ignore
  }

  return null;
}

function looksLikePhoneLabel(input: string): boolean {
  const s = String(input || '').trim();
  if (!s) return false;
  // Se tem letras, provavelmente é nome.
  if (/[a-zA-ZÀ-ÿ]/.test(s)) return false;
  const digits = digitsOnly(s);
  // Metáfora: telefone tem “muitos números”; nome não.
  if (digits.length < 10) return false;
  return true;
}

function isLikelySameContact(chatId: string, contactId: string): boolean {
  const a = String(chatId || '').trim();
  const b = String(contactId || '').trim();

  // Se não dá pra comparar, não bloquear.
  if (!a || !b) return true;
  if (a === b) return true;

  // Metáfora: se ambos têm “CPF” (dígitos suficientes) e são diferentes,
  // é outra pessoa; se não tiver CPF, não dá pra condenar.
  const aDigits = digitsOnly(a);
  const bDigits = digitsOnly(b);
  if (aDigits.length >= 10 && bDigits.length >= 10) return aDigits === bDigits;

  return true;
}

/** Extrai o melhor nome de um objeto contact/chat (prioriza display name nativo, ex. ~Nome). */
function extractDisplayNameFromContact(c: any): string {
  if (!c || typeof c !== 'object') return '';
  const fields = [
    'formattedShortNameWithNonContact',
    'formattedShortName',
    'formattedTitle',
    'formattedName',
    'name',
    'pushName',
    'pushname',
    'notifyName',
    'displayName',
    'verifiedName',
    'shortName',
    'fullName',
    'businessName',
    'profileName',
    '__x_formattedShortNameWithNonContact',
    '__x_formattedShortName',
    '__x_formattedTitle',
    '__x_formattedName',
    '__x_name',
    '__x_pushname',
    '__x_pushName',
    '__x_notifyName',
    '__x_displayName',
    '__x_verifiedName',
  ];
  for (const key of fields) {
    const v = c?.[key];
    if (typeof v === 'string' && v.trim() && v.toLowerCase() !== 'unknown') {
      const s = v.trim();
      if (!looksLikePhoneLabel(s)) return s;
    }
  }
  return '';
}

/** Extrai dígitos de telefone do Contact para chats @lid (fallback). */
async function getPhoneFromContactForLid(chatId: string): Promise<string | null> {
  if (!chatId.endsWith('@lid')) return null;
  try {
    await whatsappInterceptors.initialize();
    const Chat: any = whatsappInterceptors.Chat;
    const Contact: any = whatsappInterceptors.Contact;
    const WidFactory: any = (whatsappInterceptors as any).WidFactory;
    const wid = WidFactory?.createWid?.(chatId) ?? chatId;

    const extract = (c: any): string | null => {
      if (!c || typeof c !== 'object') return null;
      const fields = [
        'phoneNumber', 'formattedPhoneNumber', 'pn', 'formattedPhone',
        '__x_phoneNumber', '__x_formattedPhoneNumber', '__x_pn',
      ];
      for (const key of fields) {
        const v = c?.[key];
        if (typeof v === 'string' && v.trim()) {
          const d = digitsOnly(v);
          if (d.length >= 10) return d;
        }
      }
      return null;
    };

    // 1) Chat ativo
    if (Chat?.getActive) {
      const active = Chat.getActive();
      const activeId = extractChatId(active);
      if (activeId === chatId) {
        const phone = extract(active) || extract(active?.contact);
        if (phone) return phone;
      }
    }

    // 2) Chat.get / Chat.find
    if (Chat?.get || Chat?.find) {
      let chat: any = Chat.get?.(wid) ?? Chat.get?.(chatId);
      if (!chat && Chat.find) chat = await Chat.find(wid);
      const phone = extract(chat) || extract(chat?.contact);
      if (phone) return phone;
    }

    // 3) Contact.get
    if (Contact?.get) {
      for (const key of [wid, chatId]) {
        try {
          const c = Contact.get(key);
          const phone = extract(c);
          if (phone) return phone;
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function getWhatsAppName(chatId: string): Promise<string> {
  try {
    await whatsappInterceptors.initialize();

    const Chat: any = whatsappInterceptors.Chat;
    const WidFactory: any = (whatsappInterceptors as any).WidFactory;
    const wid = WidFactory && typeof WidFactory.createWid === 'function' ? WidFactory.createWid(chatId) : chatId;

    // 1) Chat ATIVO (o que está na tela; dados mais frescos).
    try {
      if (Chat && typeof Chat.getActive === 'function') {
        const active = Chat.getActive();
        const activeId = extractChatId(active);
        if (activeId && (activeId === chatId || digitsOnly(activeId) === digitsOnly(chatId))) {
          const name = extractDisplayNameFromContact(active) || extractDisplayNameFromContact(active?.contact);
          if (name) return name;
        }
      }
    } catch {
      /* ignore */
    }

    // 2) Chat.get / Chat.find.
    try {
      let chat: any = null;
      if (Chat && typeof Chat.get === 'function') chat = Chat.get(wid) || Chat.get(chatId);
      if (!chat && Chat && typeof Chat.find === 'function') chat = await Chat.find(wid);
      const name = extractDisplayNameFromContact(chat) || extractDisplayNameFromContact(chat?.contact);
      if (name) return name;
    } catch {
      /* ignore */
    }

    const Contact: any = whatsappInterceptors.Contact;
    if (Contact && typeof Contact.get === 'function') {
      // Tentar com wid (objeto) e com chatId (string).
      const contactCandidates = [wid, chatId];

      for (const key of contactCandidates) {
        let c: any = null;
        try {
          c = Contact.get(key);
        } catch {
          c = null;
        }
        if (!c) continue;

        const contactId =
          c?.id?._serialized ??
          (typeof c?.id === 'string' ? c.id : null) ??
          (typeof c?.id?.toString === 'function' ? c.id.toString() : null);
        if (contactId && !isLikelySameContact(chatId, String(contactId))) continue;
        if (c?.isMe === true) continue;

        const name = extractDisplayNameFromContact(c);
        if (name) return name;
      }
    }
  } catch {
    /* ignore */
  }
  return '';
}

function mapOrderStatusLabel(status: string): string {
  if (status === 'open') return 'Aberto';
  if (status === 'awaiting_payment') return 'Aguardando pagamento';
  if (status === 'closed') return 'Fechado';
  return status;
}

export async function getAtendimentoViewModel(params?: { chatId?: string | null }): Promise<AtendimentoViewModel> {
  const chatId = String(params?.chatId || (await getActiveChatIdDirect()) || '').trim();
  if (!chatId) {
    return {
      kind: 'noChat',
      title: 'Atendimento',
      hint: 'Abra um chat no WhatsApp para carregar a ficha do cliente.',
    };
  }

  const waName = await getWhatsAppName(chatId);
  const resolved = await resolveClientByChatId({
    chatId,
    fallbackWhatsAppName: waName,
    getPhoneForLid: getPhoneFromContactForLid,
  });

  if (resolved.isGroup) {
    return {
      kind: 'noChat',
      title: 'Atendimento',
      hint: 'Grupo detectado. Abra um chat individual para carregar o cliente.',
    };
  }

  const record = resolved.record;
  // “Sem banco” (modo de correção): se o WhatsApp tem um nome confiável, usar primeiro.
  const displayName = waName || pickStrongDisplayName(record, waName, resolved.phoneDigits);
  const phoneLabel = buildPhoneLabel(resolved.phoneDigits);
  const badges = buildClientBadges(record);
  const hasCadastro = !!record;

  const clientKey = String(record?.clientKey || resolved.phoneDigits || '').trim();

  // Pedidos ativos (abertos + aguardando pagamento)
  const activeOrders = clientKey ? await orderDB.listActiveByClientKey(clientKey, 3) : [];

  const orders = activeOrders.map((o) => ({
    id: o.orderId,
    title: `Pedido ${o.orderId.slice(0, 8)}`,
    subtitle: `${o.itemsSummary || 'Sem itens'}${typeof o.totalCents === 'number' ? ` • R$ ${(o.totalCents / 100).toFixed(2)}` : ''}`,
    status: mapOrderStatusLabel(o.status),
  }));

  // UI compacta (por enquanto ainda usa o mesmo ViewModel; a próxima etapa vai redesenhar)
  const notesInternal = String((record as any)?.notesInternal || '').trim();

  // Dados do módulo Retomar (contador + etiquetas)
  let retomarContadorValor = 0;
  let retomarEtiquetas: Array<{
    id: string;
    name: string;
    isMember: boolean;
    isDefault: boolean;
    color: string;
    memberCount: number;
  }> = [];

  try {
    const snapshot = await getRetomarSupportSnapshot(chatId);
    retomarContadorValor = snapshot.contador;
    retomarEtiquetas = snapshot.etiquetas;

    console.log('[ATENDIMENTO] Retomar dados carregados:', {
      accountId: snapshot.accountId,
      chatId,
      contador: retomarContadorValor,
      etiquetas: retomarEtiquetas.length,
      etiquetasAtivas: retomarEtiquetas.filter((e) => e.isMember).length,
    });
  } catch (error) {
    // Falha em carregar dados de Retomar não deve quebrar o Atendimento
    console.error('[ATENDIMENTO] Erro ao carregar dados de Retomar:', error);
    retomarContadorValor = 0;
    retomarEtiquetas = [];
  }

  let lastPurchase: {
    purchaseId: string;
    purchaseDate: string;
    value: number | null;
    items: string[] | null;
    notes: string | null;
    source: 'MANUAL' | 'AI_DETECTED';
  } | null = null;
  try {
    const last = await purchaseDB.getLastActiveByChatId(chatId);
    if (last) {
      lastPurchase = {
        purchaseId: last.purchaseId,
        purchaseDate: last.purchaseDateIso,
        value: last.value,
        items: last.items,
        notes: last.notes,
        source: last.source,
      };
    }
  } catch {
    // PurchaseDB pode não estar inicializado por usuário; manter null
  }

  return {
    kind: 'ready',
    customer: {
      displayName,
      phoneLabel,
      chatId,
      clientKey: clientKey || undefined,
      phoneDigits: resolved.phoneDigits || undefined,
      badges,
      hasCadastro,
    },
    // KPIs rápidos (placeholder até termos cálculo real)
    kpis: [
      { label: 'Aberto', value: String(activeOrders.filter(o => o.status === 'open').length) },
      { label: 'Pagto', value: String(activeOrders.filter(o => o.status === 'awaiting_payment').length) },
      { label: 'Status', value: 'Atendendo' },
    ],
    actions: [
      { id: 'order:new', label: 'Novo pedido', disabled: !clientKey },
      { id: 'order:continue', label: 'Continuar', disabled: activeOrders.length === 0 },
      { id: 'open-cadastro', label: 'Cadastro' },
      { id: 'notes:open', label: 'Notas' },
    ],
    // Produtos bem menores (vão virar mini-cards na UI compacta)
    products: [
      {
        id: 'p1',
        name: 'Produto do dia',
        priceLabel: '—',
        stockLabel: '',
        offerText: 'Tenho um produto do dia com condição especial. Quer que eu te envie?',
      },
    ],
    offers: [],
    orders,
    phrases: [
      { id: 'ph-need', label: 'Necessidade', text: 'É para hoje ou para outra data?' },
      { id: 'ph-address', label: 'Endereço', text: 'Pode confirmar seu endereço completo, por favor?' },
      { id: 'ph-pay', label: 'Pagamento', text: 'Você prefere PIX ou link de pagamento?' },
    ],
    notes: {
      value: notesInternal,
      placeholder: 'Notas internas (só no Mettri).',
    },
    retomar: {
      contador: retomarContadorValor,
      etiquetas: retomarEtiquetas,
    },
    lastPurchase,
  };
}

