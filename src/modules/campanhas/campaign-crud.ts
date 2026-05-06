import type { MettriBridgeClient } from '../../content/bridge-client';
import type { Campaign, CampaignStatus } from './types';
import { loadCampaignsFromStorage, saveCampaignsToStorage } from './campaign-storage';
import { validateCampaignDraft } from './validate-campaign';

function newId(): string {
  return `camp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export type CrudResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: string; message: string };

export async function listarCampanhas(
  bridge: MettriBridgeClient,
  accountId: string
): Promise<CrudResult<Campaign[]>> {
  if (!accountId.trim()) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'accountId é obrigatório.' };
  }
  const list = await loadCampaignsFromStorage(bridge, accountId);
  const sorted = [...list].sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
  return { ok: true, data: sorted };
}

export async function criarCampanha(
  bridge: MettriBridgeClient,
  input: {
    accountId: string;
    draft: Omit<Campaign, 'campaignId' | 'createdAtIso' | 'updatedAtIso'>;
    actor: string;
  }
): Promise<CrudResult<Campaign>> {
  if (!input.accountId.trim()) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'accountId é obrigatório.' };
  }
  const ts = nowIso();
  const campaign: Campaign = {
    ...input.draft,
    campaignId: newId(),
    createdAtIso: ts,
    updatedAtIso: ts,
    createdBy: input.actor,
    updatedBy: input.actor,
  };
  const v = validateCampaignDraft(campaign);
  if (!v.ok) return v;

  const list = await loadCampaignsFromStorage(bridge, input.accountId);
  list.push(campaign);
  await saveCampaignsToStorage(bridge, input.accountId, list);
  return { ok: true, data: campaign };
}

export async function editarCampanha(
  bridge: MettriBridgeClient,
  input: {
    accountId: string;
    campaignId: string;
    patch: Partial<Campaign>;
    actor: string;
  }
): Promise<CrudResult<Campaign>> {
  if (!input.accountId.trim() || !input.campaignId.trim()) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'accountId e campaignId são obrigatórios.' };
  }
  const list = await loadCampaignsFromStorage(bridge, input.accountId);
  const idx = list.findIndex(c => c.campaignId === input.campaignId);
  if (idx < 0) {
    return { ok: false, errorCode: 'NOT_FOUND', message: 'Campanha não encontrada.' };
  }
  const merged: Campaign = {
    ...list[idx],
    ...input.patch,
    campaignId: list[idx].campaignId,
    createdAtIso: list[idx].createdAtIso,
    createdBy: list[idx].createdBy,
    updatedAtIso: nowIso(),
    updatedBy: input.actor,
  };
  const v = validateCampaignDraft(merged);
  if (!v.ok) return v;
  list[idx] = merged;
  await saveCampaignsToStorage(bridge, input.accountId, list);
  return { ok: true, data: merged };
}

export async function ativarPausarEncerrarCampanha(
  bridge: MettriBridgeClient,
  input: {
    accountId: string;
    campaignId: string;
    status: CampaignStatus;
    actor: string;
  }
): Promise<CrudResult<Campaign>> {
  return editarCampanha(bridge, {
    accountId: input.accountId,
    campaignId: input.campaignId,
    patch: { status: input.status },
    actor: input.actor,
  });
}
