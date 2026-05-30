import { orderDB } from '../../../storage/order-db';
import type { OrderRecordV2 } from '../../../storage/order-db';
import { messageDB } from '../../../storage/message-db';
import { purchaseDB } from '../../../storage/purchase-db';
import { digitsOnly } from '../../../storage/client-db';
import { customerProfileDB } from '../../../storage/customer-profile-db';
import { catalogoDB } from '../../../storage/catalogo-db';
import { whatsappInterceptors } from '../../../infrastructure/whatsapp-interceptors';
import type { AtendimentoViewModel, FunilEtapa, PedidoItemAuto, ProximaAcao, VitrineItemUi, IntencaoTipo, PedidoResumoVm, MetricaClienteVm, SugestaoAmbiguidadeVm } from './view-model';
import { criarClienteContextoVitrine, fornecerFichaClienteParaAtendimento } from '../../cadastro';
import {
  buildClientBadges,
  buildPhoneLabel,
  pickStrongDisplayName,
  resolveClientByChatId,
} from './client-resolver';
import { getRetomarSupportSnapshot } from './retomar-support';

/** Horas após a 1ª msg do cliente capturada em que ainda orientamos tom de “primeiro contato” para o agente (chip pode ser Contato). */
const RELACIONAMENTO_INICIAL_HORAS = 48;

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
  if (status === 'closed' || status === 'completed') return 'Completo';
  if (status === 'lead') return 'Lead';
  if (status === 'draft') return 'Draft';
  if (status === 'cancelled') return 'Cancelado';
  if (status === 'lost') return 'Perdido';
  return status;
}

// ── Intenção via ouvinte-llm ──
// classificarIntencao() e TRIGGERS removidos — a classificação agora é feita
// pelo ouvinte-llm (DeepSeek) junto com a extração de perfil.

function orderRecordToResumoVm(r: OrderRecordV2): PedidoResumoVm {
  return {
    orderId: r.orderId,
    numeroSequencial: r.numeroSequencial || 0,
    status: (() => {
      if (r.status === 'closed') return 'completed';
      return r.status as PedidoResumoVm['status'];
    })(),
    intencao: r.intencao || 'outro',
    itens: (r.itens || []).map((i) => ({
      skuId: i.skuId,
      nome: i.nome,
      quantidade: i.quantidade,
      precoUnitarioCentavos: i.precoUnitarioCentavos,
      precoTotalCentavos: i.precoTotalCentavos,
    })),
    subtotalCentavos: (r.itens || []).reduce((s, i) => s + i.precoTotalCentavos, 0),
    entregaCentavos: 0,
    totalCentavos: r.totalCents || 0,
    funil: r.funil || {
      produto: { estado: 'pendente', valor: null },
      endereco: { estado: 'pendente', valor: null },
      pagamento: { estado: 'pendente', valor: null },
      prazo: { estado: 'pendente', valor: null },
      fechar: { estado: 'pendente', valor: null },
    },
    timeline: (r.timeline || []).map((t) => ({
      statusAnterior: t.statusAnterior as PedidoResumoVm['timeline'][0]['statusAnterior'],
      statusNovo: t.statusNovo as PedidoResumoVm['timeline'][0]['statusNovo'],
      iso: t.iso,
      motivo: t.motivo,
    })),
    observacoes: r.observacoes,
    pagamentoStatus: r.pagamentoStatus,
    pagamentoMetodo: r.pagamentoMetodo,
    createdAtIso: r.createdAtIso,
    updatedAtIso: r.updatedAtIso,
  };
}

function calcularMetricasCliente(historico: PedidoResumoVm[]): MetricaClienteVm {
  const completos = historico.filter((p) => p.status === 'completed');
  const totalPedidos = completos.length;

  const ticketMedioCentavos = totalPedidos > 0
    ? Math.round(completos.reduce((s, p) => s + p.totalCentavos, 0) / totalPedidos)
    : 0;

  let frequencia = '—';
  if (totalPedidos >= 2) {
    const ordenados = [...completos].sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso));
    const primeiro = new Date(ordenados[0].createdAtIso).getTime();
    const ultimo = new Date(ordenados[ordenados.length - 1].createdAtIso).getTime();
    const diasTotal = Math.max(1, (ultimo - primeiro) / 86400000);
    const freqDias = Math.round(diasTotal / totalPedidos);
    if (freqDias < 1) frequencia = 'hoje';
    else if (freqDias <= 3) frequencia = `${totalPedidos}x/semana`;
    else if (freqDias <= 14) frequencia = '1x/semana';
    else if (freqDias <= 60) frequencia = '1x/mês';
    else frequencia = 'esporádico';
  }

  return { ticketMedioCentavos, frequencia, totalPedidos };
}

export async function getAtendimentoViewModel(params?: {
  chatId?: string | null
  updatedFields?: string[]
  confiancaPerfil?: number
  intencao?: string  // vinda do ouvinte-llm, substitui classificarIntencao()
}): Promise<AtendimentoViewModel> {
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
  const fichaResult = await fornecerFichaClienteParaAtendimento(
    chatId,
    {
      getClientByChatId: async () => resolved.record,
      getLastPurchaseByChatId: async (resolvedChatId: string) => await purchaseDB.getLastActiveByChatId(resolvedChatId),
      getOperationalProfile: async (cid: string) => {
        const perfil = await customerProfileDB.getByChatId(cid);
        return perfil;
      },
    },
    { allowPartialOnError: true },
  );

  const ficha = fichaResult.ok
    ? fichaResult.data
    : {
        chatId,
        cadastro: null,
        ultimaCompra: null,
        perfilOperacional: null,
        flags: { cadastroUtil: false },
      };

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
  const hasCadastro = ficha.flags.cadastroUtil;

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
  let retomarEtiquetas: {
    id: string;
    name: string;
    isMember: boolean;
    isDefault: boolean;
    color: string;
    memberCount: number;
  }[] = [];

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

  const lastPurchase = ficha.ultimaCompra
    ? {
        purchaseId: ficha.ultimaCompra.purchaseId,
        purchaseDate: ficha.ultimaCompra.purchaseDateIso,
        value: ficha.ultimaCompra.value,
        items: ficha.ultimaCompra.items,
        notes: ficha.ultimaCompra.notes,
        source: ficha.ultimaCompra.source,
      }
    : null;
  const clienteContextoVitrine = criarClienteContextoVitrine(ficha);

  const perfil = ficha.perfilOperacional;

  let temCapturaConversa = false;
  try {
    const amostra = await messageDB.getMessages(chatId, 1);
    temCapturaConversa = amostra.length > 0;
  } catch {
    temCapturaConversa = false;
  }

  let comprasAtivasCount = 0;
  try {
    comprasAtivasCount = (await purchaseDB.listActiveByChatId(chatId)).length;
  } catch {
    comprasAtivasCount = ficha.ultimaCompra ? 1 : 0;
  }

  let relacionamentoInicialParaAgente = false;
  if (comprasAtivasCount === 0) {
    try {
      const primeiraInbound = await messageDB.getFirstIncomingCapturedAtForChat(chatId);
      if (primeiraInbound) {
        const limite = RELACIONAMENTO_INICIAL_HORAS * 60 * 60 * 1000;
        relacionamentoInicialParaAgente = Date.now() - primeiraInbound.getTime() < limite;
      }
    } catch {
      relacionamentoInicialParaAgente = false;
    }
  }

  const tipoCliente: 'novo' | 'contato' | 'ativo' | 'recorrente' | null = (() => {
    if (comprasAtivasCount === 0) {
      if (!temCapturaConversa) return 'novo';
      return relacionamentoInicialParaAgente ? 'novo' : 'contato';
    }
    if (comprasAtivasCount === 1) return 'ativo';
    return 'recorrente';
  })();

  /** Pedido automático: itens do Ouvinte + match catálogo */
  const pedido = await buildPedidoAuto(perfil);
  /** Vitrine inline: outros produtos ativos do catálogo (cross-sell) */
  const vitrine = await buildVitrineInline(perfil, pedido.itens);

  // ── Intenção (do ouvinte-llm) + OrderDB ──
  // A intenção vem do LLM via ouvinte (evento ouvire:profile-updated).
  // Se o ouvinte não classificou (ex: throttle, sem API key), fallback para 'outro'.

  const intencao = (params?.intencao as IntencaoTipo | undefined) || 'outro';
  const pedidosAtivos = clientKey ? await orderDB.listActiveByClientKey(clientKey, 5) : [];

  // Pedido atual: o mais recente entre os ativos
  let pedidoAtual: PedidoResumoVm | null = null;
  if (pedidosAtivos.length > 0) {
    pedidoAtual = orderRecordToResumoVm(pedidosAtivos[0]);
  } else if (intencao === 'compra_nova' && clientKey) {
    // Criar pedido lead automaticamente
    try {
      const novoPedido = await orderDB.createOrder({
        clientKey,
        chatId,
        intencao: 'compra_nova',
      });
      pedidoAtual = orderRecordToResumoVm(novoPedido);
    } catch { /* silencioso */ }
  }

  // Histórico de pedidos (completed + cancelled)
  let historicoPedidos: PedidoResumoVm[] = [];
  if (clientKey) {
    try {
      const todos = await orderDB.listByClientKey(clientKey, 10);
      historicoPedidos = todos
        .filter((r) => r.status === 'completed' || r.status === 'closed' || r.status === 'cancelled')
        .map((r) => orderRecordToResumoVm(r));
    } catch { /* silencioso */ }
  }

  const metricaCliente = calcularMetricasCliente(historicoPedidos);

  const sugestaoAmbiguidade = buildSugestaoAmbiguidade(perfil);

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
      tipoCliente,
      ...(relacionamentoInicialParaAgente ? { relacionamentoInicialParaAgente: true } : {}),
      aversoesProduto: perfil?.aversoesProduto,
      enderecoEntrega: perfil?.enderecoEntrega,
      formaPagamentoPreferida: perfil?.formaPagamentoPreferida,
      urgenciaEntrega: perfil?.urgenciaEntrega,
      observacoesLogisticas: perfil?.observacoesLogisticas,
      camposConfianca: perfil?.camposConfianca,
      preferenciasProduto: perfil?.preferenciasProduto,
      updatedFields: params?.updatedFields,
      confiancaPerfil: params?.confiancaPerfil ?? perfil?.confiancaPerfil,
      timeline: buildTimeline(perfil, resolved.phoneDigits),
    },
    /** Classificação da intenção da conversa (vinda do ouvinte-llm) */
    tipoConversa: intencao,
    /** Pedido atual do cliente, persistido no OrderDB */
    pedidoAtual,
    /** Últimos N pedidos do cliente */
    historicoPedidos,
    /** Métricas do cliente */
    metricaCliente,
    /** Funil automático: 5 etapas, cada uma acende quando Ouvinte captura */
    funil: (() => {
      const etapas: FunilEtapa[] = [
        { id: 'produto', label: 'Produto', estado: 'pendente', valor: null },
        { id: 'endereco', label: 'Endereço', estado: 'pendente', valor: null },
        { id: 'pagamento', label: 'Pagamento', estado: 'pendente', valor: null },
        { id: 'prazo', label: 'Prazo', estado: 'pendente', valor: null },
        { id: 'fechar', label: 'Fechar', estado: 'pendente', valor: null },
      ];
      if (perfil?.preferenciasProduto?.length) {
        const ep = etapas.find(e => e.id === 'produto')!;
        ep.estado = 'ok';
        ep.valor = perfil.preferenciasProduto.join(', ');
      }
      if (perfil?.enderecoEntrega) {
        const ep = etapas.find(e => e.id === 'endereco')!;
        ep.estado = 'ok';
        ep.valor = perfil.enderecoEntrega;
      }
      if (perfil?.formaPagamentoPreferida?.length) {
        const ep = etapas.find(e => e.id === 'pagamento')!;
        ep.estado = 'ok';
        ep.valor = perfil.formaPagamentoPreferida.join(', ');
      }
      if (perfil?.urgenciaEntrega) {
        const ep = etapas.find(e => e.id === 'prazo')!;
        ep.estado = 'ok';
        ep.valor = perfil.urgenciaEntrega;
      }
      const okCount = etapas.filter(e => e.estado === 'ok').length;
      return { etapas, progresso: Math.round((okCount / 5) * 100) };
    })(),
    /** Pedido automático: itens do Ouvinte + match catálogo */
    pedido,
    /** Vitrine inline (recomendações) */
    vitrine,
    /** Sugestão de produto por ambiguidade */
    sugestaoAmbiguidade,
    /** Debug info do Ouvinte (para testes E2E) */
    ouvinteDebug: {
      ultimaMensagemProcessada: (perfil as any)?.ultimaMensagemProcessada,
      camposExtraidos: perfil?.preferenciasProduto?.map(v => ({ campo: 'preferenciasProduto', valor: v, confianca: perfil?.camposConfianca?.preferenciasProduto || 'media' })),
      sugestaoPendente: sugestaoAmbiguidade ?? undefined,
    },
    /** Pendências de confirmação */
    pendentesConfirmacao: perfil?.pendentesConfirmacao ?? [],
    /** Próxima ação: o que está pendente no funil */
    proximaAcao: buildProximaAcao(perfil),
    /** Sugestão de texto (preenchida pelo LLM após gerar) */
    sugestaoTexto: '',
    sugestaoLoading: false,
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
    clienteContextoVitrine,
    comercial: {
      modo: activeOrders.length > 0 ? 'pedido_ativo' : 'pre_venda',
      faltantes: [],
      pedidoConfirmado: false,
    },
  };
}

function buildTimeline(perfil: any, phoneDigits: string | undefined | null): string[] {
  const items: string[] = []
  if (perfil?.historico?.compras90d && perfil.historico.compras90d > 0) {
    items.push(`${perfil.historico.compras90d} compras`)
  }
  if (perfil?.formaPagamentoPreferida?.length) {
    items.push(perfil.formaPagamentoPreferida.join(', ').toUpperCase())
  }
  if (perfil?.comportamento?.janelaAtiva) {
    items.push(perfil.comportamento.janelaAtiva)
  }
  if (perfil?.preferenciasProduto?.length) {
    items.push(perfil.preferenciasProduto.join(', '))
  }
  if (perfil?.sensibilidadeOferta) {
    items.push(`oferta ${perfil.sensibilidadeOferta}`)
  }
  return items
}

/** Normaliza texto para comparação (NFD, lowercase, trim). */
function normalizeText(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Extrai quantidade do início de um nome de produto. Ex: "dois de abobora" → { qty: 2, nome: "abobora" } */
function parseQuantidade(nome: string): { qty: number; nome: string } {
  const numerais: Record<string, number> = {
    um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3,
    quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
    meia: 0.5, meio: 0.5,
  }
  const trimmed = nome.trim()

  // Formato "produto (Nx)"
  const parenQtd = trimmed.match(/^(.+?)\s*\((\d+)x\)\s*$/i)
  if (parenQtd) {
    return { qty: parseInt(parenQtd[2], 10), nome: parenQtd[1].trim() }
  }

  // Formato "N produto"
  const matchDigitos = trimmed.match(/^(\d+)\s+(.+)/)
  if (matchDigitos) {
    return { qty: parseInt(matchDigitos[1], 10), nome: matchDigitos[2].trim() }
  }

  // Formato "dois de produto" / "dois produto"
  const words = trimmed.split(/\s+/)
  const firstWord = normalizeText(words[0])
  if (numerais[firstWord] !== undefined) {
    const rest = words.slice(1).join(' ').trim()
    const cleanRest = rest.replace(/^de\s+/i, '')
    return { qty: numerais[firstWord], nome: cleanRest || rest }
  }
  return { qty: 1, nome: trimmed }
}

/** Busca produto no catálogo com match fuzzy (exato → contém → parcial). */
function buscarProdutoCatalogo(
  texto: string,
  produtos: Array<{ productId: string; nome: string; precoCentavos: number }>
): { productId: string; nome: string; precoCentavos: number } | null {
  const norm = normalizeText(texto)
  if (!norm || produtos.length === 0) return null

  // Tier 1: exato
  for (const p of produtos) {
    if (normalizeText(p.nome) === norm) return p
  }
  // Tier 2: contém
  for (const p of produtos) {
    const pn = normalizeText(p.nome)
    if (pn.includes(norm) || norm.includes(pn)) return p
  }
  // Tier 3: parcial (>=50% palavras >3 chars batem)
  const palavras = norm.split(/\s+/).filter(w => w.length > 3)
  if (palavras.length > 0) {
    for (const p of produtos) {
      const pn = normalizeText(p.nome)
      const matchCount = palavras.filter(w => pn.includes(w)).length
      if (matchCount / palavras.length >= 0.5) return p
    }
  }
  return null
}

/** Filler/hesitação — mesmo filtro do Ouvinte */
const NUM_EXTENSO_PROVIDER: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
}

function normalizeProdutoNome(texto: string): string {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
}

/** Extrai "N de produto" de um chunk, limpando fillers. */
function extrairProdutoDeChunk(chunk: string): string[] {
  const c = chunk.trim()
  if (c.length < 3) return []

  // Pula fillers conhecidos
  const fillerStarts = ['qte pedir', 'qte', 'te pedir', 'te perguntar', 'uma coisa',
    'quero ver', 'deixa eu ver', 'vou te falar', 'tipo assim', 'entendeu', 'entao',
    'ahn', 'hmm', 'hum', 'olha', 'olhe', 'veja', 'vou te perguntar', 'vou te contar',
    'sabe o que', 'cê entendeu', 'entende', 'é o seguinte', 'olha só', 'depois',
    'antes', 'agora', 'sempre', 'so', 'ver']
  const lower = c.toLowerCase()
  if (fillerStarts.some(f => lower.startsWith(f))) return []

  // Tenta extrair quantidade + nome
  // "10 de abobra" ou "dois de abobora"
  const comQtd = c.match(/^(\d+)\s*(?:de\s+)?(.+)$/i)
  if (comQtd) return [`${comQtd[2].trim()} (${parseInt(comQtd[1], 10)}x)`]

  // Número por extenso
  const partes = lower.split(/\s+/)
  const num = NUM_EXTENSO_PROVIDER[partes[0]]
  if (num) {
    const resto = partes.slice(1).join(' ').replace(/^de\s+/i, '')
    return resto.length > 2 ? [`${resto} (${num}x)`] : []
  }

  return [c]
}

/** Varre o texto de uma mensagem e extrai menções a produtos. 
 *  Espelha a lógica do Ouvinte, mas escaneia TODAS as mensagens (inclusive outgoing).
 *  Usa matchAll para capturar múltiplas menções num mesmo texto longo. */
function extrairProdutosDeTexto(texto: string): string[] {
  const t = (texto || '').trim()
  if (!t || t.length < 4) return []

  const resultados: string[] = []

  // Tier 1: padrões de intenção de compra (matchAll)
  const patterns = [
    /(?:gosto de|gostaria de|quero|vou querer|vou pedir|pedir|quisesse|queria)\s+(.+?)(?:\.|,|;|$| para| pra| por favor|\?)/gi,
    /(?:você tem|vocês tem|tu tem|vende|tem como)\s+(.+?)(?:\.|,|;|\?|$)/gi,
    /(?:quanto é|qual o preço|qual é o preço|qual o valor|qual é o valor|preço do|preço da|valor do|valor da)\s+(.+?)(?:\.|,|;|\?|$)/gi,
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(t)) !== null) {
      if (m[1]) {
        const raw = m[1].trim()
        const partes = raw.split(/\s+e\s+/)
        for (const parte of partes) {
          resultados.push(...extrairProdutoDeChunk(parte))
        }
      }
    }
  }
  if (resultados.length > 0) return [...new Set(resultados)]

  // Tier 2: padrão "número + nome" no texto inteiro
  const reQtd = /(\d+)\s*(?:de\s+)?([\wà-ú%]+(?:\s+[\wà-ú%]+){0,4})(?=\s*[,;.!?]|\s+e\s+|$)/gi
  let qm: RegExpExecArray | null
  while ((qm = reQtd.exec(t)) !== null) {
    const nome = qm[2].trim()
    if (nome.length > 2) {
      resultados.push(`${nome} (${parseInt(qm[1], 10)}x)`)
    }
  }
  if (resultados.length > 0) return [...new Set(resultados)]

  // Tier 3: padrões de OFERTA do atendente (não só compra)
  const offerPatterns = [
    /(?:hoje|temos|agora|nesse\s+momento|nessa\s+hora)\s+(?:tem|que|vai|dispõe|disponível)\s+(.+?)(?:\.|,|;|$| e | com |$)/gi,
    /(?:tenho|tenha)\s+(?:disponível|à\s+venda)\s+(.+?)(?:\.|,|;|$| e )/gi,
    /(?:no\s+cardápio|tem\s+no\s+cardápio)\s+(?:hoje|agora)?\s*(.+?)(?:\.|,|;|$| e )/gi,
  ]
  for (const re of offerPatterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(t)) !== null) {
      if (m[1]) {
        const raw = m[1].trim()
        const partes = raw.split(/\s+e\s+/)
        for (const parte of partes) {
          resultados.push(...extrairProdutoDeChunk(parte))
        }
      }
    }
  }
  if (resultados.length > 0) return [...new Set(resultados)]

  return []
}

async function buildPedidoAuto(perfil: any): Promise<{
  itens: PedidoItemAuto[]
  subtotalCentavos: number
  entregaCentavos: number | null
  totalCentavos: number
  status: 'aberto' | 'fechado'
}> {
  const itens: PedidoItemAuto[] = []

  // Carregar catálogo
  let produtosCatalogo: Array<{ productId: string; nome: string; precoCentavos: number }> = []
  try {
    const accountId = catalogoDB.getCurrentUserWid() || 'default'
    const todos = await catalogoDB.listByAccount(accountId)
    produtosCatalogo = todos
      .filter(p => p.ativo)
      .map(p => ({ productId: p.productId, nome: p.nome, precoCentavos: p.precoCentavos }))
  } catch {
    // Catálogo indisponível — itens sem preço
  }

  // Coletar menções de produtos: perfil operacional + escaneamento do histórico
  const todosNomes = new Set<string>()

  // 1. Do perfil operacional (acumulado pelo Ouvinte)
  if (perfil?.preferenciasProduto?.length) {
    for (const nome of perfil.preferenciasProduto) {
      todosNomes.add(String(nome))
    }
  }

  // 2. Do histórico de mensagens (varredura direta, ignora direção)
  //    Janela: apenas mensagens após o último pedido fechado (se houver)
  if (perfil?.chatId) {
    try {
      let sinceTimestamp: number | null = null
      try {
        const lastPurchase = await purchaseDB.getLastActiveByChatId(perfil.chatId)
        if (lastPurchase?.purchaseDateIso) {
          sinceTimestamp = new Date(lastPurchase.purchaseDateIso).getTime()
        }
      } catch {
        // Sem purchaseDB ou sem pedido anterior → escaneia tudo
      }

      const msgs = await messageDB.getMessages(perfil.chatId, 100)
      for (const msg of msgs) {
        if (sinceTimestamp && msg.timestamp.getTime() <= sinceTimestamp) continue
        const extraidos = extrairProdutosDeTexto(msg.text)
        for (const nome of extraidos) {
          todosNomes.add(nome)
        }
      }
    } catch {
      // Silencioso: se o messageDB falhar, usamos só o perfil
    }
  }

  // 3. Fallback: escanear DOM diretamente (captura mensagens que o MessageCapturer truncou)
  try {
    const msgElements = document.querySelectorAll('[data-id]')
    for (const el of msgElements) {
      const text = (el.textContent || '').trim()
      if (text.length < 4) continue
      const extraidos = extrairProdutosDeTexto(text)
      for (const nome of extraidos) {
        todosNomes.add(nome)
      }
    }
  } catch {
    // DOM inacessível (ex: chat não carregado)
  }

  if (todosNomes.size > 0) {
    const catalogados = new Set<string>()
    for (const rawNome of todosNomes) {
      const { qty, nome } = parseQuantidade(String(rawNome))
      const match = buscarProdutoCatalogo(nome, produtosCatalogo)

      if (match && !catalogados.has(match.productId)) {
        catalogados.add(match.productId)
        itens.push({
          nomeExtraido: nome,
          quantidade: qty,
          precoTotalCentavos: match.precoCentavos * qty,
          produtoCatalogo: {
            productId: match.productId,
            nome: match.nome,
            precoCentavos: match.precoCentavos,
          },
        })
      }
    }
  }

  const subtotal = itens.reduce((sum, i) => sum + i.precoTotalCentavos, 0)
  const entrega = 0
  return {
    itens,
    subtotalCentavos: subtotal,
    entregaCentavos: entrega || null,
    totalCentavos: subtotal + (entrega || 0),
    status: 'aberto',
  }
}

/** Monta vitrine inline com produtos do catálogo não incluídos no pedido atual. */
async function buildVitrineInline(perfil: any, itensPedido: PedidoItemAuto[]): Promise<VitrineItemUi[]> {
  const accountId = catalogoDB.getCurrentUserWid() || 'default'
  let todos: Array<{ productId: string; nome: string; precoCentavos: number }> = []
  try {
    const raw = await catalogoDB.listByAccount(accountId)
    todos = raw
      .filter(p => p.ativo)
      .map(p => ({ productId: p.productId, nome: p.nome, precoCentavos: p.precoCentavos }))
  } catch {
    return []
  }

  const idsNoPedido = new Set(
    itensPedido
      .filter(i => i.produtoCatalogo?.productId)
      .map(i => i.produtoCatalogo!.productId)
  )

  const disponiveis = todos.filter(p => !idsNoPedido.has(p.productId))
  if (disponiveis.length === 0) return []

  return disponiveis.slice(0, 3).map(p => ({
    productId: p.productId,
    nome: p.nome,
    precoCentavos: p.precoCentavos,
    score: 5,
    motivo: 'Também disponível no catálogo',
  }))
}

function buildProximaAcao(perfil: any): ProximaAcao | null {
  if (!perfil?.preferenciasProduto?.length) {
    return { label: 'Perguntar o que deseja', sugestaoTexto: 'Oi! O que você gostaria de pedir hoje?' }
  }
  if (!perfil?.enderecoEntrega) {
    return { label: 'Perguntar endereço', sugestaoTexto: 'Certo! Qual o endereço de entrega?' }
  }
  if (!perfil?.formaPagamentoPreferida?.length) {
    return { label: 'Confirmar pagamento', sugestaoTexto: 'Como você prefere pagar? PIX ou cartão?' }
  }
  if (!perfil?.urgenciaEntrega) {
    return { label: 'Confirmar prazo', sugestaoTexto: 'Para quando você precisa? Hoje ou outro dia?' }
  }
  return { label: 'Fechar pedido', sugestaoTexto: 'Tudo certo! Posso confirmar o pedido?' }
}

function buildSugestaoAmbiguidade(perfil: any): SugestaoAmbiguidadeVm | null {
  const sugestoes = perfil?.sugestoesPendentes
  if (!sugestoes || sugestoes.length === 0) return null

  const s = sugestoes[0]
  return {
    nome: s.nome,
    qtd: s.qtd,
    nomeExtraido: s.nomeExtraido,
    confianca: s.confianca,
    metodo: s.metodo,
    evidencia: s.evidencia,
    fraseContexto: `Cliente disse "${s.evidencia.length > 40 ? s.evidencia.slice(0, 40) + '...' : s.evidencia}"`,
  }
}

