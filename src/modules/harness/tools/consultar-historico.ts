import { z } from 'zod';
import type { Tool } from '../types';
import { messageDB } from '../../../storage/message-db';

export const consultarHistorico: Tool = {
  nome: 'consultar_historico',
  descricao:
    'Retorna as últimas N mensagens da conversa com o cliente.\n' +
    'QUANDO USAR:\n' +
    '  - Cliente perguntou sobre pedido anterior ("meu pedido chegou?", "comprei semana passada")\n' +
    '  - Cliente reclamou de algo que aconteceu antes ("da última vez veio errado")\n' +
    '  - Você precisa entender o contexto de uma conversa em andamento\n' +
    '  - Cliente voltou após dias sem falar e você precisa retomar\n' +
    'QUANDO NÃO USAR:\n' +
    '  - Cliente quer comprar algo novo (use consultar_catalogo + registrar_pedido)\n' +
    '  - Cliente está na primeira interação (histórico vazio)\n' +
    'EXEMPLOS:\n' +
    '  - consultar_historico({chatId: "55119@c.us", limite: 5}) → [{texto: "quero 2 pães", data: "2026-06-11", isOutgoing: false}]\n' +
    '  - consultar_historico({chatId: "55119@c.us"}) → últimas 10 mensagens',
  categoria: 'leitura',
  tipo: 'leitura',
  inputSchema: z.object({
    chatId: z.string().describe('ID do chat do cliente (ex: 5511999999999@c.us)'),
    limite: z
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .default(10)
      .describe('Quantidade de mensagens a retornar (máx 100). Default: 10'),
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
