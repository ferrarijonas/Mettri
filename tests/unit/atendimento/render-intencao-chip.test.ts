import { describe, it, expect } from 'vitest';
import { AtendimentoPanel } from '../../../src/modules/atendimento/dashboard/atendimento-panel';
import type { AtendimentoViewModel } from '../../../src/modules/atendimento/dashboard/view-model';

/**
 * Testa renderIntencaoChip() (chip de intenção) e renderOrderPill()
 * (pastilha "Pedido #33232") do AtendimentoPanel.
 */
describe('AtendimentoPanel.renderIntencaoChip', () => {
  function createPanel(vm: AtendimentoViewModel | null): AtendimentoPanel {
    const panel = new AtendimentoPanel();
    (panel as any).vm = vm;
    (panel as any).container = document.createElement('div');
    (panel as any).onAction = () => {};
    return panel;
  }

  it('deve exibir chip "Nova compra" + pill "Pedido #0042" quando pedido ativo existe', () => {
    const panel = createPanel({
      kind: 'ready',
      tipoConversa: 'compra_nova',
      pedidoAtual: {
        orderId: 'ord_123456_abc',
        clientKey: 'client_1',
        status: 'draft',
        numeroSequencial: 42,
        itens: [],
        totalCentavos: 5000,
        funil: {
          produto: { estado: 'ok', valor: null },
          endereco: { estado: 'pendente', valor: null },
          pagamento: { estado: 'pendente', valor: null },
          prazo: { estado: 'pendente', valor: null },
          fechar: { estado: 'pendente', valor: null },
        },
      },
    } as AtendimentoViewModel);

    const html = (panel as any)['renderIntencaoChip']();

    // Chip de intenção
    expect(html).toContain('Nova compra');

    // Pill do pedido — formato "Pedido #0042"
    expect(html).toContain('Pedido #0042');
    expect(html).toContain('font-mono');
    expect(html).toContain('tabular-nums');
    expect(html).toContain('rounded-lg');
    expect(html).toContain('bg-card');
  });

  it('deve exibir apenas o chip sem pill quando pedidoAtual é null', () => {
    const panel = createPanel({
      kind: 'ready',
      tipoConversa: 'duvida',
      pedidoAtual: null,
    } as unknown as AtendimentoViewModel);

    const html = (panel as any)['renderIntencaoChip']();

    expect(html).toContain('Dúvida');
    expect(html).not.toContain('Pedido');
  });

  it('deve retornar string vazia quando vm.kind não é ready', () => {
    const panel = createPanel({
      kind: 'noChat',
      tipoConversa: null,
      pedidoAtual: null,
    } as unknown as AtendimentoViewModel);

    const html = (panel as any)['renderIntencaoChip']();
    expect(html).toBe('');
  });

  it('deve retornar string vazia chip não reconhecido', () => {
    const panel = createPanel({
      kind: 'ready',
      tipoConversa: null,
      pedidoAtual: null,
    } as unknown as AtendimentoViewModel);

    const html = (panel as any)['renderIntencaoChip']();
    expect(html).toBe('');
  });
});

describe('AtendimentoPanel.renderOrderPill', () => {
  function createPanel(vm: AtendimentoViewModel | null): AtendimentoPanel {
    const panel = new AtendimentoPanel();
    (panel as any).vm = vm;
    (panel as any).container = document.createElement('div');
    (panel as any).onAction = () => {};
    return panel;
  }

  it('deve retornar pill "Pedido #33232" formatada quando pedido ativo', () => {
    const panel = createPanel({
      kind: 'ready',
      tipoConversa: 'compra_nova',
      pedidoAtual: {
        orderId: 'ord_abc',
        clientKey: 'c1',
        status: 'draft',
        numeroSequencial: 33232,
        itens: [],
        totalCentavos: 1000,
        funil: {
          produto: { estado: 'ok', valor: null },
          endereco: { estado: 'pendente', valor: null },
          pagamento: { estado: 'pendente', valor: null },
          prazo: { estado: 'pendente', valor: null },
          fechar: { estado: 'pendente', valor: null },
        },
      },
    } as AtendimentoViewModel);

    const html = (panel as any)['renderOrderPill']();
    expect(html).toContain('Pedido #33232');
    expect(html).toContain('font-mono');
    expect(html).toContain('tabular-nums');
    expect(html).toContain('rounded-lg');
    expect(html).toContain('bg-card');
  });

  it('deve retornar string vazia quando pedidoAtual é null', () => {
    const panel = createPanel({
      kind: 'ready',
      tipoConversa: 'duvida',
      pedidoAtual: null,
    } as unknown as AtendimentoViewModel);

    const html = (panel as any)['renderOrderPill']();
    expect(html).toBe('');
  });

  it('deve retornar string vazia quando vm.kind não é ready', () => {
    const panel = createPanel({
      kind: 'noChat',
      tipoConversa: null,
      pedidoAtual: null,
    } as unknown as AtendimentoViewModel);

    const html = (panel as any)['renderOrderPill']();
    expect(html).toBe('');
  });
});
