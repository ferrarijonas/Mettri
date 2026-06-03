import { z } from 'zod';
import type { Tool } from '../types';
import { customerProfileDB } from '../../../storage/customer-profile-db';

export const consultarPerfil: Tool = {
  nome: 'consultar_perfil_cliente',
  descricao:
    'Retorna o perfil operacional do cliente: nome, preferências, aversões, endereço de entrega e formas de pagamento preferidas.',
  categoria: 'leitura',
  inputSchema: z.object({
    chatId: z.string().describe('ID do chat do cliente (ex: 5511999999999@c.us)'),
  }),
  executar: async (input) => {
    const { chatId } = input as { chatId: string };
    try {
      const perfil = await customerProfileDB.getByChatId(chatId);
      if (!perfil) {
        return {
          sucesso: false,
          erro: `Perfil não encontrado para o chat "${chatId}".`,
        };
      }
      return {
        sucesso: true,
        dados: {
          nome: perfil.nomeConfiavel ?? null,
          preferenciasProduto: perfil.preferenciasProduto ?? [],
          aversoesProduto: perfil.aversoesProduto ?? [],
          enderecoEntrega: perfil.enderecoEntrega ?? null,
          formaPagamentoPreferida: perfil.formaPagamentoPreferida ?? [],
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
