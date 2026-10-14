import { z } from 'zod';
import type { Tool } from '../types';
import { consultarConsumer } from './consumer-client';

interface ProdutoDisponivel {
  nome: string;
  estoque: number;
}

interface RespostaHoje {
  hoje: ProdutoDisponivel[];
  total: number;
}

interface RespostaSemana {
  semana: Record<string, ProdutoDisponivel[]>;
  total: number;
}

export const consultarProdutosDisponiveis: Tool = {
  nome: 'consultar_produtos_disponiveis',
  descricao:
    'Consulta no banco da loja (Consumer) o que tem disponível para venda, com estoque real.\n' +
    'QUANDO USAR:\n' +
    '  - Cliente perguntou o que tem hoje ("o que tem aí?", "tem pão?")\n' +
    '  - Cliente perguntou o que tem na semana / cardápio dos dias ("tem na quinta?")\n' +
    '  - Confirmar se um produto ainda tem estoque antes de vender\n' +
    'QUANDO NÃO USAR:\n' +
    '  - Cliente quer preço do catálogo (use consultar_catalogo)\n' +
    '  - Cliente quer fechar pedido (use registrar_pedido)\n' +
    'EXEMPLOS:\n' +
    '  - consultar_produtos_disponiveis({periodo: "hoje"}) → [{nome: "Pão sem Glúten", estoque: 10}]\n' +
    '  - consultar_produtos_disponiveis({periodo: "semana"}) → {semana: {quinta: [...], sexta: [...]}}',
  categoria: 'leitura',
  tipo: 'leitura',
  inputSchema: z.object({
    periodo: z
      .enum(['hoje', 'semana'])
      .default('hoje')
      .describe('"hoje" = saldo agora; "semana" = agrupado por dia da semana.'),
    busca: z.string().optional().describe('Filtra por trecho do nome do produto (ex: "integral").'),
  }),
  executar: async (input) => {
    const { periodo, busca } = input as { periodo?: 'hoje' | 'semana'; busca?: string };
    try {
      const p = periodo ?? 'hoje';
      if (p === 'semana') {
        const dados = await consultarConsumer<RespostaSemana>('estoque', { periodo: p, busca });
        return { sucesso: true, dados };
      }
      const dados = await consultarConsumer<RespostaHoje>('estoque', { periodo: p, busca });
      return { sucesso: true, dados };
    } catch (err) {
      return { sucesso: false, erro: err instanceof Error ? err.message : String(err) };
    }
  },
  soLeitura: true,
  precisaConfirmacao: false,
};
