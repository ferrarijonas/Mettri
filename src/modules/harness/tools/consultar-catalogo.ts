import { z } from 'zod';
import type { Tool } from '../types';
import { catalogoDB } from '../../../storage/catalogo-db';

export const consultarCatalogo: Tool = {
  nome: 'consultar_catalogo',
  descricao:
    'Busca produtos no catálogo pelo nome ou palavra-chave. Retorna nome, preço em reais e disponibilidade.',
  categoria: 'leitura',
  inputSchema: z.object({
    busca: z.string().describe('Nome ou palavra-chave do produto'),
  }),
  executar: async (input) => {
    const { busca } = input as { busca: string };
    const accountId = catalogoDB.getCurrentUserWid() || 'default';
    try {
      const produtos = await catalogoDB.listByAccount(accountId);
      const termo = busca.toLowerCase();
      const filtrados = produtos.filter((p) =>
        p.nome.toLowerCase().includes(termo),
      );
      return {
        sucesso: true,
        dados: {
          produtos: filtrados.map((p) => ({
            nome: p.nome,
            preco: p.precoCentavos / 100,
            disponivel:
              p.estoqueDisponivel === null ? true : p.estoqueDisponivel > 0,
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
