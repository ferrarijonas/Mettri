import { z } from 'zod';
import type { Tool } from '../types';

export const enviarMensagem: Tool = {
  nome: 'enviar_mensagem',
  descricao:
    'Envia uma mensagem de texto para o cliente no WhatsApp. Retorna se o envio foi bem-sucedido.',
  categoria: 'comunicacao',
  inputSchema: z.object({
    chatId: z.string().describe('ID do chat do cliente (ex: 5511999999999@c.us)'),
    texto: z.string().min(1).describe('Texto da mensagem a ser enviada'),
  }),
  executar: async (input) => {
    const { chatId, texto } = input as { chatId: string; texto: string };
    try {
      const sendFn = (window as unknown as Record<string, unknown>)?.Mettri as
        | Record<string, unknown>
        | undefined;
      const sendTextMsg = sendFn?.sendTextMsgToChat as
        | ((chatId: string, text: string) => unknown)
        | undefined;

      if (typeof sendTextMsg !== 'function') {
        return {
          sucesso: false,
          erro: 'Função sendTextMsgToChat não disponível. O WhatsApp Web pode não estar totalmente carregado.',
        };
      }

      await sendTextMsg(chatId, texto);
      return { sucesso: true, dados: { enviado: true } };
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
