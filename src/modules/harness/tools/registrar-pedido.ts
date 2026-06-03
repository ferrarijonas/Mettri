import { z } from 'zod';
import type { Tool } from '../types';
import { orderDB } from '../../../storage/order-db';

const ItemSchema = z.object({
  nome: z.string().min(1).describe('Nome do produto'),
  quantidade: z.number().int().positive().describe('Quantidade'),
  preco: z.number().nonnegative().describe('Preço unitário em reais'),
});

export const registrarPedido: Tool = {
  nome: 'registrar_pedido',
  descricao:
    'Cria um novo pedido com os itens especificados para o cliente. Retorna o ID do pedido criado.',
  categoria: 'escrita',
  inputSchema: z.object({
    chatId: z.string().describe('ID do chat do cliente'),
    itens: z
      .array(ItemSchema)
      .min(1)
      .describe('Lista de itens do pedido'),
  }),
  executar: async (input) => {
    const { chatId, itens } = input as {
      chatId: string;
      itens: { nome: string; quantidade: number; preco: number }[];
    };
    try {
      // Cria pedido como lead com intenção de compra
      const pedido = await orderDB.createOrder({
        clientKey: chatId,
        chatId,
        intencao: 'compra_nova',
      });

      // Avança para draft para poder adicionar itens
      const draft = await orderDB.advanceStatus(pedido.orderId, 'draft');

      // Adiciona cada item (converte preço de reais para centavos)
      for (const item of itens) {
        await orderDB.addItem(draft.orderId, {
          skuId: `manual_${item.nome.replace(/\s+/g, '_').toLowerCase()}`,
          nome: item.nome,
          quantidade: item.quantidade,
          precoUnitarioCentavos: Math.round(item.preco * 100),
        });
      }

      return {
        sucesso: true,
        dados: { orderId: pedido.orderId },
      };
    } catch (err) {
      return {
        sucesso: false,
        erro: err instanceof Error ? err.message : String(err),
      };
    }
  },
  soLeitura: false,
  precisaConfirmacao: true,
};
