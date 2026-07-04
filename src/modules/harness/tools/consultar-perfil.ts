import { z } from 'zod';
import type { Tool } from '../types';
import { customerProfileDB } from '../../../storage/customer-profile-db';

export const consultarPerfil: Tool = {
  nome: 'consultar_perfil_cliente',
  descricao:
    'Retorna o perfil do cliente: nome, preferências, endereço e formas de pagamento.\n' +
    'QUANDO USAR:\n' +
    '  - Cliente já é conhecido e você precisa do endereço para entrega\n' +
    '  - Cliente perguntou sobre forma de pagamento (consulte o perfil primeiro)\n' +
    '  - Cliente disse nome e você quer confirmar se já está cadastrado\n' +
    '  - Antes de registrar um pedido para confirmar endereço e pagamento\n' +
    'QUANDO NÃO USAR:\n' +
    '  - Primeira interação com cliente novo (perfil ainda não existe — retorna erro)\n' +
    '  - Cliente está perguntando sobre produtos (use consultar_catalogo)\n' +
    '  - Cliente quer histórico de pedidos (use consultar_historico)\n' +
    'EXEMPLOS:\n' +
    '  - consultar_perfil_cliente({chatId: "5511999999999@c.us"}) → {nome: "Maria", endereco: "Rua X, 123", formaPagamento: ["pix"]}\n' +
    '  - consultar_perfil_cliente({chatId: "chat_novo@c.us"}) → erro: perfil não encontrado',
  categoria: 'leitura',
  tipo: 'leitura',
  inputSchema: z.object({
    chatId: z.string().describe('ID do chat do cliente (ex: 5511999999999@c.us) — obtido automaticamente do contexto'),
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
