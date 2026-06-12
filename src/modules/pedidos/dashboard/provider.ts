import { orderDB } from '../../../storage/order-db';
import type { OrderRecordV2 } from '../../../storage/order-db';
import { clientDB } from '../../../storage/client-db';
import type { PedidosViewModel, PedidoCardVm, FiltroStatus } from './view-model';

function safeClientName(record: any): string {
  if (typeof record === 'object' && record !== null) {
    const name = record.nome || record.firstName || record.fullName || record.displayName || record.name;
    if (typeof name === 'string' && name.trim()) return name.trim();
    const key = record.clientKey || record.phoneDigits || '';
    return String(key).replace(/[@.]/g, '').slice(-8) || 'Cliente';
  }
  return 'Cliente';
}

function formatResumo(itens: PedidoCardVm['itens']): string {
  if (!itens.length) return '—';
  return itens
    .slice(0, 3)
    .map((i) => `${i.quantidade} ${i.nome.split(' ').slice(0, 2).join(' ')}`)
    .join(', ');
}

function toCentavos(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return 0;
}

function mapOrderToCard(r: OrderRecordV2, clienteNome: string): PedidoCardVm {
  const itens = (r.itens || []).map((i) => ({
    skuId: i.skuId,
    nome: i.nome,
    quantidade: i.quantidade,
    precoUnitarioCentavos: i.precoUnitarioCentavos,
    precoTotalCentavos: i.precoTotalCentavos,
  }));

  const statusMapped = (() => {
    if (r.status === 'closed') return 'completed' as const;
    return r.status as PedidoCardVm['status'];
  })();

  return {
    orderId: r.orderId,
    numeroSequencial: r.numeroSequencial || 0,
    clientKey: r.clientKey,
    clienteNome,
    chatId: r.chatId,
    status: statusMapped,
    intencao: r.intencao || 'outro',
    itensResumo: r.itemsSummary || formatResumo(itens),
    totalCentavos: toCentavos(r.totalCents),
    createdAtIso: r.createdAtIso,
    updatedAtIso: r.updatedAtIso,
    itens,
    funil: r.funil || {
      produto: { estado: 'pendente', valor: null },
      endereco: { estado: 'pendente', valor: null },
      pagamento: { estado: 'pendente', valor: null },
      prazo: { estado: 'pendente', valor: null },
      fechar: { estado: 'pendente', valor: null },
    },
    timeline: (r.timeline || []).map((t) => ({
      statusAnterior: t.statusAnterior as PedidoCardVm['timeline'][0]['statusAnterior'],
      statusNovo: t.statusNovo as PedidoCardVm['timeline'][0]['statusNovo'],
      iso: t.iso,
      motivo: t.motivo,
    })),
    observacoes: r.observacoes,
    pagamentoStatus: r.pagamentoStatus,
    pagamentoMetodo: r.pagamentoMetodo,
  };
}

export async function getPedidosViewModel(params?: {
  filtroStatus?: FiltroStatus;
  busca?: string;
}): Promise<PedidosViewModel> {
  const pedidosBrutos: PedidoCardVm[] = [];

  try {
    await orderDB.ensureReady();
    const todos = await orderDB.listAll(200);

    // Resolver nomes de clientes (batch com cache local)
    const nomeCache = new Map<string, string>();

    for (const r of todos) {
      let nome = nomeCache.get(r.clientKey);
      if (!nome) {
        try {
          const record = await clientDB.getByKey(r.clientKey);
          nome = safeClientName(record);
        } catch {
          nome = String(r.clientKey || '').replace(/[@.]/g, '').slice(-8) || 'Cliente';
        }
        nomeCache.set(r.clientKey, nome);
      }
      pedidosBrutos.push(mapOrderToCard(r, nome));
    }
  } catch (err) {
    console.error('[Pedidos] Erro ao carregar pedidos:', err);
    return { kind: 'error', message: 'Erro ao carregar pedidos do banco.' };
  }

  if (pedidosBrutos.length === 0) {
    return { kind: 'empty' };
  }

  // Ordenar por updatedAtIso descendente
  pedidosBrutos.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));

  // Aplicar filtro de status
  const filtroStatus: FiltroStatus = params?.filtroStatus || 'todos';
  let filtrados = pedidosBrutos;

  if (filtroStatus !== 'todos') {
    filtrados = pedidosBrutos.filter((p) => {
      if (filtroStatus === 'open') return p.status === 'open' || p.status === 'lead' || p.status === 'draft';
      return p.status === filtroStatus;
    });
  }

  // Aplicar busca textual
  if (params?.busca) {
    const termo = String(params.busca || '').trim().toLowerCase();
    if (termo) {
      filtrados = filtrados.filter(
        (p) =>
          p.clienteNome.toLowerCase().includes(termo) ||
          p.itensResumo.toLowerCase().includes(termo) ||
          String(p.numeroSequencial).includes(termo)
      );
    }
  }

  // Calcular métricas
  const totalAbertos = pedidosBrutos.filter((p) =>
    ['lead', 'draft', 'open', 'awaiting_payment'].includes(p.status)
  ).length;
  const aguardando = pedidosBrutos.filter((p) => p.status === 'awaiting_payment').length;

  const hoje = new Date().toISOString().slice(0, 10);
  const totalHojeCentavos = pedidosBrutos
    .filter((p) => p.status === 'completed' && p.createdAtIso.startsWith(hoje))
    .reduce((s, p) => s + p.totalCentavos, 0);

  const completos = pedidosBrutos.filter((p) => p.status === 'completed');
  const ticketMedioCentavos =
    completos.length > 0
      ? Math.round(completos.reduce((s, p) => s + p.totalCentavos, 0) / completos.length)
      : 0;

  return {
    kind: 'ready',
    filtroStatus,
    metricas: {
      totalAbertos,
      aguardandoPagamento: aguardando,
      totalHojeCentavos,
      ticketMedioCentavos,
    },
    pedidos: filtrados,
    busca: params?.busca || '',
  };
}
