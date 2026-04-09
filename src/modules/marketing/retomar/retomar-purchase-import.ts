/**
 * retomar-purchase-import
 *
 * Parse e armazenamento de lista de clientes vinda de planilha XLSX.
 * Responsabilidades: parse → dedupe → match com chatId → snapshot.
 *
 * Metáfora: é como um "tradutor de planilha" — pega a lista de Excel da loja,
 * acha cada número de telefone no WhatsApp e diz "esse cliente comprou tal dia".
 */

import * as XLSX from 'xlsx';
import { MettriBridgeClient } from '../../../content/bridge-client';
import { normalizePhoneDigitsWithAliases } from '../../../storage/client-db';
import type { LastActivityEntry } from './eligible-contacts-engine';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ImportedRow {
  /** Somente dígitos, deduplicado por telefone (data mais recente vence). */
  phoneDigits: string;
  /**
   * Dia da última compra: preferencialmente `YYYY-MM-DD` no calendário local (evita trocar o dia com UTC).
   * Snapshots antigos podem ter ISO completo (`…T…Z`) — use `parseImportedPurchaseDate`.
   */
  lastPurchaseIso: string;
  /** Nome do cliente vindo da planilha, pode estar vazio. */
  name?: string;
}

export interface PurchaseImportSnapshot {
  importedAt: string;
  filename?: string;
  rows: ImportedRow[];
}

export interface ImportResult {
  snapshot: PurchaseImportSnapshot;
  lastActivityByChat: Map<string, LastActivityEntry>;
  warnings: {
    unmatchedCount: number;
    /** Até 5 exemplos de telefones sem chatId. */
    samples: string[];
  };
}

// ---------------------------------------------------------------------------
// Constantes de coluna — tolerantes a encoding/maiúsculas/minúsculas
// ---------------------------------------------------------------------------

const COL_ALIASES: Record<'name' | 'phone' | 'date', RegExp> = {
  name: /^nome$/i,
  phone: /^(telefone|tel|phone|celular|whatsapp)$/i,
  date: /^\u00FAltimo\s*pedido$|^ultimo\s*pedido$|^last\s*purchase$|^data\s*pedido$|^data$/i,
};

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

interface RawRow {
  name?: string;
  phone?: string;
  date?: Date | null;
}

function detectColumns(header: string[]): { nameIdx: number; phoneIdx: number; dateIdx: number } {
  let nameIdx = -1, phoneIdx = -1, dateIdx = -1;
  header.forEach((h, i) => {
    const s = String(h ?? '').trim();
    if (nameIdx === -1 && COL_ALIASES.name.test(s)) nameIdx = i;
    if (phoneIdx === -1 && COL_ALIASES.phone.test(s)) phoneIdx = i;
    if (dateIdx === -1 && COL_ALIASES.date.test(s)) dateIdx = i;
  });
  return { nameIdx, phoneIdx, dateIdx };
}

/** Máximo de linhas no topo da folha a inspecionar antes do cabeçalho real (ex.: título "Clientes Inativos"). */
const MAX_HEADER_SCAN_ROWS = 40;

/**
 * Encontra a linha que contém o cabeçalho reconhecível (precisa ter coluna de telefone).
 * Metáfora: pular a faixa de título até achar a fileira com os rótulos das colunas.
 */
function findHeaderRowIndex(aoa: unknown[][]): { rowIndex: number; nameIdx: number; phoneIdx: number; dateIdx: number } | null {
  const limit = Math.min(aoa.length, MAX_HEADER_SCAN_ROWS);
  for (let r = 0; r < limit; r++) {
    const header = (aoa[r] as unknown[]).map(v => String(v ?? '').trim());
    const detected = detectColumns(header);
    if (detected.phoneIdx >= 0) {
      return { rowIndex: r, ...detected };
    }
  }
  return null;
}

/** Converte valor de célula XLSX para Date. Suporta número serial, Date nativo e string. */
function parseCellDate(value: unknown): Date | null {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    // Número serial do Excel (dias desde 1899-12-30)
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    // Priorizar formato BR dd/mm/aaaa para evitar inversão mm/dd do parser nativo.
    const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (br) {
      const day = Number(br[1]);
      const month = Number(br[2]);
      const year = Number(br[3]);
      const d = new Date(year, month - 1, day);
      if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
        return d;
      }
    }
    // yyyy-mm-dd como data de calendário local (evita UTC-only de `new Date('2024-03-01')`).
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      const year = Number(ymd[1]);
      const month = Number(ymd[2]);
      const day = Number(ymd[3]);
      const d = new Date(year, month - 1, day);
      if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
        return d;
      }
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Calendário local → `YYYY-MM-DD` (sem hora; evita “pular” o dia ao serializar). */
export function toLocalCalendarDateIso(d: Date): string {
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Lê `lastPurchaseIso` do snapshot: `YYYY-MM-DD` (preferido) ou legado ISO 8601 completo.
 */
export function parseImportedPurchaseDate(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;
  const ymd = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const y = Number(ymd[1]);
    const mo = Number(ymd[2]);
    const day = Number(ymd[3]);
    const d = new Date(y, mo - 1, day);
    if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
    return d;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Lê a primeira folha do ArrayBuffer e extrai linhas brutas.
 * Localiza colunas por cabeçalho, não por índice fixo (cabeçalho pode estar após linha de título).
 */
function parseSheetRows(buffer: ArrayBuffer): RawRow[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  // Converter em array de arrays para localizar colunas pelo cabeçalho
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  if (aoa.length < 2) return [];

  const found = findHeaderRowIndex(aoa);
  if (!found) {
    throw new Error('Coluna de telefone não encontrada. Esperado cabeçalho: Telefone, Tel, Celular ou WhatsApp.');
  }
  const { rowIndex: headerRow, nameIdx, phoneIdx, dateIdx } = found;

  const rows: RawRow[] = [];
  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r] as unknown[];
    const rawPhone = phoneIdx >= 0 ? String(row[phoneIdx] ?? '').trim() : '';
    if (!rawPhone) continue;

    rows.push({
      name: nameIdx >= 0 ? String(row[nameIdx] ?? '').trim() || undefined : undefined,
      phone: rawPhone,
      date: dateIdx >= 0 ? parseCellDate(row[dateIdx]) : null,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Dedupe
// ---------------------------------------------------------------------------

/**
 * Agrupa por phoneDigits e mantém a data mais recente por grupo.
 * Linhas sem data ficam por último se não houver outra com data no mesmo grupo.
 */
export function dedupeRows(raw: RawRow[]): ImportedRow[] {
  const best = new Map<string, ImportedRow>();

  for (const row of raw) {
    if (!row.phone) continue;
    const { phoneDigits } = normalizePhoneDigitsWithAliases(row.phone);
    if (!phoneDigits) continue;

    const existing = best.get(phoneDigits);
    const date = row.date ?? null;

    if (!existing) {
      best.set(phoneDigits, {
        phoneDigits,
        lastPurchaseIso: date ? toLocalCalendarDateIso(date) : '',
        name: row.name,
      });
      continue;
    }

    // Atualizar se a nova data for mais recente (ou a existente não tem data)
    if (date) {
      const newT = date.getTime();
      const oldT = parseImportedPurchaseDate(existing.lastPurchaseIso)?.getTime();
      if (!existing.lastPurchaseIso || oldT === undefined || newT > oldT) {
        best.set(phoneDigits, {
          phoneDigits,
          lastPurchaseIso: toLocalCalendarDateIso(date),
          name: row.name ?? existing.name,
        });
      }
    }
  }

  return Array.from(best.values());
}

// ---------------------------------------------------------------------------
// Snapshot — persistência via bridge
// ---------------------------------------------------------------------------

function snapshotKey(accountId: string): string {
  return `retomarPurchaseImport_${accountId}`;
}

const bridge = new MettriBridgeClient(3000);

export async function loadSnapshot(accountId: string): Promise<PurchaseImportSnapshot | null> {
  try {
    const key = snapshotKey(accountId);
    const result = await bridge.storageGet([key]);
    const stored = result[key];
    if (stored && typeof stored === 'object' && 'rows' in (stored as object)) {
      return stored as PurchaseImportSnapshot;
    }
  } catch (e) {
    console.error('[RETOMAR IMPORT] Erro ao carregar snapshot:', e);
  }
  return null;
}

export async function saveSnapshot(accountId: string, snapshot: PurchaseImportSnapshot): Promise<void> {
  try {
    await bridge.storageSet({ [snapshotKey(accountId)]: snapshot });
  } catch (e) {
    console.error('[RETOMAR IMPORT] Erro ao salvar snapshot:', e);
  }
}

// ---------------------------------------------------------------------------
// Match telefone → chatId
// ---------------------------------------------------------------------------

interface LastIncomingEntry {
  chatId: string;
  chatName: string;
}

/**
 * Retorna true se o nome parece um telefone (só dígitos, espaços, +, -, parênteses).
 * Metáfora: detecta se o "nome" é na verdade um número disfarçado.
 */
function isPhoneLikeName(name: string): boolean {
  return /^[\d\s+\-()]+$/.test(name.trim());
}

/**
 * Constrói índice aliasDigits → chatId a partir do mapa de mensagens.
 * Colisão: primeiro chatId encontrado vence (ordem da iteração do Map).
 */
function buildAliasIndex(lastIncoming: Map<string, LastIncomingEntry>): Map<string, LastIncomingEntry> {
  const index = new Map<string, LastIncomingEntry>();
  for (const entry of lastIncoming.values()) {
    const rawId = entry.chatId.replace(/@c\.us$/i, '');
    const { phoneDigits, aliasesDigits } = normalizePhoneDigitsWithAliases(rawId);
    const allDigits = new Set([phoneDigits, ...aliasesDigits].filter(Boolean));
    for (const d of allDigits) {
      if (!index.has(d)) {
        index.set(d, entry);
      }
    }
  }
  return index;
}

/**
 * Gera chatId de fallback a partir do telefone da planilha quando não há match no histórico.
 * Metáfora: se não encontramos o contato na agenda local, montamos o "endereço padrão"
 * para não perder a chance de retomar.
 */
function buildFallbackChatId(phoneDigitsRaw: string): string | null {
  const { phoneDigits } = normalizePhoneDigitsWithAliases(phoneDigitsRaw);
  if (!phoneDigits) return null;

  let canonical = phoneDigits;
  // Heurística BR: sem DDI (10/11) -> prefixar 55 para formar chatId completo.
  if (!canonical.startsWith('55') && (canonical.length === 10 || canonical.length === 11)) {
    canonical = `55${canonical}`;
  }
  return `${canonical}@c.us`;
}

/**
 * Resolve snapshot → `Map<chatId, LastActivityEntry>`.
 * Também retorna warnings de linhas sem match.
 */
export function resolveLastActivityFromSnapshot(
  rows: ImportedRow[],
  lastIncoming: Map<string, LastIncomingEntry>
): { lastActivityByChat: Map<string, LastActivityEntry>; unmatchedCount: number; unmatchedSamples: string[] } {
  const aliasIndex = buildAliasIndex(lastIncoming);
  const map = new Map<string, LastActivityEntry>();
  let unmatchedCount = 0;
  const unmatchedSamples: string[] = [];

  for (const row of rows) {
    if (!row.lastPurchaseIso) continue; // linha sem data — skip

    const { phoneDigits, aliasesDigits } = normalizePhoneDigitsWithAliases(row.phoneDigits);
    const allDigits = new Set([phoneDigits, ...aliasesDigits].filter(Boolean));

    let matched: LastIncomingEntry | undefined;
    for (const d of allDigits) {
      matched = aliasIndex.get(d);
      if (matched) break;
    }

    if (!matched) {
      unmatchedCount++;
      if (unmatchedSamples.length < 5) unmatchedSamples.push(row.phoneDigits);
      const fallbackChatId = buildFallbackChatId(row.phoneDigits);
      if (!fallbackChatId) continue;
      matched = {
        chatId: fallbackChatId,
        chatName: row.name || fallbackChatId.split('@')[0],
      };
    }

    const date = parseImportedPurchaseDate(row.lastPurchaseIso);
    if (!date) continue;

    // Preferir nome da planilha quando o nome do WhatsApp é só um número.
    // Metáfora: a planilha da loja costuma ter o nome real do cliente; o WhatsApp
    // pode ter apenas o telefone se o contato não estiver salvo na agenda.
    const waName = matched.chatName || '';
    const xlsxName = row.name || '';
    const chatName = (xlsxName && (!waName || isPhoneLikeName(waName)))
      ? xlsxName
      : (waName || xlsxName || matched.chatId.split('@')[0]);

    // Se já existe entrada para este chatId, manter a mais recente
    const existing = map.get(matched.chatId);
    if (!existing || date > existing.date) {
      map.set(matched.chatId, {
        chatId: matched.chatId,
        chatName,
        date,
      });
    }
  }

  return { lastActivityByChat: map, unmatchedCount, unmatchedSamples };
}

// ---------------------------------------------------------------------------
// API principal — parseListaClientesXlsx
// ---------------------------------------------------------------------------

/**
 * Entry-point principal: lê o ArrayBuffer do XLSX, deduplica e retorna
 * o snapshot pronto para salvar + o mapa resolvido.
 */
export function parseListaClientesXlsx(
  buffer: ArrayBuffer,
  lastIncoming: Map<string, LastIncomingEntry>,
  filename?: string
): ImportResult {
  const raw = parseSheetRows(buffer);
  const deduped = dedupeRows(raw);

  const snapshot: PurchaseImportSnapshot = {
    importedAt: new Date().toISOString(),
    filename,
    rows: deduped,
  };

  const { lastActivityByChat, unmatchedCount, unmatchedSamples } =
    resolveLastActivityFromSnapshot(deduped, lastIncoming);

  return {
    snapshot,
    lastActivityByChat,
    warnings: {
      unmatchedCount,
      samples: unmatchedSamples,
    },
  };
}
