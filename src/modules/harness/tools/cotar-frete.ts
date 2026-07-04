import { z } from 'zod';
import type { Tool } from '../types';
import { deliveryService } from '../../../infrastructure/delivery/delivery-service';

export const cotarFrete: Tool = {
  nome: 'cotar_frete',
  descricao:
    'Calcula o valor do frete com a Bee Delivery para um endereço de destino.\n' +
    'QUANDO USAR:\n' +
    '  - Cliente perguntou quanto custa a entrega ("quanto é o frete?")\n' +
    '  - Cliente forneceu o endereço de entrega e quer saber o valor\n' +
    '  - Antes de fechar um pedido, para informar o valor total com frete\n' +
    '  - Cliente perguntou prazo de entrega ("quanto tempo demora?")\n' +
    'QUANDO NÃO USAR:\n' +
    '  - Cliente ainda não forneceu endereço (peça o endereço primeiro)\n' +
    '  - Cliente está fora de Uberlândia/MG (entrega só na região)\n' +
    '  - Cliente quer saber sobre o produto, não sobre entrega\n' +
    'EXEMPLOS:\n' +
    '  - cotar_frete({logradouro: "Rua Oscar Alves", numero: "100", bairro: "Santa Mônica", cidade: "Uberlândia"}) → {valorFrete: 14.59, prazoMin: 20, prazoMax: 60}\n' +
    '  - cotar_frete({logradouro: "Av. João Naves", numero: "2000", bairro: "Santa Mônica"}) → {valorFrete: 12.30, prazoMin: 20, prazoMax: 50}\n' +
    '  - cotar_frete({...}) com endereço fora de Uberlândia → erro: endereço não disponível',
  categoria: 'leitura',
  tipo: 'pesquisa',
  inputSchema: z.object({
    logradouro: z.string().min(1).describe('Rua, avenida ou logradouro do destino'),
    numero: z.string().min(1).describe('Número do endereço'),
    bairro: z.string().optional().describe('Bairro (se souber)'),
    cidade: z.string().default('Uberlândia').describe('Cidade (default Uberlândia)'),
    estado: z.string().default('MG').describe('Estado (default MG)'),
    complemento: z.string().optional().describe('Complemento (bloco, apto)'),
  }),
  executar: async (input) => {
    const { logradouro, numero, bairro, cidade, estado, complemento } = input as {
      logradouro: string;
      numero: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
      complemento?: string;
    };

    try {
      const resultado = await deliveryService.cotarFrete('bee-delivery', {
        origem: {
          cep: '',
          logradouro: 'Rua Exemplo',
          numero: '156',
          bairro: 'Santa Mônica',
          cidade: 'Uberlândia',
          estado: 'MG',
        },
        destino: {
          cep: '',
          logradouro,
          numero,
          bairro: bairro || '',
          cidade: cidade || 'Uberlândia',
          estado: estado || 'MG',
          complemento,
        },
        items: [],
      });

      return {
        sucesso: true,
        dados: {
          valorFrete: resultado.valorFrete,
          prazoEstimadoMin: resultado.prazoEstimadoMin,
          prazoEstimadoMax: resultado.prazoEstimadoMax,
          moeda: resultado.moeda,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        sucesso: false,
        erro: message,
      };
    }
  },
  soLeitura: true,
  precisaConfirmacao: false,
};
