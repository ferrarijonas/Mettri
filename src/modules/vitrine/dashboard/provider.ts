import type { VitrineDashboardViewModel, VitrineRecomendacaoVm } from './view-model';

const CANAIS: VitrineDashboardViewModel['canais'] = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'site', label: 'Site' },
  { id: 'site_ofertas', label: 'Ofertas do site' },
];

const MOCK_RECOMENDACOES: VitrineRecomendacaoVm[] = [
  {
    recommendationId: 'rec-001',
    skuId: 'PAO-001',
    nome: 'Pão francês',
    score: 8.4,
    motivos: ['ESTOQUE_BAIXO', 'PROMO_ATIVA', 'MATCH_CATEGORIA_CLIENTE'],
    validUntilIso: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    precoRef: 1290,
    estoqueRef: 3,
    canais: ['whatsapp', 'instagram', 'site_ofertas'],
  },
  {
    recommendationId: 'rec-002',
    skuId: 'CAFE-250',
    nome: 'Café especial 250g',
    score: 7.1,
    motivos: ['INTENCAO_COMPRA_AGORA', 'MATCH_CATEGORIA_CLIENTE'],
    validUntilIso: null,
    precoRef: 3290,
    estoqueRef: 17,
    canais: ['whatsapp', 'instagram', 'site'],
  },
  {
    recommendationId: 'rec-003',
    skuId: 'QUEI-003',
    nome: 'Queijo minas 500g',
    score: 6,
    motivos: ['RISCO_MARGEM', 'SATURACAO_RECENTE'],
    validUntilIso: null,
    precoRef: 2590,
    estoqueRef: 8,
    canais: ['site', 'site_ofertas'],
  },
];

export async function getVitrineDashboardViewModel(): Promise<VitrineDashboardViewModel> {
  // TODO integração real: trocar mocks por VitrineSaida do pipeline/API.
  return {
    title: 'Vitrine',
    accountName: 'Minha loja',
    generatedAtIso: new Date().toISOString(),
    version: 'vitrine-v1-mock',
    warnings: [],
    canais: CANAIS,
    recomendacoes: MOCK_RECOMENDACOES,
  };
}

