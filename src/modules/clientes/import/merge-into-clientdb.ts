import { clientDB, normalizePhoneDigitsWithAliases, digitsOnly } from '../../../storage/client-db';
import type { CanonicalClient } from './canonical';
import { classifyNameCandidate, cleanCandidateName } from '../name-likelihood';

export interface MergeOptions {
  overwrite?: boolean; // default false
}

export interface MergeResult {
  created: number;
  updated: number;
  skippedNoIdentity: number;
  /** Linhas com nome aplicado (first/last/nick a partir do import). */
  nameApplied: number;
  /** Linhas com nome no arquivo mas rejeitado (classify=noise, antes do fallback). */
  nameRejected: number;
}

function uniqStrings(values: (string | undefined | null)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = String(v ?? '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function mergePhones(existing: any[] | undefined, incoming: any[]): any[] {
  const base = Array.isArray(existing) ? [...existing] : [];
  const seenDigits = new Set<string>();

  for (const p of base) {
    const d = digitsOnly(p?.digits || p?.raw || '');
    if (d) seenDigits.add(d);
  }

  for (const p of incoming) {
    const d = digitsOnly(p?.digits || p?.raw || '');
    if (!d) continue;
    if (seenDigits.has(d)) continue;
    seenDigits.add(d);
    base.push({
      raw: String(p.raw ?? '').trim() || String(p.digits ?? '').trim(),
      digits: d,
      e164: p.e164,
      label: p.label,
    });
  }

  return base;
}

/**
 * Merge de import → ClientDB
 *
 * Regras:
 * - Por padrão NÃO sobrescreve campos já preenchidos (overwrite=false)
 * - Telefones e emails acumulam (união)
 * - Endereço entra como texto livre (addressFreeform)
 */
export async function mergeCanonicalClientsIntoClientDB(params: {
  clients: CanonicalClient[];
  options?: MergeOptions;
}): Promise<MergeResult> {
  const overwrite = params.options?.overwrite === true;
  const nowIso = new Date().toISOString();

  let created = 0;
  let updated = 0;
  let skippedNoIdentity = 0;
  let nameApplied = 0;
  let nameRejected = 0;

  for (const c of params.clients) {
    const firstPhone = c.phones?.[0];
    const primaryDigits = digitsOnly(firstPhone?.digits || firstPhone?.raw || '');
    if (!primaryDigits) {
      // MVP: sem telefone, não conseguimos key estável (email-only fica para próxima fase)
      skippedNoIdentity++;
      continue;
    }

    const normalized = normalizePhoneDigitsWithAliases(primaryDigits);
    const key = normalized.clientKey;

    // Importante: achar registro mesmo que a key canônica não bata (com/sem 55, com/sem 9).
    // Metáfora: o mesmo telefone pode vir com “sobrenome” ou sem.
    const lookupCandidates = Array.from(new Set([key, normalized.phoneDigits, ...normalized.aliasesDigits].filter(Boolean)));

    let existing = await clientDB.getByKey(key);
    if (!existing) {
      for (const d of lookupCandidates) {
        try {
          existing = (await clientDB.getByKey(d)) || (await clientDB.getByPhoneDigits(d));
        } catch {
          // ignore
        }
        if (existing) break;
      }
    }
    const isNew = !existing;

    // Resolver nome de import com prioridade:
    // 1) first/last explícitos
    // 2) fullName classificado (pessoa vs empresa vs ruído)
    // 3) nickname explícito
    let nextFirst: string | undefined = c.firstName?.trim() || undefined;
    let nextLast: string | undefined = c.lastName?.trim() || undefined;
    let nextNick: string | undefined = c.nickname?.trim() || undefined;

    if (!nextFirst && !nextLast && c.fullName) {
      const classified = classifyNameCandidate(c.fullName);
      if (classified.kind === 'person') {
        nextFirst = classified.firstName;
        nextLast = classified.lastName;
      } else if (classified.kind === 'business') {
        nextNick = nextNick || classified.nickname;
      } else {
        nameRejected++;
        // Fallback: fullName existe mas classify=noise → usar em firstName (não descartar)
        const trimmed = c.fullName.trim();
        if (trimmed) nextFirst = trimmed;
      }
    }
    if (nextFirst || nextLast || nextNick) nameApplied++;

    const nextAddress = c.addressFreeform?.trim() || undefined;
    const nextEmails = uniqStrings([...(c.emails ?? [])]);
    const nextPhones = Array.isArray(c.phones) ? c.phones : [];

    const base = existing ?? {
      clientKey: key,
      phoneDigits: normalized.phoneDigits || undefined,
      aliasesDigits: normalized.aliasesDigits,
      updatedAtIso: nowIso,
    };

    const merged: any = { ...base };

    const existingNameSource = String((existing as any)?.nameSource || '').trim();
    const existingCandidate = cleanCandidateName(String(existing?.whatsAppCandidateName || ''));
    const existingFull = cleanCandidateName(
      `${String(existing?.firstName || '').trim()} ${String(existing?.lastName || '').trim()}`.trim()
    );
    const existingNick = cleanCandidateName(String(existing?.nickname || '').trim());
    const existingHasImportMeta = !!existing?.sourceMeta?.importedAtIso;

    // “Nome fraco” vindo do WhatsApp: quando bate com o crachá (whatsAppCandidateName),
    // e não tem marca de import.
    // Metáfora: rabisco no crachá não deve impedir o nome do arquivo.
    const isWeakFromWhatsApp =
      existingNameSource === 'whatsapp' ||
      (!!existingCandidate &&
        !existingHasImportMeta &&
        (existingFull === existingCandidate || existingNick === existingCandidate));

    // Identidade/telefones
    merged.phoneDigits = merged.phoneDigits || normalized.phoneDigits || undefined;
    merged.aliasesDigits = uniqStrings([...(merged.aliasesDigits ?? []), ...normalized.aliasesDigits]);
    merged.phones = mergePhones(merged.phones, nextPhones);

    // Emails (união)
    merged.emails = uniqStrings([...(merged.emails ?? []), ...nextEmails]);

    // Nome / Apelido
    const canOverrideNames = overwrite || isWeakFromWhatsApp;
    const hadAnyIncomingName = !!(nextFirst || nextLast || nextNick || (c.fullName && c.fullName.trim()));

    if (canOverrideNames || !merged.firstName) merged.firstName = nextFirst || merged.firstName;
    if (canOverrideNames || !merged.lastName) merged.lastName = nextLast || merged.lastName;
    if (canOverrideNames || !merged.nickname) merged.nickname = nextNick || merged.nickname;

    // Nome completo bruto (útil para auditoria)
    if (canOverrideNames || !merged.fullName) merged.fullName = (c.fullName || '').trim() || merged.fullName;

    // Se o import trouxe nome e ele foi aplicado (ou teria permissão para aplicar), marcar como import.
    if (hadAnyIncomingName && (canOverrideNames || !existingNameSource)) {
      merged.nameSource = 'import';
    }

    // Endereço
    if (overwrite || !merged.addressFreeform) merged.addressFreeform = nextAddress || merged.addressFreeform;
    // Compatibilidade (UI atual)
    merged.address = merged.addressFreeform || merged.address;

    // Metadados
    merged.sourceMeta = {
      ...(merged.sourceMeta ?? {}),
      filename: c.source?.filename,
      importedAtIso: c.source?.importedAtIso,
      profileId: c.source?.profileId,
    };
    merged.confidence = { ...(merged.confidence ?? {}), ...(c.confidence ?? {}) };

    merged.updatedAtIso = nowIso;

    await clientDB.upsert(merged);

    if (isNew) created++;
    else updated++;
  }

  return { created, updated, skippedNoIdentity, nameApplied, nameRejected };
}

