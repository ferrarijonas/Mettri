import { z } from 'zod';
import type { Tool } from '../types';
import { deliveryService } from '../../../infrastructure/delivery/delivery-service';
import { BeeDeliveryAdapter } from '../../../infrastructure/delivery/bee-delivery-adapter';

export const consultarSaldoBee: Tool = {
  nome: 'consultar_saldo_bee',
  descricao:
    'Consulta o saldo atual da conta Bee Delivery.\n' +
    'QUANDO USAR:\n' +
    '  - Cliente perguntou se tem saldo para entrega\n' +
    '  - Ao tentar solicitar entrega e receber erro de saldo insuficiente\n' +
    '  - Cliente perguntou sobre taxas ou custos de entrega\n' +
    'QUANDO NÃO USAR:\n' +
    '  - Cliente está perguntando preço de produto (use consultar_catalogo)\n' +
    'EXEMPLOS:\n' +
    '  - consultar_saldo_bee() → {saldo: 5.05}\n' +
    '  - consultar_saldo_bee() com sessão expirada → erro: precisa logar na Bee Delivery',
  categoria: 'leitura',
  inputSchema: z.object({}).describe('Nenhum parâmetro necessário'),
  executar: async () => {
    try {
      const beeAdapter = deliveryService.getAdapter('bee-delivery');
      if (!beeAdapter || !(beeAdapter instanceof BeeDeliveryAdapter)) {
        return { sucesso: false, erro: 'Adapter Bee Delivery não disponível.' };
      }

      const saldo = await beeAdapter.consultarSaldo();
      return {
        sucesso: true,
        dados: { saldo },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        sucesso: false,
        erro: message,
      };
    }
  },
  soLeitura: true,
  precisaConfirmacao: false,
};
