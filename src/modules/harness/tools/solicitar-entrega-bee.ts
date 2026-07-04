import { z } from 'zod';
import type { Tool } from '../types';
import { deliveryService } from '../../../infrastructure/delivery/delivery-service';

export const solicitarEntregaBee: Tool = {
  nome: 'solicitar_entrega_bee',
  descricao:
    'Solicita uma entrega na Bee Delivery para o endereço informado.\n' +
    'QUANDO USAR:\n' +
    '  - Cliente confirmou que quer a entrega e o frete foi cotado\n' +
    '  - Você já sabe o nome e telefone do cliente para contato\n' +
    '  - Cliente pediu para chamar o motoboy ("pode pedir", "manda entregar")\n' +
    '  - Já tem um pedido registrado e o cliente confirmou a entrega\n' +
    'QUANDO NÃO USAR:\n' +
    '  - Cliente ainda não confirmou o pedido (use cotar_frete primeiro)\n' +
    '  - Cliente não forneceu o endereço (peça antes)\n' +
    '  - Frete não foi cotado ainda (cote primeiro)\n' +
    '  - Cliente está fora de Uberlândia/MG (entrega indisponível)\n' +
    'EXEMPLOS:\n' +
    '  - solicitar_entrega_bee({logradouro: "Rua Oscar Alves", numero: "100", bairro: "Santa Mônica", clienteNome: "Maria", clienteTelefone: "34999999999"}) → {entregaId: "uuid", status: "confirmed", valorFrete: 14.59}',
  categoria: 'acao',
  tipo: 'execucao',
  inputSchema: z.object({
    logradouro: z.string().min(1).describe('Rua, avenida ou logradouro do destino'),
    numero: z.string().min(1).describe('Número do endereço'),
    bairro: z.string().optional().describe('Bairro (se souber)'),
    cidade: z.string().default('Uberlândia').describe('Cidade (default Uberlândia)'),
    estado: z.string().default('MG').describe('Estado (default MG)'),
    complemento: z.string().optional().describe('Complemento (bloco, apto)'),
    clienteNome: z.string().min(1).describe('Nome do cliente para contato do entregador'),
    clienteTelefone: z.string().min(1).describe('Telefone do cliente para contato'),
    observacao: z.string().optional().describe('Observação para o entregador'),
  }),
  executar: async (input) => {
    const {
      logradouro,
      numero,
      bairro,
      cidade,
      estado,
      complemento,
      clienteNome,
      clienteTelefone,
      observacao,
    } = input as {
      logradouro: string;
      numero: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
      complemento?: string;
      clienteNome: string;
      clienteTelefone: string;
      observacao?: string;
    };

    try {
      const resultado = await deliveryService.solicitarEntrega('bee-delivery', {
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
        valorTotal: 0,
        observacao,
        contatoDestinatario: {
          nome: clienteNome,
          telefone: clienteTelefone,
        },
      });

      return {
        sucesso: true,
        dados: {
          entregaId: resultado.entregaId,
          status: resultado.status,
          valorFrete: resultado.valorFrete,
          prazoEstimado: resultado.prazoEstimado,
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
  soLeitura: false,
  precisaConfirmacao: true,
};
