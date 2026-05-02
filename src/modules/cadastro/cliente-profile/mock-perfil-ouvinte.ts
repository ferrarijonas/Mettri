// Tipo local para o mock - não precisa de importação (definido em customer-profile-db.ts)
type MockPerfil = {
  chatId: string;
  segmentos: string[];
  confiancaPerfil: number;
  nomeConfiavel?: string;
  cadastroUtil?: boolean;
  comportamento?: {
    janelaAtiva?: 'manha' | 'tarde' | 'noite';
    frequenciaContato7d?: number;
  };
  historico?: {
    diasDesdeUltimaCompra?: number | null;
    compras90d?: number;
    ticketMedioFaixa?: 'baixo' | 'medio' | 'alto';
  };
  preferenciasProduto?: string[];
  preferenciasLogistica?: string[];
  sensibilidadeOferta?: 'baixa' | 'media' | 'alta';
  proximidade?: {
    score?: number;
    banda?: 'frio' | 'morno' | 'quente';
    lastRecomputeReason?: 'turn_end' | 'purchase_event' | 'scheduled';
    lastRecomputeAtIso?: string;
  };
  rfm?: {
    recenciaDias?: number;
    frequencia30d?: number;
    monetario30d?: number;
    bandaRecencia?: string;
    bandaFrequencia?: string;
    bandaMonetario?: string;
    score?: number;
  };
  aversoesProduto?: string[];
  enderecoEntrega?: string;
  formaPagamentoPreferida?: string[];
  urgenciaEntrega?: string;
  observacoesLogisticas?: string[];
  camposConfianca?: {
    preferenciasProduto?: 'desconhecido' | 'baixa' | 'media' | 'alta';
    aversoesProduto?: 'desconhecido' | 'baixa' | 'media' | 'alta';
    enderecoEntrega?: 'desconhecido' | 'baixa' | 'media' | 'alta';
    formaPagamentoPreferida?: 'desconhecido' | 'baixa' | 'media' | 'alta';
    urgenciaEntrega?: 'desconhecido' | 'baixa' | 'media' | 'alta';
    observacoesLogisticas?: 'desconhecido' | 'baixa' | 'media' | 'alta';
  };
  updatedAtIso: string;
  modelVersion: string;
};

/**
 * Mock data para testar a UI do perfil do cliente com os novos campos do Ouvinte.
 *用法: Importar e usar para testar a renderização.
 *
 * Para testar:
 * 1. Substituir o perfil real pelo mock em fornecer-ficha-cliente-para-atendimento.ts
 * 2. Ou usar no cliente-profile-panel.ts para desenvolvimento
 *
 * @example
 * const mockPerfil = getMockPerfilComOuvinte()
 */
export function getMockPerfilComOuvinte(): MockPerfil {
  return {
    chatId: '5521999999999@c.us',
    segmentos: ['pessoa_fisica', 'cliente_recorrente'],
    confiancaPerfil: 0.85,
    nomeConfiavel: 'João Silva',
    cadastroUtil: true,
    comportamento: {
      janelaAtiva: 'noite',
      frequenciaContato7d: 3,
    },
    historico: {
      diasDesdeUltimaCompra: 12,
      compras90d: 5,
      ticketMedioFaixa: 'medio',
    },
    preferenciasProduto: ['pizza_pepperoni', 'pizza_bacon', 'refrigerante_cola'],
    preferenciasLogistica: ['entrega_sem_contato'],
    sensibilidadeOferta: 'media',
    proximidade: {
      score: 0.78,
      banda: 'quente',
      lastRecomputeReason: 'turn_end',
      lastRecomputeAtIso: new Date().toISOString(),
    },
    rfm: {
      recenciaDias: 12,
      frequencia30d: 3,
      monetario30d: 285,
      bandaRecencia: 'recente',
      bandaFrequencia: 'frequente',
      bandaMonetario: 'medio',
      score: 0.78,
    },
    aversoesProduto: ['pizza_portuguesa', 'sem_azeitona', 'sem_cebola'],
    enderecoEntrega: 'Rua das Flores, 123, Apto 4B, Centro, Rio de Janeiro - RJ',
    formaPagamentoPreferida: ['pix', 'cartao_credito'],
    urgenciaEntrega: 'hoje_a_noite',
    observacoesLogisticas: ['portaria_b', 'andar_4', 'telefone_21_99999-9999'],
    camposConfianca: {
      preferenciasProduto: 'alta',
      aversoesProduto: 'alta',
      enderecoEntrega: 'alta',
      formaPagamentoPreferida: 'media',
      urgenciaEntrega: 'baixa',
      observacoesLogisticas: 'media',
    },
    updatedAtIso: new Date().toISOString(),
    modelVersion: 'ouvinte_v1',
  };
}

/**
 * Mock com confiança mista para testar todos os estados de badge.
 */
export function getMockPerfilConfiancaMista(): MockPerfil {
  return {
    chatId: '5511999999999@c.us',
    segmentos: ['pessoa_fisica'],
    confiancaPerfil: 0.45,
    nomeConfiavel: 'Maria Santos',
    preferenciasProduto: ['hamburguer'],
    sensibilidadeOferta: 'alta',
    proximidade: {
      score: 0.32,
      banda: 'frio',
    },
    rfm: {
      recenciaDias: 30,
      frequencia30d: 1,
      monetario30d: 45,
      score: 0.32,
    },
    aversoesProduto: ['sem_tomate'],
    enderecoEntrega: '', // vazio = confiança desconhecido
    formaPagamentoPreferida: ['dinheiro'],
    urgenciaEntrega: '',
    observacoesLogisticas: [],
    camposConfianca: {
      preferenciasProduto: 'media',
      aversoesProduto: 'alta',
      enderecoEntrega: 'desconhecido',
      formaPagamentoPreferida: 'baixa',
      urgenciaEntrega: 'desconhecido',
      observacoesLogisticas: 'desconhecido',
    },
    updatedAtIso: new Date().toISOString(),
    modelVersion: 'ouvinte_v1',
  };
}

/**
 * Mock vazio para testar o estado inicial (sem dados).
 */
export function getMockPerfilVazio(): MockPerfil {
  return {
    chatId: '5509999999999@c.us',
    segmentos: [],
    confiancaPerfil: 0,
    updatedAtIso: new Date().toISOString(),
    modelVersion: 'ouvinte_v1',
  };
}

/**
 * контракт do perfil operacional com campos do Ouvinte.
 * Usado para validação de tipos e documentação.
 */
export const PERFIL_CONTRATO_OUVIDTE = {
  camposObrigatorios: [
    'chatId',
    'segmentos',
    'confiancaPerfil',
    'updatedAtIso',
    'modelVersion',
  ],
  camposOuvinte: [
    {
      nome: 'aversoesProduto',
      tipo: 'string[]',
      descricao: 'Produtos que o cliente não gosta ou rejeitou',
      confianca: 'aversoesProduto',
    },
    {
      nome: 'enderecoEntrega',
      tipo: 'string',
      descricao: 'Endereço de entrega completo',
      confianca: 'enderecoEntrega',
    },
    {
      nome: 'formaPagamentoPreferida',
      tipo: 'string[]',
      descricao: 'Formas de pagamento preferidas',
      confianca: 'formaPagamentoPreferida',
    },
    {
      nome: 'urgenciaEntrega',
      tipo: 'string',
      descricao: 'Prazo de urgência mentioned pelo cliente',
      confianca: 'urgenciaEntrega',
    },
    {
      nome: 'observacoesLogisticas',
      tipo: 'string[]',
      descricao: 'Observações logísticas (portaria, andar, etc)',
      confianca: 'observacoesLogisticas',
    },
    {
      nome: 'camposConfianca',
      tipo: 'object',
      descricao: 'Confiança por campo individually',
      subcampos: [
        'preferenciasProduto',
        'aversoesProduto',
        'enderecoEntrega',
        'formaPagamentoPreferida',
        'urgenciaEntrega',
        'observacoesLogisticas',
      ],
    },
  ],
  valoresConfiancaValidos: ['desconhecido', 'baixa', 'media', 'alta'],
} as const;

/**
 * Tutorial de como usar os mocks para testar:
 *
 * 1. No arquivo de teste ou desenvolvimento:
 *
 *    import { getMockPerfilComOuvinte } from './mock-perfil-ouvinte'
 *
 *    async function testeUI() {
 *      const perfil = getMockPerfilComOuvinte()
 *      const ficha = {
 *        chatId: perfil.chatId,
 *        cadastro: null,
 *        ultimaCompra: null,
 *        perfilOperacional: perfil,
 *        flags: { cadastroUtil: true }
 *      }
 *      // renderizar UI com ficha...
 *    }
 *
 * 2. Para testar sem WhatsApp abierto:
 *
 *    Substituir o chatId ativo por um dos mocks:
 *    - getMockPerfilComOuvinte().chatId → '5521999999999@c.us'
 *    - getMockPerfilConfiancaMista().chatId → '5511999999999@c.us'
 *
 * 3. Para forçar renderização com mock:
 *
 *    No método loadFicha() do ClienteProfilePanel,
 *    adicionar parâmetro optional para usar mock:
 *
*    private async loadFixture(mock?: MockPerfil): Promise<void> {
*      const perfil = mock || await buscarPerfilReal()
*      // ...
 *    }
 */