/**
 * Diagnóstico: contagens "puras" no XLSX vs camadas de regras (minDistance, contador).
 * Rodar: npx vitest run tests/unit/marketing/retomar/diagnose-retomar-faixas.test.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  parseListaClientesXlsx,
  parseImportedPurchaseDate,
} from '../../../../src/modules/marketing/retomar/retomar-purchase-import';
import { computeEligibleContacts } from '../../../../src/modules/marketing/retomar/eligible-contacts-engine';
import {
  daysBetweenByCalendar,
  getRangesForType,
  isInRange,
  type ReguaRange,
} from '../../../../src/modules/marketing/retomar/inactive-days';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const XLSX_CANDIDATES = [
  path.join(REPO_ROOT, 'Clientes Inativos.xlsx'),
  path.resolve(process.cwd(), 'Clientes Inativos.xlsx'),
  'C:\\Mettri4\\Clientes Inativos.xlsx',
];
const XLSX_PATH = XLSX_CANDIDATES.find(p => fs.existsSync(p)) ?? '';

const REF_NOW = new Date(2026, 3, 9, 12, 0, 0);
const RANGES_F = getRangesForType('frequente');
const MIN_F = 21;

function countByBand(
  items: Array<{ daysInactive: number; rangeIndex: number }>,
  ranges: ReguaRange[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of ranges) {
    const label = Number.isFinite(r.max) ? `${r.min}–${r.max}` : `${r.min}+`;
    out[label] = items.filter(x => isInRange(x.daysInactive, r)).length;
  }
  return out;
}

describe('diagnose-retomar-faixas (Clientes Inativos.xlsx)', () => {
  it('A→F: snapshot, mapa fallback, elegíveis, minDistance, contador=1; H= outgoing só no meio', () => {
    if (!XLSX_PATH) {
      // eslint-disable-next-line no-console
      console.log('[skip] sem ficheiro Clientes Inativos.xlsx em', XLSX_CANDIDATES);
      return;
    }

    const buf = fs.readFileSync(XLSX_PATH);
    const isZip = buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
    if (!isZip) {
      // eslint-disable-next-line no-console
      console.log('[skip] ficheiro não parece XLSX (zip):', XLSX_PATH, 'bytes', buf.length);
      return;
    }
    const u8 = new Uint8Array(buf.length);
    u8.set(buf);
    const emptyIncoming = new Map<string, { chatId: string; chatName: string }>();
    const parsed = parseListaClientesXlsx(u8.buffer, emptyIncoming, 'Clientes Inativos.xlsx');

    const snapBands: Array<{ daysInactive: number; rangeIndex: number }> = [];
    for (const row of parsed.snapshot.rows) {
      if (!row.lastPurchaseIso) continue;
      const d = parseImportedPurchaseDate(row.lastPurchaseIso);
      if (!d) continue;
      const daysInactive = daysBetweenByCalendar(REF_NOW, d);
      const rangeIndex = RANGES_F.findIndex(r => isInRange(daysInactive, r));
      snapBands.push({ daysInactive, rangeIndex });
    }

    const mapBands: Array<{ daysInactive: number; rangeIndex: number }> = [];
    let mapOutsideRegua = 0;
    for (const v of parsed.lastActivityByChat.values()) {
      const daysInactive = daysBetweenByCalendar(REF_NOW, v.date);
      const rangeIndex = RANGES_F.findIndex(r => isInRange(daysInactive, r));
      if (rangeIndex === -1) mapOutsideRegua += 1;
      mapBands.push({ daysInactive, rangeIndex });
    }

    const eligBase = computeEligibleContacts({
      now: REF_NOW,
      lastActivityByChat: parsed.lastActivityByChat,
      lastOutgoingByContact: new Map(),
      contadorByChat: {},
      ranges: RANGES_F,
      minDistance: MIN_F,
      chatIdsInLists: new Set(),
    });

    const outgoing5d = new Map<string, { lastOutgoingAt: Date }>();
    for (const e of eligBase) outgoing5d.set(e.chatId, { lastOutgoingAt: new Date(2026, 3, 4) });
    const eligBlock = computeEligibleContacts({
      now: REF_NOW,
      lastActivityByChat: parsed.lastActivityByChat,
      lastOutgoingByContact: outgoing5d,
      contadorByChat: {},
      ranges: RANGES_F,
      minDistance: MIN_F,
      chatIdsInLists: new Set(),
    });

    const contador1: Record<string, number> = {};
    for (const e of eligBase) contador1[e.chatId] = 1;
    const eligC1 = computeEligibleContacts({
      now: REF_NOW,
      lastActivityByChat: parsed.lastActivityByChat,
      lastOutgoingByContact: new Map(),
      contadorByChat: contador1,
      ranges: RANGES_F,
      minDistance: MIN_F,
      chatIdsInLists: new Set(),
    });

    // H: última mensagem enviada há 5 dias APENAS para quem está nas faixas 42–72 e 73–115
    const outgoingMidOnly = new Map<string, { lastOutgoingAt: Date }>();
    const recent = new Date(2026, 3, 4);
    for (const e of eligBase) {
      if (isInRange(e.daysInactive, RANGES_F[1]) || isInRange(e.daysInactive, RANGES_F[2])) {
        outgoingMidOnly.set(e.chatId, { lastOutgoingAt: recent });
      }
    }
    const eligMidBlocked = computeEligibleContacts({
      now: REF_NOW,
      lastActivityByChat: parsed.lastActivityByChat,
      lastOutgoingByContact: outgoingMidOnly,
      contadorByChat: {},
      ranges: RANGES_F,
      minDistance: MIN_F,
      chatIdsInLists: new Set(),
    });

    const bFaixas = countByBand(mapBands, RANGES_F);
    const sumC =
      (bFaixas['21–41'] ?? 0) +
      (bFaixas['42–72'] ?? 0) +
      (bFaixas['73–115'] ?? 0) +
      (bFaixas['116–168'] ?? 0);

    const report = {
      ref: REF_NOW.toISOString(),
      A_snapshot_rows_com_data: snapBands.length,
      A_faixas_frequente: countByBand(snapBands, RANGES_F),
      A_fora_regua: snapBands.filter(x => x.rangeIndex === -1).length,
      B_map_size: parsed.lastActivityByChat.size,
      B_fora_regua_chats: mapOutsideRegua,
      B_faixas: bFaixas,
      B_soma_faixas_regua: sumC,
      C_elegiveis_total: eligBase.length,
      C_faixas: countByBand(eligBase, RANGES_F),
      D_com_outgoing_5d_em_todos: eligBlock.length,
      F_contador1_total: eligC1.length,
      F_faixas: countByBand(eligC1, RANGES_F),
      H_outgoing_só_meio_total: eligMidBlocked.length,
      H_faixas: countByBand(eligMidBlocked, RANGES_F),
    };

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));

    expect(snapBands.length).toBeGreaterThan(2000);
    const midA =
      (report.A_faixas_frequente['42–72'] ?? 0) + (report.A_faixas_frequente['73–115'] ?? 0);
    expect(midA).toBeGreaterThan(100);
    expect(report.B_map_size).toBe(report.B_fora_regua_chats + report.B_soma_faixas_regua);
    expect(report.C_elegiveis_total).toBe(report.B_soma_faixas_regua);
    expect(report.C_faixas['42–72'] ?? 0).toBeGreaterThan(0);
    expect(report.C_faixas['73–115'] ?? 0).toBeGreaterThan(0);
    expect(report.D_com_outgoing_5d_em_todos).toBe(0);
    expect((report.H_faixas['42–72'] ?? 0) + (report.H_faixas['73–115'] ?? 0)).toBe(0);
    expect(report.H_faixas['21–41'] ?? 0).toBe(report.C_faixas['21–41'] ?? 0);
    expect(report.H_faixas['116–168'] ?? 0).toBe(report.C_faixas['116–168'] ?? 0);
  });
});
