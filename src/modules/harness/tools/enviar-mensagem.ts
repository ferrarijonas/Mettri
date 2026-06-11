import { z } from 'zod';
import type { Tool } from '../types';
import { sendMessageService } from '../../../infrastructure/services/send-message';
import { isSendEnabled } from '../agent-state';

export const enviarMensagem: Tool = {
  nome: 'enviar_mensagem',
  descricao:
    'Envia uma mensagem de texto para o cliente no WhatsApp.\n' +
    'QUANDO USAR:\n' +
    '  - Precisa confirmar endereço com o cliente ("Qual seu endereço de entrega?")\n' +
    '  - Precisa confirmar forma de pagamento ("Vai pagar como?")\n' +
    '  - Cliente pediu informação que você não tem (precisa perguntar)\n' +
    '  - Após registrar pedido, confirme os detalhes com o cliente\n' +
    'QUANDO NÃO USAR:\n' +
    '  - A pergunta do cliente pode ser respondida diretamente (responda sem tool)\n' +
    '  - Cliente está reclamando de algo — responda com empatia, não pergunte mais\n' +
    '  - Você já tem todos os dados necessários — prossiga com registrar_pedido\n' +
    '  - Se a mensagem for apenas informativa, responda diretamente sem enviar\n' +
    'EXEMPLOS:\n' +
    '  - enviar_mensagem({chatId: "55119@c.us", texto: "Qual seu endereço para entrega?"}) → {enviado: true}\n' +
    '  - enviar_mensagem com texto vazio → erro',
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
