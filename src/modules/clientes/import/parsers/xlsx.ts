import type { ParsedTable } from '../import-engine';
import * as XLSX from 'xlsx';

export async function parseXlsxToTable(file: File): Promise<ParsedTable> {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) return { headers: [], rows: [] };

    const ws = wb.Sheets[sheetName];

    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[];
    if (!Array.isArray(aoa) || aoa.length === 0) return { headers: [], rows: [] };

    const firstRow = (aoa[0] as unknown[]) || [];
    const rawHeaders = Array.isArray(firstRow) ? firstRow : [];

    const headers = rawHeaders.map((h, i) => {
      const s = String(h ?? '').trim();
      return s ? s : `col_${i + 1}`;
    });

    const rows = aoa
      .slice(1)
      .filter(r => Array.isArray(r))
      .map((r) => {
        const rr = r as unknown[];
        return headers.map((_, idx) => String(rr[idx] ?? '').trim());
      });

    return { headers, rows };
  } catch {
    return { headers: [], rows: [] };
  }
}
