import { z } from 'zod';
import type { Tool } from '../types';
import { catalogoDB } from '../../../storage/catalogo-db';

export const consultarCatalogo: Tool = {
  nome: 'consultar_catalogo',
  descricao:
    'Busca produtos no catálogo pelo nome.\n' +
    'QUANDO USAR:\n' +
    '  - Cliente pediu um produto ou serviço específico ("quero pão", "tem bolo?")\n' +
    '  - Cliente perguntou preço ou disponibilidade ("quanto custa?", "tem integral?")\n' +
    '  - Cliente pediu sugestão ("o que você recomenda?")\n' +
    '  - Preencher automaticamente o catálogo no início da conversa\n' +
    'QUANDO NÃO USAR:\n' +
    '  - Cliente já confirmou o pedido (use registrar_pedido)\n' +
    '  - Cliente quer histórico de pedidos (use consultar_historico)\n' +
    '  - Cliente está perguntando sobre entrega ou endereço (não está no catálogo)\n' +
    'EXEMPLOS:\n' +
    '  - consultar_catalogo({busca: "pão integral"}) → [{nome: "Pão Integral", preco: 8.50, disponivel: true}]\n' +
    '  - consultar_catalogo({busca: ""}) → erro: termo de busca vazio\n' +
    '  - consultar_catalogo({busca: "produto inexistente"}) → {produtos: []}',
  categoria: 'leitura',
  tipo: 'leitura',
  inputSchema: z.object({
    busca: z.string().describe('Nome ou palavra-chave do produto/serviço (mín. 2 caracteres)'),
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
