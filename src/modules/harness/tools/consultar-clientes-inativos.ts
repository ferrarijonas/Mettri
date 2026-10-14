import { z } from 'zod';
import type { Tool } from '../types';
import { consultarConsumer } from './consumer-client';

interface ClienteInativo {
  nome: string;
  telefone: string;
  ultimoPedido: string;
  diasInativo: number | null;
  ticketMedio: number | null;
}

interface RespostaInativos {
  clientes: ClienteInativo[];
  total: number;
}

export const consultarClientesInativos: Tool = {
  nome: 'consultar_clientes_inativos',
  descricao:
    'Lista clientes da loja (banco do caixa/Consumer) que estão sem comprar há um tempo.\n' +
    'QUANDO USAR:\n' +
    '  - Campanha de reativação ("quem sumiu?", "quem não compra há 30 dias?")\n' +
    '  - Perguntou se um cliente específico está inativo (use `telefone`)\n' +
    '  - Precisa de uma lista para retomar contato em massa\n' +
    'QUANDO NÃO USAR:\n' +
    '  - Cliente do chat atual quer ver o próprio histórico (use consultar_historico)\n' +
    '  - Cliente quer saber preço/estoque (use consultar_produtos_disponiveis)\n' +
    'EXEMPLOS:\n' +
    '  - consultar_clientes_inativos({dias: 30, limite: 50}) → lista dos sumidos há 30+ dias\n' +
    '  - consultar_clientes_inativos({telefone: "34999990000"}) → checa um cliente só',
  categoria: 'leitura',
  tipo: 'leitura',
  inputSchema: z.object({
    dias: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Só clientes sem comprar há mais de N dias. Omitir = todos.'),
    limite: z
      .number()
      .int()
      .positive()
      .max(200)
      .optional()
      .describe('Máximo de clientes a retornar (máx 200). Omitir = todos.'),
    telefone: z
      .string()
      .optional()
      .describe('Filtra por telefone (só dígitos importam). Use para checar um cliente só.'),
  }),
  executar: async (input) => {
    const { dias, limite, telefone } = input as {
      dias?: number;
      limite?: number;
      telefone?: string;
    };
    try {
      const dados = await consultarConsumer<RespostaInativos>('inativos', {
        dias,
        limite,
        telefone,
      });
      return { sucesso: true, dados };
    } catch (err) {
      return { sucesso: false, erro: err instanceof Error ? err.message : String(err) };
    }
  },
  soLeitura: true,
  precisaConfirmacao: false,
};
