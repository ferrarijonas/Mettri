import type { CampaignMode, CampaignStatus, CampaignType } from '../types';

export interface CampanhaListItemVm {
  campaignId: string;
  nome: string;
  tipo: CampaignType;
  tipoLabel: string;
  modo: CampaignMode;
  status: CampaignStatus;
  prioridade?: number;
  updatedAtIso: string;
}

export interface CampanhasEditorVm {
  mode: 'new' | 'edit';
  campaignId: string | null;
  nome: string;
  tipo: CampaignType;
  modo: CampaignMode;
  status: CampaignStatus;
  objetivo: string;
  prioridadeText: string;
  skusText: string;
  estoqueMinText: string;
  janelaStart: string;
  janelaEnd: string;
  timezone: string;
  dedupeHours: string;
  maxSends: string;
}

export interface CampanhasDashboardVm {
  accountId: string;
  activeTab: 'lista' | 'simulador';
  items: CampanhaListItemVm[];
  editor: CampanhasEditorVm;
  listError: string | null;
  operationError: string | null;
}
