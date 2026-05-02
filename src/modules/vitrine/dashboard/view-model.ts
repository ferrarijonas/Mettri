export type VitrineCanal = 'whatsapp' | 'instagram' | 'site' | 'site_ofertas';

export type VitrineMotivoVm =
  | 'PROMO_ATIVA'
  | 'ESTOQUE_BAIXO'
  | 'MATCH_CATEGORIA_CLIENTE'
  | 'INTENCAO_COMPRA_AGORA'
  | 'RISCO_MARGEM'
  | 'SATURACAO_RECENTE';

export interface VitrineRecomendacaoVm {
  recommendationId: string;
  skuId: string;
  nome: string;
  score: number;
  motivos: VitrineMotivoVm[];
  validUntilIso: string | null;
  precoRef: number | null;
  estoqueRef: number | null;
  canais: VitrineCanal[];
}

export interface VitrineDashboardViewModel {
  title: string;
  accountName: string;
  generatedAtIso: string;
  version: string;
  warnings: string[];
  canais: { id: VitrineCanal; label: string }[];
  recomendacoes: VitrineRecomendacaoVm[];
}

