import type { MettriBridgeClient } from '../../content/bridge-client';
import type { Campaign } from './types';

export function campaignsStorageKey(accountId: string): string {
  return `mettriCampanhas_v1_${accountId}`;
}

export async function loadCampaignsFromStorage(
  bridge: MettriBridgeClient,
  accountId: string
): Promise<Campaign[]> {
  const key = campaignsStorageKey(accountId);
  const raw = await bridge.storageGet([key]);
  const v = raw[key];
  if (v === undefined || v === null) return [];
  if (typeof v !== 'string') return [];
  try {
    const parsed = JSON.parse(v) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as Campaign[];
  } catch {
    return [];
  }
}

export async function saveCampaignsToStorage(
  bridge: MettriBridgeClient,
  accountId: string,
  campaigns: Campaign[]
): Promise<void> {
  const key = campaignsStorageKey(accountId);
  await bridge.storageSet({ [key]: JSON.stringify(campaigns) });
}
