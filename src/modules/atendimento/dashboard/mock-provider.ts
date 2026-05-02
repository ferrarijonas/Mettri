import type { AtendimentoViewModel } from './view-model';

/**
 * Provider MOCK do Atendimento.
 *
 * Metáfora: é um "boneco de treino" — ajuda a montar a UI antes do motor real.
 * Depois, trocamos este provider por um que lê WhatsApp + ClientDB + MessageDB.
 */
export async function getAtendimentoViewModelMock(): Promise<AtendimentoViewModel> {
  // Por enquanto, manter em modo demo para desenhar a UI completa.
  // Depois, o provider real vai retornar {kind:'noChat'} quando não houver chat ativo.
  const demo = true;

  if (!demo) {
    return {
      kind: 'noChat',
      title: 'Atendimento',
      hint: 'Abra um chat no WhatsApp para carregar a ficha do cliente.',
    };
  }

  return {
    kind: 'ready',
    demoBadge: 'DEMO',
    customer: {
      displayName: 'Cliente Exemplo',
      phoneLabel: '+55 11 99999-9999',
      chatId: '5511999999999@c.us',
      badges: ['Sem cadastro', 'Novo'],
      hasCadastro: false,
      tipoCliente: 'novo',
    },
    kpis: [
      { label: 'Último pedido', value: '—' },
      { label: 'Ticket médio', value: '—' },
      { label: 'Status', value: 'Em conversa' },
    ],
    actions: [
      { id: 'register-order', label: 'Registrar pedido' },
      { id: 'save-address', label: 'Salvar endereço' },
      { id: 'copy-data', label: 'Copiar dados' },
      { id: 'tag', label: 'Marcar tag' },
    ],
    products: [
      {
        id: 'p1',
        name: 'Pão de queijo (pacote)',
        priceLabel: 'R$ 19,90',
        stockLabel: 'Disponível',
        offerText: 'Tenho pão de queijo (pacote) por R$ 19,90 hoje. Quer reservar?',
      },
      {
        id: 'p2',
        name: 'Café especial 250g',
        priceLabel: 'R$ 34,90',
        stockLabel: 'Poucas unidades',
        offerText: 'Café especial 250g por R$ 34,90. Posso separar pra você?',
      },
      {
        id: 'p3',
        name: 'Combo do dia',
        priceLabel: 'R$ 49,90',
        stockLabel: 'Disponível',
        offerText: 'Combo do dia por R$ 49,90. Quer que eu envie os itens do combo?',
      },
    ],
    offers: [
      {
        id: 'o1',
        title: 'Oferta do dia',
        subtitle: 'Curta e direta',
        text: 'Hoje temos oferta especial: Combo do dia por R$ 49,90. Quer aproveitar?',
      },
      {
        id: 'o2',
        title: 'Reforço de confiança',
        subtitle: 'Pedir confirmação',
        text: 'Perfeito! Só confirmando: posso fechar seu pedido e te passar o total agora?',
      },
    ],
    orders: [
      { id: 'ord-1', title: 'Pedido #1024', subtitle: 'R$ 89,70 • 3 itens • 12/01', status: 'Entregue' },
      { id: 'ord-2', title: 'Pedido #1033', subtitle: 'R$ 49,90 • 1 item • 22/01', status: 'Cancelado' },
    ],
    phrases: [
      {
        id: 'ph-need',
        label: 'Perguntar necessidade',
        text: 'Me diz rapidinho: é para hoje ou para outra data?',
      },
      {
        id: 'ph-address',
        label: 'Confirmar endereço',
        text: 'Pode confirmar seu endereço completo (rua, número e bairro), por favor?',
      },
      {
        id: 'ph-pay',
        label: 'Pedir pagamento',
        text: 'Posso te mandar o link de pagamento ou você prefere PIX?',
      },
    ],
    notes: {
      value: '',
      placeholder: 'Notas internas (só no Mettri). Ex.: prefere entrega pela manhã.',
    },
    retomar: {
      contador: 2,
      etiquetas: [
        {
          id: 'never-send',
          name: 'Bloqueados',
          isMember: false,
          isDefault: true,
          color: '--tag-color-6',
          memberCount: 3,
        },
        {
          id: 'exclusivos',
          name: 'CNPJ',
          isMember: true,
          isDefault: true,
          color: '--tag-color-2',
          memberCount: 8,
        },
        {
          id: 'inativos',
          name: 'Inativos',
          isMember: false,
          isDefault: true,
          color: '--tag-color-5',
          memberCount: 12,
        },
      ],
    },
    lastPurchase: null,
    clienteContextoVitrine: {
      clienteId: '5511999999999',
      nome: 'Cliente Exemplo',
      telefone: '5511999999999',
      tags: [],
      ultimaCompra: {
        data: null,
        valor: null,
        itens: null,
        origem: null,
      },
      perfil: {
        segmento: null,
        confiancaPerfil: null,
        rfm: null,
      },
    },
    comercial: {
      modo: 'pedido_ativo',
      faltantes: [],
      pedidoConfirmado: true,
      slotsResumo:
        'Itens: 2× Pão de queijo · 1× Café 250g\n' +
        'Logística: Retirada\n' +
        'Horário: Hoje 17h\n' +
        'Valor: R$ 49,90 · PIX\n' +
        'Upsell: oferecido\n' +
        'Fecho: confirmado pelo cliente',
      mockLabel: 'DEMO · pedido completo',
    },
    funil: {
      etapas: [
        { id: 'produto', label: 'Produto', estado: 'ok', valor: 'Pão de queijo, Café 250g' },
        { id: 'endereco', label: 'Endereço', estado: 'ok', valor: 'Retirada' },
        { id: 'pagamento', label: 'Pagamento', estado: 'ok', valor: 'PIX' },
        { id: 'prazo', label: 'Prazo', estado: 'ok', valor: 'Hoje 17h' },
        { id: 'fechar', label: 'Fechar', estado: 'ok', valor: null },
      ],
      progresso: 100,
    },
    pedido: {
      itens: [
        { nomeExtraido: 'Pão de queijo', quantidade: 2, precoTotalCentavos: 3980 },
        { nomeExtraido: 'Café 250g', quantidade: 1, precoTotalCentavos: 3490 },
      ],
      subtotalCentavos: 7470,
      entregaCentavos: null,
      totalCentavos: 7470,
      status: 'fechado',
    },
    vitrine: [],
    proximaAcao: null,
    sugestaoTexto: '',
    sugestaoLoading: false,
    tipoConversa: 'compra_nova',
    pedidoAtual: null,
    historicoPedidos: [],
    metricaCliente: { ticketMedioCentavos: 0, frequencia: '—', totalPedidos: 0 },
    pendentesConfirmacao: [],
  };
}

