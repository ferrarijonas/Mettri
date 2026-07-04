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
    'Cria um novo pedido com os itens especificados.\n' +
    'QUANDO USAR:\n' +
    '  - Cliente confirmou explicitamente o que quer comprar\n' +
    '  - Você já consultou o catálogo e sabe preço e disponibilidade\n' +
    '  - Cliente já forneceu (ou já temos no perfil) endereço e forma de pagamento\n' +
    '  - Use APENAS quando tiver todos os dados necessários\n' +
    'QUANDO NÃO USAR:\n' +
    '  - Ainda está consultando o catálogo (faça isso primeiro)\n' +
    '  - Cliente não confirmou o pedido explicitamente\n' +
    '  - Faltam dados obrigatórios: endereço de entrega ou forma de pagamento\n' +
    '  - Cliente está apenas perguntando preços (use consultar_catalogo)\n' +
    'EXEMPLOS:\n' +
    '  - registrar_pedido({chatId: "55119@c.us", itens: [{nome: "Pão Integral", quantidade: 2, preco: 8.50}]}) → {orderId: "ORD-123"}\n' +
    '  - registrar_pedido com itens vazios → erro: mínimo 1 item',
  categoria: 'escrita',
  tipo: 'escrita',
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
