import { z } from 'zod';
import type { Tool } from '../types';
import { sendMessageService } from '../../../infrastructure/services/send-message';
import { isSendEnabled } from '../agent-state';

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
    if (!isSendEnabled()) {
      return { sucesso: false, erro: 'Envio de mensagens desativado no painel.' };
    }
    const { chatId, texto } = input as { chatId: string; texto: string };
    try {
      await sendMessageService.sendText(chatId, texto);
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
