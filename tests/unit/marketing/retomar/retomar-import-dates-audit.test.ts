/**
 * Auditoria de datas no XLSX real (se existir): dias negativos, faixas, parse YYYY-MM-DD.
 * Rodar: npx vitest run tests/unit/marketing/retomar/retomar-import-dates-audit.test.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  parseListaClientesXlsx,
  parseImportedPurchaseDate,
  toLocalCalendarDateIso,
} from '../../../../src/modules/marketing/retomar/retomar-purchase-import';
import { daysBetweenByCalendar, getRangesForType, isInRange } from '../../../../src/modules/marketing/retomar/inactive-days';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const XLSX_CANDIDATES = [
  path.join(REPO_ROOT, 'Clientes Inativos.xlsx'),
  path.resolve(process.cwd(), 'Clientes Inativos.xlsx'),
  'C:\\Mettri4\\Clientes Inativos.xlsx',
];
const XLSX_PATH = XLSX_CANDIDATES.find(p => fs.existsSync(p)) ?? '';

const REF_NOW = new Date(2026, 3, 9, 12, 0, 0);
const RANGES_F = getRangesForType('frequente');

describe('retomar-import-dates-audit (Clientes Inativos.xlsx)', () => {
  it('parseImportedPurchaseDate + toLocalCalendarDateIso: mesmo dia que dd/mm no calendário local', () => {
    const fromBr = parseImportedPurchaseDate('2026-04-09');
    expect(fromBr).not.toBeNull();
    expect(toLocalCalendarDateIso(fromBr!)).toBe('2026-04-09');
    expect(daysBetweenByCalendar(REF_NOW, fromBr!)).toBe(0);
  });

  it('legado ISO completo ainda é lido', () => {
    const d = parseImportedPurchaseDate('2024-03-01T00:00:00.000Z');
    expect(d).not.toBeNull();
  });

  it('auditoria no ficheiro: contagens e amostras de dias negativos', () => {
    if (!XLSX_PATH) {
      // eslint-disable-next-line no-console
      console.log('[skip] sem Clientes Inativos.xlsx');
      expect(true).toBe(true);
      return;
    }

    const buf = fs.readFileSync(XLSX_PATH);
    const isZip = buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
    if (!isZip) {
      // eslint-disable-next-line no-console
      console.log('[skip] não é XLSX zip:', XLSX_PATH);
      expect(true).toBe(true);
      return;
    }

    const u8 = new Uint8Array(buf.length);
    u8.set(buf);
    const emptyIncoming = new Map<string, { chatId: string; chatName: string }>();
    const parsed = parseListaClientesXlsx(u8.buffer, emptyIncoming, 'Clientes Inativos.xlsx');

    let withIso = 0;
    let unparsable = 0;
    let negativeDays = 0;
    let lt21 = 0;
    let inRegua = 0;
    let gt168 = 0;
    const samplesNeg: string[] = [];

    for (const row of parsed.snapshot.rows) {
      if (!row.lastPurchaseIso) continue;
      withIso += 1;
      const d = parseImportedPurchaseDate(row.lastPurchaseIso);
      if (!d) {
        unparsable += 1;
        continue;
      }
      const days = daysBetweenByCalendar(REF_NOW, d);
      if (days < 0) {
        negativeDays += 1;
        if (samplesNeg.length < 8) {
          samplesNeg.push(`${row.phoneDigits} iso=${row.lastPurchaseIso} → dias=${days}`);
        }
        continue;
      }
      if (days < 21) lt21 += 1;
      else if (RANGES_F.some(r => isInRange(days, r))) inRegua += 1;
      else gt168 += 1;
    }

    const report = {
      ref: REF_NOW.toISOString(),
      ficheiro: XLSX_PATH,
      linhasSnapshotComData: withIso,
      naoParseou: unparsable,
      diasNegativos: negativeDays,
      amostrasDiasNegativos: samplesNeg,
      foraRegua_muitoRecente_lt21: lt21,
      dentroRegua_21_168: inRegua,
      foraRegua_muitoAntigo_gt168: gt168,
    };

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));

    expect(unparsable).toBe(0);
    expect(withIso).toBeGreaterThan(1000);
    // Após YYYY-MM-DD local, “dias negativos” devem ser só datas futuras reais na planilha — não centenas por bug UTC.
    expect(negativeDays).toBeLessThan(200);
  });
});
