import { z } from 'zod';
import type { Tool } from '../types';
import { messageDB } from '../../../storage/message-db';

export const consultarHistorico: Tool = {
  nome: 'consultar_historico',
  descricao:
    'Retorna as últimas N mensagens da conversa com o cliente. Ordenadas da mais recente para a mais antiga.',
  categoria: 'leitura',
  inputSchema: z.object({
    chatId: z.string().describe('ID do chat do cliente'),
    limite: z
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .default(10)
      .describe('Quantidade de mensagens a retornar (máx 100)'),
  }),
  executar: async (input) => {
    const { chatId, limite } = input as { chatId: string; limite?: number };
    try {
      const mensagens = await messageDB.getMessages(chatId, limite ?? 10);
      return {
        sucesso: true,
        dados: {
          mensagens: mensagens.map((m) => ({
            texto: m.text,
            data: m.timestamp.toISOString(),
            isOutgoing: m.isOutgoing,
          })),
        },
      };
    } catch (err) {
      return {
        sucesso: false,
        erro: err instanceof Error ? err.message : String(err),
      };
    }
  },
  soLeitura: true,
  precisaConfirmacao: false,
};
